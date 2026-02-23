/**
 * SISTEMA DE NUTRICIÓN CIENTÍFICO - MIQUEL V5
 * - Fix de sintaxis (llaves)
 * - Soporte para comas decimales europeas
 * - Edición manual con ajuste dinámico del resto de ingredientes
 */

let baseDatosAlimentos = [];
let ingredientesElegidos = [];

// Objetivos por comida según tu tabla de "Alta Intensidad"
const REPARTOS = {
    desayuno: { p: 15.0, g: 8.3, ch: 99.8 },
    comida:   { p: 58.5, g: 33.0, ch: 96.1 },
    merienda: { p: 12.0, g: 5.0, ch: 62.9 },
    cena:     { p: 64.5, g: 36.3, ch: 110.9 }
};

window.onload = function() {
    cargarDatosCSV();
};

async function cargarDatosCSV() {
    const statusDiv = document.getElementById('statusCsv');
    try {
        const respuesta = await fetch('./alimentos.csv?v=' + Date.now());
        const texto = await respuesta.text();
        const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
        const separador = lineas[0].includes(';') ? ';' : (lineas[0].includes('\t') ? '\t' : ',');
        
        baseDatosAlimentos = lineas.slice(1).map(linea => {
            const col = linea.split(separador);
            if (col.length >= 5) {
                // Función científica para limpiar el formato europeo (87,60 -> 87.6)
                const limpiar = (val) => {
                    if(!val) return 0;
                    let s = val.toString().trim().replace(/\./g, '').replace(',', '.');
                    return parseFloat(s) || 0;
                };
                return {
                    nombre: col[0].trim(),
                    kcal: limpiar(col[1]),
                    p: limpiar(col[2]),
                    g: limpiar(col[3]),
                    ch: limpiar(col[4])
                };
            }
            return null;
        }).filter(a => a !== null);

        if (statusDiv) statusDiv.innerHTML = `✅ ${baseDatosAlimentos.length} alimentos listos.`;
        poblarDatalist();
    } catch (e) { 
        if (statusDiv) statusDiv.innerHTML = "❌ Error al cargar CSV.";
    }
}

function poblarDatalist() {
    const dl = document.getElementById('listaIngredientes');
    if(!dl) return;
    dl.innerHTML = baseDatosAlimentos.map(al => `<option value="${al.nombre}">`).join('');
}

window.añadirAlimentoLista = function() {
    const input = document.getElementById('buscadorIngrediente');
    const al = baseDatosAlimentos.find(a => a.nombre.toLowerCase() === input.value.trim().toLowerCase());
    if (al && !ingredientesElegidos.find(i => i.nombre === al.nombre)) {
        ingredientesElegidos.push({...al, manual: false, gramos: 100});
        renderizarListaTags();
    }
    input.value = "";
};

function renderizarListaTags() {
    const cont = document.getElementById('ulSeleccionados');
    if(!cont) return;
    cont.innerHTML = ingredientesElegidos.map((al, i) => 
        `<span class="ingrediente-tag">${al.nombre} <b onclick="eliminar(${i})">✕</b></span>`
    ).join('');
}

window.eliminar = (i) => { ingredientesElegidos.splice(i, 1); renderizarListaTags(); };

/**
 * EL SOLVER: Ajusta los ingredientes no bloqueados para llegar al objetivo
 */
window.ejecutarSolverReceta = function() {
    if (ingredientesElegidos.length === 0) return;
    
    const comidaSel = document.getElementById('comidaSeleccionada').value;
    const obj = REPARTOS[comidaSel] || REPARTOS.desayuno;

    // Solver iterativo (3000 ciclos para máxima precisión)
    for(let i=0; i<3000; i++) {
        let actual = { p: 0, g: 0, ch: 0 };
        ingredientesElegidos.forEach(ing => {
            actual.p += (ing.p * ing.gramos / 100);
            actual.g += (ing.g * ing.gramos / 100);
            actual.ch += (ing.ch * ing.gramos / 100);
        });

        ingredientesElegidos.forEach(ing => {
            if (ing.manual) return; // Si el usuario lo fijó, no se toca

            // Algoritmo de aproximación por gradiente
            let errorP = (obj.p - actual.p) * (ing.p / 100);
            let errorG = (obj.g - actual.g) * (ing.g / 100);
            let errorCH = (obj.ch - actual.ch) * (ing.ch / 100);
            
            ing.gramos = Math.max(0, ing.gramos + (errorP + errorG + errorCH) * 0.1);
        });
    }
    dibujarTabla(obj);
};

function dibujarTabla(obj) {
    let t = { k:0, p:0, g:0, ch:0 };
    let html = `
    <div class="receta-box">
        <h4>OBJETIVO: P:${obj.p}g | G:${obj.g}g | CH:${obj.ch}g</h4>
        <table style="width:100%; font-size:0.9rem; border-collapse:collapse;">
            <tr style="background:#eee;"><th>Alimento</th><th>Cant.</th><th>Kcal</th><th>P</th><th>G</th><th>CH</th></tr>`;

    ingredientesElegidos.forEach((ing, i) => {
        const factor = ing.gramos / 100;
        const p = ing.p * factor, g = ing.g * factor, ch = ing.ch * factor, k = ing.kcal * factor;
        t.p += p; t.g += g; t.ch += ch; t.k += k;

        html += `<tr>
            <td>${ing.nombre}</td>
            <td><input type="number" value="${Math.round(ing.gramos)}" 
                onchange="actualizarGramos(${i}, this.value)" style="width:50px;">g</td>
            <td>${Math.round(k)}</td>
            <td>${p.toFixed(1)}</td>
            <td>${g.toFixed(1)}</td>
            <td>${ch.toFixed(1)}</td>
        </tr>`;
    });

    html += `<tr style="background:#d4edda; font-weight:bold;">
        <td>TOTAL REAL</td><td>-</td><td>${Math.round(t.k)}</td>
        <td>${t.p.toFixed(1)}</td><td>${t.g.toFixed(1)}</td><td>${t.ch.toFixed(1)}</td>
    </tr></table></div>`;
    
    document.getElementById('objetivoComidaDetalle').innerHTML = html;
}

window.actualizarGramos = function(index, valor) {
    ingredientesElegidos[index].gramos = parseFloat(valor);
    ingredientesElegidos[index].manual = true; // Bloqueamos este alimento
    window.ejecutarSolverReceta(); // Recalculamos el resto
};
