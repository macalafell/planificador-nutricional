/**
 * PLANIFICADOR NUTRICIONAL MIQUEL - VERSIÓN SOLVER ROBUSTO
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
                // Limpieza agresiva de números para evitar NaNs
                const limpiarNum = (val) => {
                    if(!val) return 0;
                    let n = parseFloat(val.toString().replace(',', '.').trim());
                    return isNaN(n) ? 0 : n;
                };
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
            poblarDatalist();
        }
    } catch (e) { statusDiv.innerHTML = "❌ Error en base de datos."; }
}

function poblarDatalist() {
    const dl = document.getElementById('listaIngredientes');
    dl.innerHTML = "";
    baseDatosAlimentos.forEach(al => {
        const opt = document.createElement('option');
        opt.value = al.nombre;
        dl.appendChild(opt);
    });
}

window.añadirAlimentoLista = function() {
    const input = document.getElementById('buscadorIngrediente');
    const nombreSel = input.value.trim();
    // Buscamos coincidencia exacta ignorando mayúsculas
    const al = baseDatosAlimentos.find(a => a.nombre.toLowerCase() === nombreSel.toLowerCase());
    
    if (al) {
        if(!ingredientesElegidos.some(i => i.nombre === al.nombre)) {
            ingredientesElegidos.push(al);
            renderizarLista();
        }
        input.value = "";
    } else {
        alert("Alimento no encontrado. Selecciónalo de la lista desplegable.");
    }
};

function renderizarLista() {
    const ul = document.getElementById('ulSeleccionados');
    ul.innerHTML = ingredientesElegidos.map((al, idx) => `
        <li class="ingrediente-tag">${al.nombre} <span class="btn-remove" onclick="eliminarIngrediente(${idx})">✕</span></li>
    `).join('');
}

window.eliminarIngrediente = function(idx) { 
    ingredientesElegidos.splice(idx, 1); 
    renderizarLista(); 
};

window.calcularObjetivos = function() {
    const peso = parseFloat(document.getElementById('peso').value) || 75;
    const altura = parseFloat(document.getElementById('altura').value) || 180;
    const edad = parseInt(document.getElementById('edad').value) || 34;
    const genero = document.getElementById('genero').value;
    const ajuste = 1 + (parseFloat(document.getElementById('ajuste').value) / 100);

    let bmr = (genero === 'hombre') 
        ? 88.36 + (13.4 * peso) + (4.8 * altura) - (5.7 * edad) 
        : 447.59 + (9.2 * peso) + (3.1 * altura) - (4.3 * edad);

    const manual = parseFloat(document.getElementById('kcalManual').value);
    if (!isNaN(manual) && manual > 0) bmr = manual;

    const intensidades = [
        { id: 'Alta', m: parseFloat(document.getElementById('multAlta').value) || 1.6, p: 2.0, g: 1.1 },
        { id: 'Media', m: parseFloat(document.getElementById('multMedia').value) || 1.45, p: 1.7, g: 1.1 },
        { id: 'Baja', m: parseFloat(document.getElementById('multBaja').value) || 1.2, p: 1.4, g: 0.7 }
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
    
    if (ingredientesElegidos.length === 0) return alert("Añade ingredientes primero.");

    const peso = parseFloat(document.getElementById('peso').value) || 75;
    const altura = parseFloat(document.getElementById('altura').value) || 180;
    const edad = parseInt(document.getElementById('edad').value) || 34;
    const ajuste = 1 + (parseFloat(document.getElementById('ajuste').value) / 100);

    const mults = {
        'Alta': parseFloat(document.getElementById('multAlta').value) || 1.6,
        'Media': parseFloat(document.getElementById('multMedia').value) || 1.45,
        'Baja': parseFloat(document.getElementById('multBaja').value) || 1.2
    };
    const ratios = { 'Alta': {p:2, g:1.1}, 'Media': {p:1.7, g:1.1}, 'Baja': {p:1.4, g:0.7} };

    let bmr = (document.getElementById('genero').value === 'hombre') 
        ? 88.36 + (13.4 * peso) + (4.8 * altura) - (5.7 * edad)
        : 447.59 + (9.2 * peso) + (3.1 * altura) - (4.3 * edad);
    
    if (parseFloat(document.getElementById('kcalManual').value) > 0) bmr = parseFloat(document.getElementById('kcalManual').value);

    const pT = peso * ratios[tipoDia].p;
    const gT = peso * ratios[tipoDia].g;
    const chT = ((bmr * mults[tipoDia] * ajuste) - (pT * 4) - (gT * 9)) / 4;

    const obj = { p: pT * REPARTOS[comida].p, g: gT * REPARTOS[comida].g, ch: chT * REPARTOS[comida].ch };

    // SOLVER MEJORADO
    let gramos = ingredientesElegidos.map(() => 50);
    let cP = 0, cG = 0, cCH = 0;

    for(let i=0; i<3000; i++) {
        cP = 0; cG = 0; cCH = 0;
        ingredientesElegidos.forEach((al, idx) => {
            cP += (al.p * gramos[idx] / 100);
            cG += (al.g * gramos[idx] / 100);
            cCH += (al.ch * gramos[idx] / 100);
        });

        ingredientesElegidos.forEach((al, idx) => {
            let errorP = (obj.p - cP) * (al.p / 100);
            let errorG = (obj.g - cG) * (al.g / 100);
            let errorCH = (obj.ch - cCH) * (al.ch / 100);
            
            // Factor de aprendizaje dinámico
            gramos[idx] = Math.max(0, gramos[idx] + (errorP + errorG + errorCH) * 0.1);
        });
    }

    let res = `<div class="receta-box">
        <h3>${comida.toUpperCase()} - ${tipoDia}</h3>
        <p style="font-size:0.8rem; color:#666;">Objetivo: P:${obj.p.toFixed(1)}g | G:${obj.g.toFixed(1)}g | CH:${obj.ch.toFixed(1)}g</p>
        <hr style="opacity:0.2;">
        <ul style="list-style:none; padding:0; margin:15px 0;">`;

    ingredientesElegidos.forEach((al, i) => {
        if(gramos[i] > 0.5) {
            res += `<li style="margin-bottom:8px; font-size:1.1rem;">
                <strong>${Math.round(gramos[i])}g</strong> de ${al.nombre}
            </li>`;
        }
    });

    res += `</ul>
        <p style="font-size:0.75rem; color:#888; border-top:1px dashed #ccc; padding-top:10px;">
            Cuadre Final: P:${cP.toFixed(1)} | G:${cG.toFixed(1)} | CH:${cCH.toFixed(1)}
        </p>
    </div>`;
    
    document.getElementById('objetivoComidaDetalle').innerHTML = res;
    document.getElementById('objetivoComidaDetalle').scrollIntoView({ behavior: 'smooth' });
};
