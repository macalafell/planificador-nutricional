/**
 * LÓGICA FINAL - PLANIFICADOR MIQUEL
 */

let baseDatosAlimentos = [];

const REPARTOS = {
    desayuno: { p: 0.10, g: 0.10, ch: 0.27 },
    comida:   { p: 0.39, g: 0.40, ch: 0.26 },
    merienda: { p: 0.08, g: 0.06, ch: 0.17 },
    cena:     { p: 0.43, g: 0.44, ch: 0.30 }
};

window.onload = function() {
    cargarDatos();
    
    // Configurar el slider para que se mueva el porcentaje visual
    const slider = document.getElementById('ajuste');
    if(slider) {
        slider.oninput = function() {
            document.getElementById('valAjuste').innerText = this.value + '%';
        };
    }
};

async function cargarDatos() {
    const statusDiv = document.getElementById('statusCsv');
    try {
        // Usamos una marca de tiempo para evitar la caché de Brave
        const respuesta = await fetch('alimentos.csv?v=' + Date.now());
        const texto = await respuesta.text();
        
        const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
        
        baseDatosAlimentos = lineas.slice(1).map(linea => {
            const col = linea.includes(';') ? linea.split(';') : linea.split(',');
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
            statusDiv.innerHTML = `✅ <strong>${baseDatosAlimentos.length}</strong> alimentos cargados correctamente.`;
            document.getElementById('diseñador').style.display = 'block';
            renderizarSelector();
        }
    } catch (e) {
        statusDiv.innerHTML = "❌ Error al cargar alimentos.csv";
    }
}

function calcularObjetivos() {
    const peso = parseFloat(document.getElementById('peso').value);
    const altura = parseFloat(document.getElementById('altura').value);
    const edad = parseInt(document.getElementById('edad').value);
    const genero = document.getElementById('genero').value;
    const ajuste = 1 + (parseFloat(document.getElementById('ajuste').value) / 100);

    // Harris-Benedict
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

    let tabla = `<table style="width:100%; border-collapse:collapse; margin-top:10px;">
        <tr style="background:#eee;">
            <th style="padding:8px; border:1px solid #ccc;">Día</th>
            <th style="padding:8px; border:1px solid #ccc;">Kcal</th>
            <th style="padding:8px; border:1px solid #ccc;">P</th>
            <th style="padding:8px; border:1px solid #ccc;">G</th>
            <th style="padding:8px; border:1px solid #ccc;">CH</th>
        </tr>`;
    
    intensidades.forEach(d => {
        const kcalTotal = bmr * d.m * ajuste;
        const pG = peso * d.p;
        const gG = peso * d.g;
        const chG = (kcalTotal - (pG * 4) - (gG * 9)) / 4;

        tabla += `<tr>
            <td style="padding:8px; border:1px solid #ccc;"><strong>${d.id}</strong></td>
            <td style="padding:8px; border:1px solid #ccc;">${Math.round(kcalTotal)}</td>
            <td style="padding:8px; border:1px solid #ccc;">${Math.round(pG)}g</td>
            <td style="padding:8px; border:1px solid #ccc;">${Math.round(gG)}g</td>
            <td style="padding:8px; border:1px solid #ccc;">${Math.round(chG)}g</td>
        </tr>`;
    });
    
    tabla += `</table>`;
    document.getElementById('tablaResumen').innerHTML = tabla;
    document.getElementById('resultados').style.display = 'block';
}

function renderizarSelector() {
    const contenedor = document.getElementById('selectorAlimentos');
    let html = '<h3>Selecciona ingredientes:</h3><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">';
    
    baseDatosAlimentos.forEach((al, idx) => {
        html += `
            <label style="background:#f9f9f9; padding:8px; border-radius:5px; border:1px solid #ddd; cursor:pointer; font-size:14px;">
                <input type="checkbox" value="${idx}" class="item-check"> ${al.nombre}
            </label>`;
    });
    
    html += '</div>';
    contenedor.innerHTML = html;
}

document.addEventListener('click', function(e) {
    if(e.target && e.target.id === 'btnCalcular') {
        procesarReceta();
    }
});

function procesarReceta() {
    const comida = document.getElementById('comidaSeleccionada').value;
    const tipoDia = document.getElementById('tipoDiaSeleccionado').value;
    const filas = document.querySelectorAll('#tablaResumen tr');
    let objetivo = null;

    filas.forEach(f => {
        if(f.cells[0].innerText.includes(tipoDia)) {
            objetivo = {
                p: parseFloat(f.cells[2].innerText) * REPARTOS[comida].p,
                g: parseFloat(f.cells[3].innerText) * REPARTOS[comida].g,
                ch: parseFloat(f.cells[4].innerText) * REPARTOS[comida].ch
            };
        }
    });

    if(!objetivo) return alert("Primero calcula los objetivos diarios.");

    const checks = document.querySelectorAll('.item-check:checked');
    const elegidos = Array.from(checks).map(c => baseDatosAlimentos[c.value]);

    if(elegidos.length === 0) return alert("Selecciona al menos un alimento.");

    // Solver simple de 3 variables
    let gramos = elegidos.map(() => 100);
    for(let i=0; i<500; i++) {
        let curP = 0, curG = 0, curCH = 0;
        elegidos.forEach((al, idx) => {
            curP += (al.p * gramos[idx] / 100);
            curG += (al.g * gramos[idx] / 100);
            curCH += (al.ch * gramos[idx] / 100);
        });

        elegidos.forEach((al, idx) => {
            let diff = 0;
            if (al.p > al.ch && al.p > al.g) diff = (objetivo.p - curP) * 0.2;
            else if (al.g > al.p && al.g > al.ch) diff = (objetivo.g - curG) * 0.2;
            else if (al.ch > al.p && al.ch > al.g) diff = (objetivo.ch - curCH) * 0.2;
            gramos[idx] = Math.max(0, gramos[idx] + diff);
        });
    }

    let resHTML = `<div style="background:#e8f4fd; padding:15px; border-radius:8px; margin-top:10px;">
        <h4>Cantidades para tu ${comida}:</h4><ul>`;
    elegidos.forEach((al, i) => {
        resHTML += `<li><strong>${Math.round(gramos[i])}g</strong> de ${al.nombre}</li>`;
    });
    resHTML += `</ul></div>`;
    document.getElementById('objetivoComidaDetalle').innerHTML = resHTML;
}
