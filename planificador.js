/**
 * PLANIFICADOR NUTRICIONAL MIQUEL - VERSIÓN AUDITORÍA TOTAL
 */

let baseDatosAlimentos = [];
let ingredientesElegidos = [];

const REPARTOS = {
    desayuno: { p: 0.10, g: 0.10, ch: 0.27, kcal: 0.20 }, // kcal aprox según macros
    comida:   { p: 0.39, g: 0.40, ch: 0.26, kcal: 0.32 },
    merienda: { p: 0.08, g: 0.06, ch: 0.17, kcal: 0.12 },
    cena:     { p: 0.43, g: 0.44, ch: 0.30, kcal: 0.36 }
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
    if(!dl) return;
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
    const al = baseDatosAlimentos.find(a => a.nombre.toLowerCase() === nombreSel.toLowerCase());
    
    if (al) {
        if(!ingredientesElegidos.some(i => i.nombre === al.nombre)) {
            ingredientesElegidos.push(al);
            renderizarLista();
        }
        input.value = "";
    } else {
        alert("Alimento no encontrado.");
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
            // Cálculo de Kcal por comida basado en el reparto de macros
            const kcalComida = (pT * rep.p * 4) + (gT * rep.g * 9) + (chT * rep.ch * 4);
            html += `<tr class="comida-fila">
                <td>&nbsp;&nbsp;↳ ${c.charAt(0).toUpperCase() + c.slice(1)}</td>
                <td>${Math.round(kcalComida)}</td>
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

    // Cálculo de objetivos (re-proceso para asegurar exactitud)
    const peso = parseFloat(document.getElementById('peso').value) || 75;
    const altura = parseFloat(document.getElementById('altura').value) || 180;
    const edad = parseInt(document.getElementById('edad').value) || 34;
    const ajuste = 1 + (parseFloat(document.getElementById('ajuste').value) / 100);
    const mults = { 'Alta': 1.6, 'Media': 1.45, 'Baja': 1.2 }; 
    // Sobreescribir mults con inputs si existen
    ['Alta','Media','Baja'].forEach(id => {
        const el = document.getElementById('mult'+id);
        if(el) mults[id] = parseFloat(el.value);
    });
    
    const ratios = { 'Alta': {p:2, g:1.1}, 'Media': {p:1.7, g:1.1}, 'Baja': {p:1.4, g:0.7} };

    let bmr = (document.getElementById('genero').value === 'hombre') 
        ? 88.36 + (13.4 * peso) + (4.8 * altura) - (5.7 * edad)
        : 447.59 + (9.2 * peso) + (3.1 * altura) - (4.3 * edad);
    
    const manual = parseFloat(document.getElementById('kcalManual').value);
    if (manual > 0) bmr = manual;

    const pT = peso * ratios[tipoDia].p;
    const gT = peso * ratios[tipoDia].g;
    const chT = ((bmr * mults[tipoDia] * ajuste) - (pT * 4) - (gT * 9)) / 4;

    const obj = { p: pT * REPARTOS[comida].p, g: gT * REPARTOS[comida].g, ch: chT * REPARTOS[comida].ch };

    // SOLVER
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
            gramos[idx] = Math.max(0, gramos[idx] + (errorP + errorG + errorCH) * 0.1);
        });
    }

    // RENDERIZADO CON DESGLOSE POR ALIMENTO
    let tKcal = 0, tP = 0, tG = 0, tCH = 0;
    
    let res = `<div class="receta-box">
        <h3 style="margin-bottom:5px;">${comida.toUpperCase()} (${tipoDia})</h3>
        <p style="font-size:0.85rem; color:#444; background:#eee; padding:5px; border-radius:4px;">
            <b>OBJETIVO:</b> ${obj.p.toFixed(1)}g P | ${obj.g.toFixed(1)}g G | ${obj.ch.toFixed(1)}g CH
        </p>
        <table class="tabla-receta-detalle">
            <thead>
                <tr>
                    <th>Alimento</th>
                    <th>Cant.</th>
                    <th>Kcal</th>
                    <th>P</th>
                    <th>G</th>
                    <th>CH</th>
                </tr>
            </thead>
            <tbody>`;

    ingredientesElegidos.forEach((al, i) => {
        if(gramos[i] > 1) {
            const aKcal = (al.kcal * gramos[i] / 100);
            const aP = (al.p * gramos[i] / 100);
            const aG = (al.g * gramos[i] / 100);
            const aCH = (al.ch * gramos[i] / 100);
            
            tKcal += aKcal; tP += aP; tG += aG; tCH += aCH;

            res += `<tr>
                <td>${al.nombre}</td>
                <td><b>${Math.round(gramos[i])}g</b></td>
                <td>${Math.round(aKcal)}</td>
                <td>${aP.toFixed(1)}</td>
                <td>${aG.toFixed(1)}</td>
                <td>${aCH.toFixed(1)}</td>
            </tr>`;
        }
    });

    res += `</tbody>
            <tfoot>
                <tr style="background:#f0f7f0; font-weight:bold;">
                    <td colspan="2">TOTAL REAL</td>
                    <td>${Math.round(tKcal)}</td>
                    <td>${tP.toFixed(1)}</td>
                    <td>${tG.toFixed(1)}</td>
                    <td>${tCH.toFixed(1)}</td>
                </tr>
            </tfoot>
        </table>
    </div>`;
    
    document.getElementById('objetivoComidaDetalle').innerHTML = res;
};
