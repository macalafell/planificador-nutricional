/**
 * PLANIFICADOR NUTRICIONAL CIENTÍFICO - MIQUEL 1990
 * Lógica: Harris-Benedict + Reparto Horeca + Solver de Macros
 */

// 1. CONFIGURACIÓN INICIAL (URL REAL DE MIQUEL)
const URL_GOOGLE_SHEET = 'alimentos.csv'; 

let baseDatosAlimentos = [];
const repartos = {
    desayuno: { p: 0.10, g: 0.10, ch: 0.27 },
    comida:   { p: 0.39, g: 0.40, ch: 0.26 },
    merienda: { p: 0.08, g: 0.06, ch: 0.17 },
    cena:     { p: 0.43, g: 0.44, ch: 0.30 }
};

// 2. CARGA AUTOMÁTICA DESDE GOOGLE DRIVE
window.onload = function() {
    fetch(URL_GOOGLE_SHEET)
        .then(response => {
            if (!response.ok) throw new Error("No se encuentra el archivo");
            return response.text();
        })
        .then(data => {
            const lineas = data.split(/\r?\n/).filter(linea => linea.trim() !== "");
            baseDatosAlimentos = lineas.slice(1).map(linea => {
                // ESTA LÍNEA ES LA CLAVE: Detecta coma o punto y coma
                const columnas = linea.includes(';') ? linea.split(';') : linea.split(',');
                const cols = columnas.map(col => col.trim().replace(',', '.')); // Cambia comas decimales por puntos
                
                if(cols.length >= 5) {
                    return { 
                        nombre: cols[0], 
                        kcal: parseFloat(cols[1]), 
                        p: parseFloat(cols[2]), 
                        g: parseFloat(cols[3]), 
                        ch: parseFloat(cols[4]) 
                    };
                }
            }).filter(a => a && !isNaN(a.kcal));

            document.getElementById('statusCsv').innerHTML = `✅ <strong>${baseDatosAlimentos.length}</strong> alimentos cargados desde GitHub.`;
            document.getElementById('diseñador').style.display = 'block';
            generarSelectorAlimentos();
        })
        .catch(err => {
            document.getElementById('statusCsv').innerText = "❌ Error al cargar alimentos.csv";
            console.error(err);
        });
};

// 3. CÁLCULOS DE OBJETIVOS DIARIOS
function calcularObjetivos() {
    const genero = document.getElementById('genero').value;
    const peso = parseFloat(document.getElementById('peso').value);
    const altura = parseFloat(document.getElementById('altura').value);
    const edad = parseInt(document.getElementById('edad').value);
    const kcalManual = parseFloat(document.getElementById('kcalManual').value);
    const ajuste = parseFloat(document.getElementById('ajuste').value) / 100;

    let bmr;
    if (kcalManual > 0) {
        bmr = kcalManual;
    } else {
        // Harris-Benedict Revisada
        bmr = (genero === 'hombre') 
            ? 88.362 + (13.397 * peso) + (4.799 * altura) - (5.677 * edad)
            : 447.593 + (9.247 * peso) + (3.098 * altura) - (4.330 * edad);
    }

    const intensidades = [
        { nombre: 'Alta', mult: parseFloat(document.getElementById('multAlta').value), gP: 2.0, gG: 1.1 },
        { nombre: 'Media', mult: parseFloat(document.getElementById('multMedia').value), gP: 1.7, gG: 1.1 },
        { nombre: 'Baja', mult: parseFloat(document.getElementById('multBaja').value), gP: 1.4, gG: 0.7 }
    ];

    let html = `<table><tr><th>Día</th><th>Kcal</th><th>Prot (g)</th><th>Grasa (g)</th><th>CH (g)</th></tr>`;

    intensidades.forEach(dia => {
        let kcalDia = (bmr * dia.mult) * (1 + ajuste);
        const grProt = peso * dia.gP;
        const grGrasa = peso * dia.gG;
        const kcalRestantes = kcalDia - (grProt * 4) - (grGrasa * 9);
        const grCH = kcalRestantes / 4;

        html += `<tr>
            <td><strong>${dia.nombre}</strong></td>
            <td>${Math.round(kcalDia)}</td>
            <td>${Math.round(grProt)}</td>
            <td>${Math.round(grGrasa)}</td>
            <td>${Math.round(grCH)}</td>
        </tr>`;
    });

    html += `</table>`;
    document.getElementById('tablaResumen').innerHTML = html;
    document.getElementById('resultados').style.display = 'block';
}

