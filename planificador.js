/**
 * PLANIFICADOR NUTRICIONAL MIQUEL - TEST DE VERSIÓN
 */

// 1. CAMBIO VISUAL INMEDIATO PARA COMPROBAR ACTUALIZACIÓN
window.addEventListener('DOMContentLoaded', (event) => {
    // Cambiamos el título y el color para saber que el script es el nuevo
    document.querySelector('h1').innerText = "✅ SISTEMA ACTUALIZADO";
    document.getElementById('statusCsv').style.background = "#ffeaa7"; // Color crema/amarillo
    console.log("Script v2.0 cargado");
});

const ARCHIVO_CSV = 'alimentos.csv?v=' + Date.now();
let baseDatosAlimentos = [];

const REPARTOS = {
    desayuno: { p: 0.10, g: 0.10, ch: 0.27 },
    comida:   { p: 0.39, g: 0.40, ch: 0.26 },
    merienda: { p: 0.08, g: 0.06, ch: 0.17 },
    cena:     { p: 0.43, g: 0.44, ch: 0.30 }
};

window.onload = function() {
    cargarAlimentos();
    
    const slider = document.getElementById('ajuste');
    if(slider) {
        slider.oninput = function() {
            document.getElementById('valAjuste').innerText = this.value + '%';
        };
    }
};

async function cargarAlimentos() {
    const statusDiv = document.getElementById('statusCsv');
    try {
        const response = await fetch(ARCHIVO_CSV);
        if (!response.ok) throw new Error("No se encuentra el archivo .csv");
        
        const texto = await response.text();
        const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
        
        baseDatosAlimentos = lineas.slice(1).map(linea => {
            const columnas = linea.includes(';') ? linea.split(';') : linea.split(',');
            if (columnas.length >= 5) {
                return {
                    nombre: columnas[0].trim(),
                    kcal: parseFloat(columnas[1].replace(',', '.')),
                    p:    parseFloat(columnas[2].replace(',', '.')),
                    g:    parseFloat(columnas[3].replace(',', '.')),
                    ch:   parseFloat(columnas[4].replace(',', '.'))
                };
            }
            return null;
        }).filter(a => a !== null && !isNaN(a.kcal));

        if (baseDatosAlimentos.length > 0) {
            statusDiv.innerHTML = `✅ <strong>${baseDatosAlimentos.length}</strong> alimentos cargados.`;
            document.getElementById('diseñador').style.display = 'block';
            renderizarSelector();
        } else {
            statusDiv.innerHTML = "⚠️ CSV detectado pero sin datos válidos.";
        }

    } catch (error) {
        statusDiv.innerHTML = `❌ Error de carga: ${error.message}`;
    }
}

// ... (resto de funciones de cálculo que ya tienes) ...

function calcularObjetivos() {
    const peso = parseFloat(document.getElementById('peso').value);
    const altura = parseFloat(document.getElementById('altura').value);
    const edad = parseInt(document.getElementById('edad').value);
    const genero = document.getElementById('genero').value;
    const ajuste = 1 + (parseFloat(document.getElementById('ajuste').value) / 100);

    let bmr = (genero === 'hombre') 
        ? 88.36 + (13.4 * peso) + (4.8 * altura) - (5.7 * edad)
        : 447.59 + (9.2 * peso) + (3.1 * altura) - (4.3 * edad);

    const manualKcal = parseFloat(document.getElementById('kcalManual').value);
    if (!isNaN(manualKcal) && manualKcal > 0) bmr = manualKcal;

    const intensidades = [
        { id: 'Alta', m: parseFloat(document.getElementById('multAlta').value), p: 2.0, g: 1.1 },
        { id: 'Media', m: parseFloat(document.getElementById('multMedia').value), p: 1.7, g: 1.1 },
        { id: 'Baja', m: parseFloat(document.getElementById('multBaja').value), p: 1.4, g: 0.7 }
    ];

    let tabla = `<table><tr><th>Día</th><th>Kcal</th><th>P</th><th>G</th><th>CH</th></tr>`;
    intensidades.forEach(d => {
        const kcalTotal = bmr * d.m * ajuste;
        const pG = peso * d.p;
        const gG = peso * d.g;
        const chG = (kcalTotal - (pG * 4) - (gG * 9)) / 4;
        tabla += `<tr><td><strong>${d.id}</strong></td><td>${Math.round(kcalTotal)}</td><td>${Math.round(pG)}g</td><td>${Math.round(gG)}g</td><td>${Math.round(chG)}g</td></tr>`;
    });
    tabla += `</table>`;
    document.getElementById('tablaResumen').innerHTML = tabla;
    document.getElementById('resultados').style.display = 'block';
}

function renderizarSelector() {
    const contenedor = document.getElementById('selectorAlimentos');
    let html = '<h3>Ingredientes:</h3><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">';
    baseDatosAlimentos.forEach((al, idx) => {
        html += `<label style="background:#fff; padding:8px; border-radius:5px; border:1px solid #ddd; cursor:pointer;"><input type="checkbox" value="${idx}" class="item-check"> ${al.nombre}</label>`;
    });
    html += '</div>';
    contenedor.innerHTML = html;
}

document.addEventListener('click', function(e) {
    if(e.target && e.target.id === 'btnCalcular') procesarReceta();
});

function procesarReceta() {
    const comida = document.getElementById('comidaSeleccionada').value;
    const tipoDia = document.getElementById('tipoDiaSeleccionado').value;
    const filas = document.querySelectorAll('#tablaResumen tr');
    let objetivo = null;
    filas.forEach(f => {
        if(f.cells[0].innerText === tipoDia) {
            objetivo = {
                p: parseFloat(f.cells[2].innerText) * REPARTOS[comida].p,
                g: parseFloat(f.cells[3].innerText) * REPARTOS[comida].g,
                ch: parseFloat(f.cells[4].innerText) * REPARTOS[comida].ch
            };
        }
    });

    if(!objetivo) return alert("Calcula objetivos primero.");
    const elegidos = Array.from(document.querySelectorAll('.item-check:checked')).map(c => baseDatosAlimentos[c.value]);
    if(elegidos.length === 0) return alert("Selecciona alimentos.");

    let gramos = elegidos.map(() => 100);
    for(let i=0; i<500; i++) {
        let curP = 0, curG = 0, curCH = 0;
        elegidos.forEach((al, idx) => {
            curP += (al.p * gramos[idx] / 100); curG += (al.g * gramos[idx] / 100); curCH += (al.ch * gramos[idx] / 100);
        });
        elegidos.forEach((al, idx) => {
            let diff = 0;
            if (al.p > al.ch && al.p > al.g) diff = (objetivo.p - curP) * 0.2;
            else if (al.g > al.p && al.g > al.ch) diff = (objetivo.g - curG) * 0.2;
            else if (al.ch > al.p && al.ch > al.g) diff = (objetivo.ch - curCH) * 0.2;
            gramos[idx] = Math.max(0, gramos[idx] + diff);
        });
    }

    let resHTML = `<h4>Receta:</h4><ul>`;
    elegidos.forEach((al, i) => { resHTML += `<li><strong>${Math.round(gramos[i])}g</strong> de ${al.nombre}</li>`; });
    resHTML += `</ul>`;
    document.getElementById('objetivoComidaDetalle').innerHTML = resHTML;
}
