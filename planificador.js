/**
 * PLANIFICADOR NUTRICIONAL MIQUEL - VERSIÓN FINAL CORREGIDA
 */

let baseDatosAlimentos = [];
let ingredientesElegidos = [];

const REPARTOS = {
    desayuno: { p: 0.10, g: 0.10, ch: 0.27 },
    comida:   { p: 0.39, g: 0.40, ch: 0.26 },
    merienda: { p: 0.08, g: 0.06, ch: 0.17 },
    cena:     { p: 0.43, g: 0.44, ch: 0.30 }
};

window.onload = function() {
    cargarDatosCSV();
    const slider = document.getElementById('ajuste');
    if(slider) {
        slider.oninput = function() { 
            document.getElementById('valAjuste').innerText = this.value + '%'; 
        };
    }
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
                return { 
                    nombre: col[0].trim(), 
                    kcal: limpiarNum(col[1]), 
                    p: limpiarNum(col[2]), 
                    g: limpiarNum(col[3]), 
                    ch: limpiarNum(col[4]) 
                };
            }
            return null;
        }).filter(a => a !== null);

        if (baseDatosAlimentos.length > 0) {
            statusDiv.innerHTML = `✅ ${baseDatosAlimentos.length} alimentos listos.`;
            document.getElementById('diseñador').style.display = 'block';
            const dl = document.getElementById('listaIngredientes');
            baseDatosAlimentos.forEach(al => { 
                const opt = document.createElement('option'); 
                opt.value = al.nombre; 
                dl.appendChild(opt); 
            });
        }
    } catch (e) { 
        statusDiv.innerHTML = "❌ Error cargando CSV"; 
    }
}

window.añadirAlimentoLista = function() {
    const input = document.getElementById('buscadorIngrediente');
    const nombreSel = input.value.trim().toLowerCase();
    const al = baseDatosAlimentos.find(a => a.nombre.toLowerCase() === nombreSel);
    
    if (al && !ingredientesElegidos.some(i => i.nombre === al.nombre)) {
        ingredientesElegidos.push(al);
        renderizarLista();
        input.value = "";
    }
};

function renderizarLista() {
    const ul = document.getElementById('ulSeleccionados');
    ul.innerHTML = ingredientesElegidos.map((al, idx) => `
        <li class="ingrediente-tag">
            ${al.nombre} 
            <span class="btn-remove" onclick="eliminarIngrediente(${idx})">✕</span>
        </li>
    `).join('');
}

window.eliminarIngrediente = function(idx) { 
    ingredientesElegidos.splice(idx, 1); 
    renderizarLista(); 
};

window.calcularObjetivos = function() {
    const peso = parseFloat(document.getElementById('peso').value);
    const altura = parseFloat(document.getElementById('altura').value);
    const edad = parseInt(document.getElementById('edad').value);
    const genero = document.getElementById('genero').value;
    const ajuste = 1 + (parseFloat(document.getElementById('ajuste').value) / 100);

    let bmr = (genero === 'hombre') 
        ? 88.36 + (13.4 * peso) + (4.8 * altura) - (5.7 * edad) 
        : 447.59 + (9.2 * peso) + (3.1 * altura) - (4.3 * edad);

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

        html += `<tr class="dia-total"><td>TOTAL ${d.id}</td><td>${Math.round(kcalT)}</td><td>${Math.round(pT)}</td><td>${Math.round(gT)}</td><td>${Math.round(chT)}</td></tr>`;
        
        Object.keys(REPARTOS).forEach(c => {
            const rep = REPARTOS[c];
            html += `<tr class="comida-fila">
                <td>&nbsp;&nbsp;↳ ${c.charAt(0).toUpperCase() + c.slice(1)}</td>
                <td>-</td>
                <td>${(pT * rep.p).toFixed(1)}</td>
                <td>${(gT * rep.g).toFixed(1)}</td>
                <td>${(chT * rep.ch).toFixed(1)}</td>
            </tr>`;
        });
    });
    
    html += "</table>";
    document.getElementById('tablaResumen').innerHTML = html;
    document.getElementById('resultados').style.display = 'block';
};

window.ejecutarSolverReceta = function() {
    const comida = document.getElementById('comidaSeleccionada').value;
    const tipoDia = document.getElementById('tipoDiaSeleccionado').value;
    
    if (ingredientesElegidos.length === 0) return alert("Añade ingredientes.");

    // Cálculo manual del objetivo para evitar errores de lectura de tabla
    const peso = parseFloat(document.getElementById('peso').value);
    const ajuste = 1 + (parseFloat(document.getElementById('ajuste').value) / 100);
    const intensidadesMap = {
        'Alta': {m: parseFloat(document.getElementById('multAlta').value), p: 2.0, g: 1.1},
        'Media': {m: parseFloat(document.getElementById('multMedia').value), p: 1.7, g: 1.1},
        'Baja': {m: parseFloat(document.getElementById('multBaja').value), p: 1.4, g: 0.7}
    };
    
    const det = intensidadesMap[tipoDia];
    let bmr = (document.getElementById('genero').value === 'hombre') 
        ? 88.36 + (13.4 * peso) + (4.8 * 180) - (5.7 * 34) 
        : 447.59 + (9.2 * peso) + (3.1 * 180) - (4.3 * 34);
    
    if (parseFloat(document.getElementById('kcalManual').value) > 0) bmr = parseFloat(document.getElementById('kcalManual').value);
    
    const kcalT = bmr * det.m * ajuste;
    const pT = peso * det.p;
    const gT = peso * det.g;
    const chT = (kcalT - (pT * 4) - (gT * 9)) / 4;

    const obj = { p: pT * REPARTOS[comida].p, g: gT * REPARTOS[comida].g, ch: chT * REPARTOS[comida].ch };

    // SOLVER
    let gramos = ingredientesElegidos.map(() => 50);
    let cP = 0, cG = 0, cCH = 0;

    for(let i=0; i<1500; i++) {
        cP = 0; cG = 0; cCH = 0;
        ingredientesElegidos.forEach((al, idx) => {
            cP += (al.p * gramos[idx] / 100);
            cG += (al.g * gramos[idx] / 100);
            cCH += (al.ch * gramos[idx] / 100);
        });

        ingredientesElegidos.forEach((al, idx) => {
            let error = 0;
            if (al.p > al.ch && al.p > al.g) error = (obj.p - cP) * 0.1;
            else if (al.g > al.p && al.g > al.ch) error = (obj.g - cG) * 0.1;
            else error = (obj.ch - cCH) * 0.1;
            gramos[idx] = Math.max(0, gramos[idx] + error);
        });
    }

    let res = `<div class="receta-box"><h3>${comida.toUpperCase()} (${tipoDia})</h3><ul>`;
    ingredientesElegidos.forEach((al, i) => {
        if(gramos[i] > 1) res += `<li><strong>${Math.round(gramos[i])}g</strong> de ${al.nombre}</li>`;
    });
    res += `</ul><p style="font-size:0.7rem; color:#666;">P:${cP.toFixed(1)} | G:${cG.toFixed(1)} | CH:${cCH.toFixed(1)}</p></div>`;
    document.getElementById('objetivoComidaDetalle').innerHTML = res;
};
