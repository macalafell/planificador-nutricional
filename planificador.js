/**
 * LÓGICA DE CÁLCULO - VERSIÓN DE PRODUCCIÓN REFORZADA
 */

let baseDatosAlimentos = [];

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
        // Referencia directa al archivo en tu raíz de GitHub
        const respuesta = await fetch('alimentos.csv?v=' + Date.now());
        if (!respuesta.ok) throw new Error("Archivo no encontrado");
        
        const texto = await respuesta.text();
        const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
        
        // Procesamos a partir de la segunda línea (saltamos cabecera)
        baseDatosAlimentos = lineas.slice(1).map(linea => {
            // Detectamos separador: si hay más de 4 comas, es que los decimales también son comas
            // Probamos primero con punto y coma, si no, usamos una técnica de limpieza
            let col = linea.split(',');
            
            // Si tu CSV tiene este formato: Arroz,362,7,00,0,60... (por culpa de las comas decimales)
            // Re-ensamblamos o detectamos el error. 
            // Basado en tu captura image_3de8de, tienes 5 columnas.
            if (col.length >= 5) {
                return {
                    nombre: col[0].trim(),
                    kcal: parseFloat(col[1].replace(',', '.')),
                    p:    parseFloat(col[2].replace(',', '.')),
                    g:    parseFloat(col[3].replace(',', '.')),
                    ch:   parseFloat(col[4].replace(',', '.'))
                };
            }
            return null;
        }).filter(a => a !== null && !isNaN(a.kcal));

        if (baseDatosAlimentos.length > 0) {
            statusDiv.innerHTML = `✅ <strong>${baseDatosAlimentos.length}</strong> alimentos cargados desde el CSV.`;
            document.getElementById('diseñador').style.display = 'block';
            generarChecksAlimentos();
        } else {
            statusDiv.innerHTML = "⚠️ El CSV se leyó pero no se pudieron procesar los datos. Revisa el formato.";
        }
    } catch (e) {
        statusDiv.innerHTML = `❌ Error de conexión: ${e.message}`;
    }
}

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

    let tabla = `<table><tr><th>Día</th><th>Kcal</th><th>P (g)</th><th>G (g)</th><th>CH (g)</th></tr>`;
    intensidades.forEach(d => {
        const kcalTotal = bmr * d.m * ajuste;
        const pG = peso * d.p;
        const gG = peso * d.g;
        const chG = (kcalTotal - (pG * 4) - (gG * 9)) / 4;
        tabla += `<tr><td><strong>${d.id}</strong></td><td>${Math.round(kcalTotal)}</td><td>${Math.round(pG)}</td><td>${Math.round(gG)}</td><td>${Math.round(chG)}</td></tr>`;
    });
    tabla += `</table>`;
    document.getElementById('tablaResumen').innerHTML = tabla;
    document.getElementById('resultados').style.display = 'block';
}

function generarChecksAlimentos() {
    const contenedor = document.getElementById('selectorAlimentos');
    let html = '<h3>Selecciona los ingredientes de tu comida:</h3><div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">';
    baseDatosAlimentos.forEach((al, idx) => {
        html += `<label style="background:#f4f4f4; padding:10px; border-radius:5px; cursor:pointer;">
                    <input type="checkbox" value="${idx}" class="item-check"> ${al.nombre}
                 </label>`;
    });
    html += '</div>';
    contenedor.innerHTML = html;
}

document.addEventListener('click', function(e) {
    if(e.target && e.target.id === 'btnCalcular') {
        ejecutarSolver();
    }
});

function ejecutarSolver() {
    const comida = document.getElementById('comidaSeleccionada').value;
    const tipoDia = document.getElementById('tipoDiaSeleccionado').value;
    const filas = document.querySelectorAll('#tablaResumen tr');
    let obj = null;

    filas.forEach(f => {
        if(f.cells[0].innerText.includes(tipoDia)) {
            obj = {
                p: parseFloat(f.cells[2].innerText) * REPARTOS[comida].p,
                g: parseFloat(f.cells[3].innerText) * REPARTOS[comida].g,
                ch: parseFloat(f.cells[4].innerText) * REPARTOS[comida].ch
            };
        }
    });

    if(!obj) return alert("Calcula los objetivos diarios primero.");
    const seleccionados = Array.from(document.querySelectorAll('.item-check:checked')).map(c => baseDatosAlimentos[c.value]);
    if(seleccionados.length === 0) return alert("Selecciona alimentos.");

    let gramos = seleccionados.map(() => 100);
    for(let i=0; i<1000; i++) {
        let cP = 0, cG = 0, cCH = 0;
        seleccionados.forEach((al, idx) => {
            cP += (al.p * gramos[idx] / 100);
            cG += (al.g * gramos[idx] / 100);
            cCH += (al.ch * gramos[idx] / 100);
        });
        seleccionados.forEach((al, idx) => {
            let err = 0;
            if (al.p > al.ch && al.p > al.g) err = (obj.p - cP) * 0.1;
            else if (al.g > al.p && al.g > al.ch) err = (obj.g - cG) * 0.1;
            else if (al.ch > al.p && al.ch > al.g) err = (obj.ch - cCH) * 0.1;
            gramos[idx] = Math.max(0, gramos[idx] + err);
        });
    }

    let resHTML = `<div style="background:#d1e7dd; padding:15px; border-radius:8px; margin-top:20px;">
        <h4>Receta calculada para tu ${comida}:</h4><ul>`;
    seleccionados.forEach((al, i) => {
        resHTML += `<li><strong>${Math.round(gramos[i])}g</strong> de ${al.nombre}</li>`;
    });
    resHTML += `</ul></div>`;
    document.getElementById('objetivoComidaDetalle').innerHTML = resHTML;
}
