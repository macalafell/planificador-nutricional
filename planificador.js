/**
 * LÓGICA DE CÁLCULO - VERSIÓN FINAL MIQUEL 1990
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
        const respuesta = await fetch('alimentos.csv?v=' + Date.now());
        if (!respuesta.ok) throw new Error("No se encuentra alimentos.csv");
        
        const texto = await respuesta.text();
        const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
        
        // Procesamiento robusto para comas decimales
        baseDatosAlimentos = lineas.slice(1).map(linea => {
            // Dividimos por tabulación o coma (depende de cómo guarde GitHub el preview)
            // Pero según tu captura, el separador de columna parece ser el espacio o tab en el preview
            // Vamos a usar una expresión regular que detecte el separador real
            const col = linea.split(/[,;\t]/); 
            
            if (col.length >= 5) {
                const limpiarNum = (val) => parseFloat(val.replace(',', '.').trim());
                return {
                    nombre: col[0].trim(),
                    kcal: limpiarNum(col[1]),
                    p:    limpiarNum(col[2]),
                    g:    limpiarNum(col[3]),
                    ch:   limpiarNum(col[4])
                };
            }
            return null;
        }).filter(a => a !== null && !isNaN(a.kcal));

        if (baseDatosAlimentos.length > 0) {
            statusDiv.innerHTML = `✅ <strong>${baseDatosAlimentos.length}</strong> alimentos cargados correctamente.`;
            document.getElementById('diseñador').style.display = 'block';
            generarChecks();
        } else {
            statusDiv.innerHTML = "⚠️ CSV leído pero vacío o con formato erróneo.";
        }
    } catch (e) {
        statusDiv.innerHTML = `❌ Error: ${e.message}`;
    }
}

function generarChecks() {
    const contenedor = document.getElementById('selectorAlimentos');
    let html = '<h3>Ingredientes:</h3><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">';
    baseDatosAlimentos.forEach((al, idx) => {
        html += `<label style="background:#eee; padding:8px; border-radius:4px; cursor:pointer;">
                    <input type="checkbox" value="${idx}" class="item-check"> ${al.nombre}
                 </label>`;
    });
    html += '</div>';
    contenedor.innerHTML = html;
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

    let tabla = `<table style="width:100%; border:1px solid #ccc;"><tr><th>Día</th><th>Kcal</th><th>P</th><th>G</th><th>CH</th></tr>`;
    intensidades.forEach(d => {
        const kcalTotal = bmr * d.m * ajuste;
        const pG = peso * d.p;
        const gG = peso * d.g;
        const chG = (kcalTotal - (pG * 4) - (gG * 9)) / 4;
        tabla += `<tr><td>${d.id}</td><td>${Math.round(kcalTotal)}</td><td>${Math.round(pG)}g</td><td>${Math.round(gG)}g</td><td>${Math.round(chG)}g</td></tr>`;
    });
    tabla += `</table>`;
    document.getElementById('tablaResumen').innerHTML = tabla;
    document.getElementById('resultados').style.display = 'block';
}

document.addEventListener('click', function(e) {
    if(e.target && e.target.id === 'btnCalcular') {
        const comida = document.getElementById('comidaSeleccionada').value;
        const tipoDia = document.getElementById('tipoDiaSeleccionado').value;
        const filas = document.querySelectorAll('#tablaResumen tr');
        let obj = null;

        filas.forEach(f => {
            if(f.cells[0].innerText === tipoDia) {
                obj = {
                    p: parseFloat(f.cells[2].innerText) * REPARTOS[comida].p,
                    g: parseFloat(f.cells[3].innerText) * REPARTOS[comida].g,
                    ch: parseFloat(f.cells[4].innerText) * REPARTOS[comida].ch
                };
            }
        });

        if(!obj) return alert("Calcula objetivos primero.");
        const elegidos = Array.from(document.querySelectorAll('.item-check:checked')).map(c => baseDatosAlimentos[c.value]);
        if(elegidos.length === 0) return alert("Selecciona alimentos.");

        let gramos = elegidos.map(() => 100);
        for(let i=0; i<500; i++) {
            let cP = 0, cG = 0, cCH = 0;
            elegidos.forEach((al, idx) => {
                cP += (al.p * gramos[idx] / 100); cG += (al.g * gramos[idx] / 100); cCH += (al.ch * gramos[idx] / 100);
            });
            elegidos.forEach((al, idx) => {
                let diff = 0;
                if (al.p > al.ch && al.p > al.g) diff = (obj.p - cP) * 0.2;
                else if (al.g > al.p && al.g > al.ch) diff = (obj.g - cG) * 0.2;
                else if (al.ch > al.p && al.ch > al.g) diff = (obj.ch - cCH) * 0.2;
                gramos[idx] = Math.max(0, gramos[idx] + diff);
            });
        }

        let resHTML = `<h4>Receta:</h4><ul>`;
        elegidos.forEach((al, i) => { resHTML += `<li><strong>${Math.round(gramos[i])}g</strong> de ${al.nombre}</li>`; });
        resHTML += `</ul>`;
        document.getElementById('objetivoComidaDetalle').innerHTML = resHTML;
    }
});