// 4. DISEÑADOR DE COMIDAS Y ALGORITMO "SOLVER"
function generarSelectorAlimentos() {
    let html = '<h3>Selecciona ingredientes de tu despensa:</h3><div class="alimentos-grid">';
    baseDatosAlimentos.forEach((al, i) => {
        html += `<label class="alimento-item"><input type="checkbox" value="${i}" class="alimento-check"> ${al.nombre}</label>`;
    });
    html += '</div>';
    document.getElementById('selectorAlimentos').innerHTML = html;
}

document.getElementById('btnCalcular').addEventListener('click', function() {
    const comida = document.getElementById('comidaSeleccionada').value;
    const tipoDia = document.getElementById('tipoDiaSeleccionado').value;
    
    const filaDia = Array.from(document.querySelectorAll('#tablaResumen tr'))
                         .find(tr => tr.cells[0].innerText === tipoDia);
    
    if(!filaDia) return alert("Primero pulsa el botón 'Calcular Objetivos Diarios'.");

    const target = {
        p: parseFloat(filaDia.cells[2].innerText) * repartos[comida].p,
        g: parseFloat(filaDia.cells[3].innerText) * repartos[comida].g,
        ch: parseFloat(filaDia.cells[4].innerText) * repartos[comida].ch
    };
    target.kcal = (target.p * 4) + (target.g * 9) + (target.ch * 4);

    const seleccionados = Array.from(document.querySelectorAll('.alimento-check:checked'))
                               .map(el => baseDatosAlimentos[parseInt(el.value)]);
    
    if (seleccionados.length === 0) return alert("Selecciona los alimentos que vas a usar en esta comida.");

    // SOLVER: Ajuste de gramos para minimizar el error (<2%)
    let gramos = seleccionados.map(() => 100); 
    for(let i=0; i<300; i++) {
        let actualP = seleccionados.reduce((acc, al, idx) => acc + (al.p * gramos[idx]/100), 0);
        let actualG = seleccionados.reduce((acc, al, idx) => acc + (al.g * gramos[idx]/100), 0);
        let actualCH = seleccionados.reduce((acc, al, idx) => acc + (al.ch * gramos[idx]/100), 0);

        seleccionados.forEach((al, idx) => {
            if (al.p > al.ch && al.p > al.g) gramos[idx] += (target.p - actualP) * 0.3;
            else if (al.g > al.p && al.g > al.ch) gramos[idx] += (target.g - actualG) * 0.3;
            else if (al.ch > al.p && al.ch > al.g) gramos[idx] += (target.ch - actualCH) * 0.3;
            else gramos[idx] += (target.kcal - (actualP*4 + actualG*9 + actualCH*4)) / 100; 
            
            if (gramos[idx] < 0) gramos[idx] = 0;
        });
    }

    mostrarResultadosFinales(seleccionados, gramos, target);
});

function mostrarResultadosFinales(alimentos, gramos, target) {
    let resHtml = `<h3>Tu Receta Calculada:</h3><ul class="lista-receta">`;
    let totP = 0, totG = 0, totCH = 0;

    alimentos.forEach((al, i) => {
        let g = Math.round(gramos[i]);
        resHtml += `<li><strong>${g}g</strong> de ${al.nombre}</li>`;
        totP += (al.p * g/100); totG += (al.g * g/100); totCH += (al.ch * g/100);
    });
    
    const totKcal = (totP * 4) + (totG * 9) + (totCH * 4);
    const error = Math.abs(((totKcal - target.kcal) / target.kcal) * 100).toFixed(2);

    resHtml += `</ul><div class="resumen-final">
        <p><strong>Total:</strong> ${Math.round(totKcal)} kcal (Objetivo: ${Math.round(target.kcal)})</p>
        <p><strong>Ajuste:</strong> ${error}% ${error <= 2 ? '✅' : '⚠️'}</p>
        <button onclick="exportarReceta()" style="background: #3498db;">Descargar Receta (CSV)</button>
    </div>`;

    document.getElementById('objetivoComidaDetalle').innerHTML = resHtml;
}

function exportarReceta() {
    let csvContent = "data:text/csv;charset=utf-8,Alimento,Gramos\n";
    const items = document.querySelectorAll('.lista-receta li');
    items.forEach(li => {
        const texto = li.innerText;
        const partes = texto.split(' de ');
        csvContent += `${partes[1]},${partes[0].replace('g', '')}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `receta_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
}

// Evento para el slider de ajuste
document.getElementById('ajuste').addEventListener('input', e => {
    document.getElementById('valAjuste').innerText = e.target.value + '%';
});
