/**
 * PLANIFICADOR NUTRICIONAL MIQUEL - VERSIÓN AUDITORÍA TOTAL
 */

let baseDatosAlimentos = [];
let ingredientesElegidos = [];

const REPARTOS = {
    desayuno: { p: 0.10, g: 0.10, ch: 0.27, label: "Desayuno (15%)" },
    comida:   { p: 0.39, g: 0.40, ch: 0.26, label: "Comida (35%)" },
    merienda: { p: 0.08, g: 0.06, ch: 0.17, label: "Merienda (10%)" },
    cena:     { p: 0.43, g: 0.44, ch: 0.30, label: "Cena (40%)" }
};

window.onload = function() {
    cargarDatosCSV();
    const slider = document.getElementById('ajuste');
    if(slider) slider.oninput = function() { document.getElementById('valAjuste').innerText = this.value + '%'; };
};

async function cargarDatosCSV() {
    const statusDiv = document.getElementById('statusCsv');
    try {
        const respuesta = await fetch('./alimentos.csv?v=' + Date.now());
        const texto = await respuesta.text();
        const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
        baseDatosAlimentos = lineas.slice(1).map(linea => {
            const col = linea.split(/[,;\t]/); 
            if (col.length >= 5) {
                const limpiarNum = (val) => parseFloat(val.replace(',', '.').trim());
                return { nombre: col[0].trim(), kcal: limpiarNum(col[1]), p: limpiarNum(col[2]), g: limpiarNum(col[3]), ch: limpiarNum(col[4]) };
            }
            return null;
        }).filter(a => a !== null);
        if (baseDatosAlimentos.length > 0) {
            statusDiv.innerHTML = `✅ ${baseDatosAlimentos.length} alimentos listos.`;
            document.getElementById('diseñador').style.display = 'block';
            const dl = document.getElementById('listaIngredientes');
            baseDatosAlimentos.forEach(al => { const opt = document.createElement('option'); opt.value = al.nombre; dl.appendChild(opt); });
        }
    } catch (e) { statusDiv.innerHTML = "❌ Error cargando CSV"; }
}

window.añadirAlimentoLista = function() {
    const input = document.getElementById('buscadorIngrediente');
    const al = baseDatosAlimentos.find(a => a.nombre.toLowerCase() === input.value.trim().toLowerCase());
    if (al && !ingredientesElegidos.includes(al)) {
        ingredientesElegidos.push(al);
        renderizarLista();
        input.value = "";
    }
};

function renderizarLista() {
    const ul = document.getElementById('ulSeleccionados');
    ul.innerHTML = ingredientesElegidos.map((al, idx) => `
        <li class="ingrediente-tag">${al.nombre} <span class="btn-remove" onclick="eliminarIngrediente(${idx})">✕</span></li>
    `).join('');
}

window.eliminarIngrediente = function(idx) { ingredientesElegidos.splice(idx, 1); renderizarLista(); };

window.calcularObjetivos = function() {
    const peso = parseFloat(document.getElementById('peso').value);
    const altura = parseFloat(document.getElementById('altura').value);
    const edad = parseInt(document.getElementById('edad').value);
    const genero = document.getElementById('genero').value;
    const ajuste = 1 + (parseFloat(document.getElementById('ajuste').value) / 100);

    let bmr = (genero === 'hombre') ? 88.36 + (13.4 * peso) + (4.8 * altura) - (5.7 * edad) : 447.59 + (9.2 * peso) + (3.1 * altura) - (4.3 * edad);
    const manual = parseFloat(document.getElementById('kcalManual').value);
    if (!isNaN(manual) && manual > 0) bmr = manual;

    const intensidades = [
        { id: 'Alta', m: parseFloat(document.getElementById('multAlta').value), p: 2.0, g: 1.1 },
        { id: 'Media', m: parseFloat(document.getElementById('multMedia').value), p: 1.7, g: 1.1 },
        { id: 'Baja', m: parseFloat(document.getElementById('multBaja').value), p: 1.4, g: 0.7 }
    ];

    let html = `<table><tr><th>Día / Comida</th><th>Kcal</th><th>P (g)</th><th>G (g)</th><th>CH (g)</th></tr>`;
    
    intensidades.forEach(d => {
        const kcalT = bmr * d.m * ajuste;
        const pT = peso * d.p;
        const gT = peso * d.g;
        const chT = (kcalT - (pT * 4) - (gT * 9)) / 4;

        // Fila del TOTAL del día
        html += `<tr style="background:#eee; font-weight:bold;"><td>TOTAL ${d.id}</td><td>${Math.round(kcalT)}</td><td>${Math.round(pT)}</td><td>${Math.round(gT)}</td><td>${Math.round(chT)}</td></tr>`;
        
        // Filas del DESGLOSE por comidas
        Object.keys(REPARTOS).forEach(c => {
            const rep = REPARTOS[c];
            html += `<tr style="font-size:0.85rem; color:#555;">
                <td>&nbsp;&nbsp;↳ ${c.charAt(0).toUpperCase() + c.slice(1)}</td>
                <td>${Math.round(kcalT * (rep.p*0.4 + rep.g*0.4 + rep.ch*0.2))}</td> <td>${(pT * rep.p).toFixed(1)}</td>
                <td>${(gT * rep.g).toFixed(1)}</td>
                <td>${(chT * rep.ch).toFixed(1)}</td>
            </tr>`;
        });
    });
    html += `</table>`;
    document.getElementById('tablaResumen').innerHTML = html;
    document.getElementById('resultados').style.display = 'block';
};

