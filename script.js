/**
 * PLANIFICADOR NUTRICIONAL MIQUEL - VERSIÓN FINAL RECONSTRUIDA
 */

// Forzamos la lectura del archivo evitando la caché del navegador
const ARCHIVO_CSV = 'alimentos.csv?v=' + Math.random();

let baseDatosAlimentos = [];

// Repartos de macros por comida (porcentajes sobre el total diario)
const REPARTOS = {
    desayuno: { p: 0.10, g: 0.10, ch: 0.27 },
    comida:   { p: 0.39, g: 0.40, ch: 0.26 },
    merienda: { p: 0.08, g: 0.06, ch: 0.17 },
    cena:     { p: 0.43, g: 0.44, ch: 0.30 }
};

window.onload = function() {
    console.log("Iniciando carga de datos...");
    cargarAlimentos();
    
    // Configurar el slider de ajuste
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
        if (!response.ok) throw new Error("No se encuentra alimentos.csv en GitHub");
        
        const texto = await response.text();
        console.log("Contenido recibido:", texto.substring(0, 100)); // Debug en consola

        const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
        
        // Procesar líneas saltando la cabecera
        baseDatosAlimentos = lineas.slice(1).map((linea, index) => {
            // Detectar si el separador es coma o punto y coma
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
            statusDiv.innerHTML = `✅ <strong>${baseDatosAlimentos.length}</strong> alimentos cargados correctamente.`;
            document.getElementById('diseñador').style.display = 'block';
            renderizarSelector();
        } else {
            statusDiv.innerHTML = "⚠️ El CSV se leyó pero no se encontraron alimentos válidos.";
        }

    } catch (error) {
        statusDiv.innerHTML = `❌ Error: ${error.message}. Revisa el nombre del archivo en GitHub.`;
        console.error(error);
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

    let tabla = `<table><tr><th>Día</th><th>Kcal</th><th>P</th><th>G</th><th>CH</th></tr>`;
    
    intensidades.forEach(d => {
        const kcalTotal = bmr * d.m * ajuste;
        const pG = peso * d.p;
        const gG = peso * d.g;
        const chG = (kcalTotal - (pG * 4) - (gG * 9)) / 4;

        tabla += `<tr>
            <td><strong>${d.id}</strong></td>
            <td>${Math.round(kcalTotal)}</td>
            <td>${Math.round(pG)}g</td>
            <td>${Math.round(gG)}g</td>
            <td>${Math.round(chG)}g</td>
        </tr>`;
    });
    
    tabla += `</table>`;
    document.getElementById('tablaResumen').innerHTML = tabla;
    document.getElementById('resultados').style.display = 'block';
}

function renderizarSelector() {
    const contenedor = document.getElementById('selectorAlimentos');
    let html = '<h3>Ingredientes:</h3><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">';
    
    baseDatosAlimentos.forEach((al, idx) => {
        html += `
            <label style="background:#f9f9f9; padding:8px; border-radius:5px; border:1px solid #ddd; cursor:pointer; font-size:14px;">
                <input type="checkbox" value="${idx}" class="item-check"> ${al.nombre}
            </label>`;
    });
    
    html += '</div>';
    contenedor.innerHTML = html;
}

// Vinculamos el botón de calcular del HTML
document.addEventListener('click', function(e) {
    if(e.target && e.target.id === 'btnCalcular') {
        procesarReceta();
    }
});

function procesarReceta() {
    const comida = document.getElementById('comidaSeleccionada').value;
    const tipoDia = document.getElementById('tipoDiaSeleccionado').value;
    
    // Obtener objetivos de la tabla
    const filas = document.querySelectorAll('#tablaResumen tr');
    let objetivo = null
