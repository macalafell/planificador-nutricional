/**
 * PLANIFICADOR NUTRICIONAL MIQUEL - VERSIÓN ULTRA-PRECISA
 * Corrección de mapeo de macros y depuración de carga.
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
        
        // Detectar separador automáticamente (coma o punto y coma)
        const separador = lineas[0].includes(';') ? ';' : ',';
        
        baseDatosAlimentos = lineas.slice(1).map((linea, index) => {
            const col = linea.split(separador); 
            if (col.length >= 5) {
                const limpiarNum = (val) => {
                    if(!val) return 0;
                    // Elimina espacios, cambia comas por puntos y limpia caracteres no numéricos
                    let n = parseFloat(val.toString().replace(/\s/g, '').replace(',', '.'));
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

        console.log("Muestra de datos cargados:", baseDatosAlimentos.slice(0, 3));

        if (baseDatosAlimentos.length > 0) {
            statusDiv.innerHTML = `✅ ${baseDatosAlimentos.length} alimentos cargados.`;
            document.getElementById('diseñador').style.display = 'block';
            poblarDatalist();
        }
    } catch (e) { statusDiv.innerHTML = "❌ Error leyendo CSV."; }
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
    const al = baseDatosAlimentos.find(a => a.nombre.toLowerCase() === input.value.trim().toLowerCase());
    if (al) {
        if(!ingredientesElegidos.some(i => i.nombre === al.nombre)) {
            ingredientesElegidos.push(al);
            renderizarLista();
        }
        input.value = "";
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
    
    if (ingredientesElegidos.length === 0) return alert("Añade ingredientes.");

    // Cálculo de objetivos específicos
    const peso = parseFloat(document.getElementById('peso').value) || 75;
    const altura = parseFloat(document.getElementById('altura').value) || 180;
    const edad = parseInt(document.getElementById('edad').value) || 34;
    const ajuste = 1 + (parseFloat(document.getElementById('ajuste').value) / 100);
    const mults = { 'Alta': 1.6, 'Media': 1.45, 'Baja': 1.2 }; 
    ['Alta','Media','Baja'].forEach(id => {
        const el = document.getElementById('mult'+id);
        if(el) mults[id] = parseFloat(el.value);
    });
    
    const ratios = { 'Alta': {p:2, g:1.1}, 'Media': {p:1.7, g:1.1}, 'Baja': {p:1.4, g:0.7} };
    let bmr = (document.getElementById('genero').value === 'hombre') 
        ? 88.36 + (13.4 * peso) + (4.8 * altura) - (5.7 * edad)
        : 447.59 + (9.2 * peso) + (3.1 * altura) - (4.3 * edad);
    if (parseFloat(document.getElementById('kcalManual').value) > 0) bmr = parseFloat(document.getElementById('kcalManual').value);

    const pT = peso * ratios[tipoDia].p;
    const gT = peso * ratios[tipoDia].g;
    const chT = ((bmr * mults[tipoDia] * ajuste) - (pT * 4) - (gT * 9)) / 4;

    const obj = { p: pT * REPARTOS[comida].p, g: gT * REPARTOS[comida].g, ch: chT * REPARTOS[comida].ch };

    // SOLVER OPTIMIZADO: Ajuste multidimensional
    let gramos = ingredientesElegidos.map(() => 100); // Empezamos en 100g para evitar el 0
    let curP, curG, curCH;

    for(let i=0; i<5000; i++) {
        curP = 0; curG = 0; curCH = 0;
        ingredientesElegidos.forEach((al, idx) => {
            curP += (al.p * gramos[idx] / 100);
            curG += (al.g * gramos[idx] / 100);
            curCH += (al.ch * gramos[idx] / 100);
        });

        ingredientesElegidos.forEach((al, idx) => {
            // Calculamos qué nutriente es dominante en este alimento para ajustar principalmente ese
            let factor = 0.05;
            if (al.p > al.ch && al.p > al.g) gramos[idx] += (obj.p - curP) * factor;
            else if (al.g > al.p && al.g > al.ch) gramos[idx] += (obj.g - curG) * factor;
            else gramos[idx] += (obj.ch - curCH) * factor;
            
            gramos[idx] = Math.max(0, gramos[idx]);
        });
    }

    // RENDERIZADO FINAL
    let tKcal = 0, tP = 0, tG = 0, tCH = 0;
    let res = `<div class="receta-box">
        <h3>${comida.toUpperCase()} (${tipoDia})</h3>
        <p style="font-size:0.8rem; background:#f4f4f4; padding:8px;">
            <b>OBJETIVO:</b> ${obj.p.toFixed(1)}g P | ${obj.g.toFixed(1)}g G | ${obj.ch.toFixed(1)}g CH
        </p>
        <table style="width:100%; font-size:0.9rem; border-collapse:collapse;">
            <tr style="border-bottom:2px solid #ddd;"><th>Alimento</th><th>Cant.</th><th>P</th><th>G</th><th>CH</th></tr>`;

    ingredientesElegidos.forEach((al, i) => {
        if(gramos[i] > 1) {
            const aP = (al.p * gramos[i] / 100);
            const aG = (al.g * gramos[i] / 100);
            const aCH = (al.ch * gramos[i] / 100);
            tP += aP; tG += aG; tCH += aCH; tKcal += (al.kcal * gramos[i] / 100);

            res += `<tr style="border-bottom:1px solid #eee;">
                <td>${al.nombre}</td>
                <td><b>${Math.round(gramos[i])}g</b></td>
                <td>${aP.toFixed(1)}</td>
                <td>${aG.toFixed(1)}</td>
                <td>${aCH.toFixed(1)}</td>
            </tr>`;
        }
    });

    res += `<tr style="background:#e8f5e9; font-weight:bold;">
                <td colspan="2">TOTAL REAL</td>
                <td>${tP.toFixed(1)}</td>
                <td>${tG.toFixed(1)}</td>
                <td>${tCH.toFixed(1)}</td>
            </tr>
        </table>
    </div>`;
    
    document.getElementById('objetivoComidaDetalle').innerHTML = res;
};