window.ejecutarSolverReceta = function() {
    const comida = document.getElementById('comidaSeleccionada').value;
    const tipoDia = document.getElementById('tipoDiaSeleccionado').value;
    const tabla = document.getElementById('tablaResumen').querySelector('table');
    
    if(!tabla || ingredientesElegidos.length === 0) return alert("Calcula objetivos y elige ingredientes.");

    let obj = null;
    const filas = tabla.querySelectorAll('tr');
    filas.forEach(f => {
        if(f.cells[0].innerText.includes(comida.charAt(0).toUpperCase() + comida.slice(1)) && 
           f.previousElementSibling && f.previousElementSibling.innerText.includes(tipoDia)) {
             // Este selector busca la fila de la comida que está justo debajo del total del tipo de día
        }
    });

    // Forma más segura de obtener el objetivo: Recalcularlo igual que en la tabla
    const peso = parseFloat(document.getElementById('peso').value);
    const intensidades = { 'Alta': {p:2.0, g:1.1, m:parseFloat(document.getElementById('multAlta').value)}, 'Media': {p:1.7, g:1.1, m:parseFloat(document.getElementById('multMedia').value)}, 'Baja': {p:1.4, g:0.7, m:parseFloat(document.getElementById('multBaja').value)}};
    const det = intensidades[tipoDia];
    const ajuste = 1 + (parseFloat(document.getElementById('ajuste').value) / 100);
    let bmr = (document.getElementById('genero').value === 'hombre') ? 88.36 + (13.4 * peso) + (4.8 * 180) - (5.7 * 34) : 447.59 + (9.2 * peso) + (3.1 * 180) - (4.3 * 34);
    if (parseFloat(document.getElementById('kcalManual').value) > 0) bmr = parseFloat(document.getElementById('kcalManual').value);
    
    const kcalT = bmr * det.m * ajuste;
    const pT = peso * det.p;
    const gT = peso * det.g;
    const chT = (kcalT - (pT * 4) - (gT * 9)) / 4;

    obj = { p: pT * REPARTOS[comida].p, g: gT * REPARTOS[comida].g, ch: chT * REPARTOS[comida].ch };

    // SOLVER MEJORADO
    let gramos = ingredientesElegidos.map(() => 50);
    for(let i=0; i<2000; i++) {
        let cP=0, cG=0, cCH=0;
        ingredientesElegidos.forEach((al, idx) => {
            cP += (al.p * gramos[idx] / 100);
            cG += (al.g * gramos[idx] / 100);
            cCH += (al.ch * gramos[idx] / 100);
        });

        ingredientesElegidos.forEach((al, idx) => {
            let diff = 0;
            if (al.p > al.ch && al.p > al.g) diff = (obj.p - cP) * 0.2;
            else if (al.g > al.p && al.g > al.ch) diff = (obj.g - cG) * 0.2;
            else diff = (obj.ch - cCH) * 0.2;
            gramos[idx] = Math.max(0, gramos[idx] + diff);
        });
    }

    let res = `<div class="receta-box"><h3>${comida.toUpperCase()} (${tipoDia})</h3><ul>`;
    ingredientesElegidos.forEach((al, i) => {
        if(gramos[i] > 1) res += `<li><strong>${Math.round(gramos[i])}g</strong> de ${al.nombre}</li>`;
    });
    res += `</ul><p style="font-size:0.8rem; border-top:1px solid #ccc; padding-top:5px;">Macros alcanzados: P:${cP.toFixed(1)} | G:${cG.toFixed(1)} | CH:${cCH.toFixed(1)}</p></div>`;
    document.getElementById('objetivoComidaDetalle').innerHTML = res;
};
