// Variables Globales
let db = [];
let seleccionados = [];
let objetivosGlobales = null;

// Matriz de distribución Horeca
const REPARTOS = { 
    desayuno: {p: 0.10, g: 0.10, ch: 0.27}, 
    comida:   {p: 0.39, g: 0.40, ch: 0.26}, 
    merienda: {p: 0.08, g: 0.06, ch: 0.17}, 
    cena:     {p: 0.43, g: 0.44, ch: 0.30} 
};

// 1. CARGA Y PARSEO CIENTÍFICO DEL CSV
document.addEventListener("DOMContentLoaded", () => {
    fetch('alimentos.csv')
        .then(response => {
            if (!response.ok) throw new Error("No se encuentra el archivo CSV");
            return response.text();
        })
        .then(texto => {
            const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
            
            // Detectamos el separador de columnas (Punto y coma es estándar en Excel España)
            const delimitador = lineas[0].includes(';') ? ';' : ',';

            db = lineas.slice(1).map(linea => {
                // Función blindada para procesar la fila sin romper los decimales
                const columnas = parsearFilaCSV(linea, delimitador);
                
                return {
                    n: columnas[0] ? columnas[0].replace(/"/g, '').trim() : "Error",
                    kcal: limpiarNumero(columnas[1]),
                    p: limpiarNumero(columnas[2]),
                    g: limpiarNumero(columnas[3]),
                    ch: limpiarNumero(columnas[4])
                };
            }).filter(item => item.n !== "Error" && item.n !== "");

            document.getElementById('listaAlimentos').innerHTML = db.map(a => `<option value="${a.n}">`).join('');
            
            const statusDiv = document.getElementById('status');
            statusDiv.innerText = `✅ Base de datos lista: ${db.length} alimentos procesados.`;
            statusDiv.classList.add('status-ok');
        })
        .catch(error => {
            document.getElementById('status').innerText = `❌ Error crítico: ${error.message}`;
        });
});

// Función auxiliar para leer CSV respetando comillas
function parsearFilaCSV(linea, delimitador) {
    let resultado = [];
    let valorActual = '';
    let dentroComillas = false;

    for (let i = 0; i < linea.length; i++) {
        let char = linea[i];
        if (char === '"') {
            dentroComillas = !dentroComillas;
        } else if (char === delimitador && !dentroComillas) {
            resultado.push(valorActual);
            valorActual = '';
        } else {
            valorActual += char;
        }
    }
    resultado.push(valorActual);
    return resultado;
}

// Función auxiliar para convertir formato contable a número JS (ej. "47,50" -> 47.5)
function limpiarNumero(val) {
    if (!val) return 0;
    let limpio = val.replace(/"/g, '').trim();
    limpio = limpio.replace(',', '.'); // Crucial: convierte la coma decimal en punto
    return parseFloat(limpio) || 0;
}

// 2. CÁLCULO DE OBJETIVOS
function calcularObjetivos() {
    const p = parseFloat(document.getElementById('peso').value);
    const a = parseFloat(document.getElementById('altura').value);
    const e = parseFloat(document.getElementById('edad').value);
    const g = document.getElementById('genero').value;
    
    // Ecuación Mifflin-St Jeor
    const bmr = (g === 'hombre') ? (10 * p + 6.25 * a - 5 * e + 5) : (10 * p + 6.25 * a - 5 * e - 161);
    
    const config = [
        { id: 'Alta', m: parseFloat(document.getElementById('mAlta').value), rp: 2.0, rg: 1.1 },
        { id: 'Media', m: parseFloat(document.getElementById('mMedia').value), rp: 1.7, rg: 1.1 },
        { id: 'Baja', m: parseFloat(document.getElementById('mBaja').value), rp: 1.4, rg: 0.7 }
    ];
    
    objetivosGlobales = {};
    let html = `<table><tr><th>Comida</th><th>Kcal</th><th>Prot (g)</th><th>Grasa (g)</th><th>CH (g)</th></tr>`;
    
    config.forEach(d => {
        const kcalT = Math.round(bmr * d.m);
        const pT = p * d.rp;
        const gT = p * d.rg;
        const chT = (kcalT - (pT * 4) - (gT * 9)) / 4;
        
        objetivosGlobales[d.id] = { p: pT, g: gT, ch: chT, c: {} };
        html += `<tr class="total-row"><td>TOTAL ${d.id.toUpperCase()}</td><td>${kcalT}</td><td>${pT.toFixed(0)}</td><td>${gT.toFixed(0)}</td><td>${chT.toFixed(0)}</td></tr>`;
        
        for (let key in REPARTOS) {
            const m = REPARTOS[key];
            const objC = { p: pT * m.p, g: gT * m.g, ch: chT * m.ch };
            const kcalC = Math.round((objC.p * 4) + (objC.g * 9) + (objC.ch * 4));
            objetivosGlobales[d.id].c[key] = objC;
            html += `<tr><td>↳ ${key.charAt(0).toUpperCase() + key.slice(1)}</td><td>${kcalC}</td><td>${objC.p.toFixed(1)}</td><td>${objC.g.toFixed(1)}</td><td>${objC.ch.toFixed(1)}</td></tr>`;
        }
    });
    
    document.getElementById('tablaResumen').innerHTML = html + "</table>";
    document.getElementById('resultados').style.display = 'block';
    document.getElementById('seccionPlanificador').style.display = 'block';
}

// 3. GESTIÓN DE RECETA
function añadirAlimento() {
    const val = document.getElementById('buscador').value;
    const item = db.find(x => x.n === val);
    if (item) {
        // Añadimos previniendo duplicados visuales, partimos de 100g base
        seleccionados.push({...item, gramos: 100});
        document.getElementById('buscador').value = '';
        renderTags();
    } else {
        alert("Alimento no encontrado. Revisa la escritura.");
    }
}

function renderTags() {
    const contenedor = document.getElementById('tagsIngredientes');
    contenedor.innerHTML = seleccionados.map((s, i) => 
        `<span class="tag">${s.n} <b onclick="seleccionados.splice(${i},1);renderTags();">✕</b></span>`
    ).join('');
}

// 4. SOLVER MATEMÁTICO (PRIORIDAD CH -> P -> G)
function generarReceta() {
    if (seleccionados.length === 0) return alert("Añade al menos un alimento.");

    const d = document.getElementById('tipoDiaSel').value;
    const c = document.getElementById('comidaSel').value;
    const obj = objetivosGlobales[d].c[c];

    // Descenso de gradiente ponderado (5000 iteraciones para alta precisión)
    for (let i = 0; i < 5000; i++) {
        let curP = 0, curG = 0, curCH = 0;
        
        // Calcular valores actuales
        seleccionados.forEach(s => {
            curP += (s.p * s.gramos / 100);
            curG += (s.g * s.gramos / 100);
            curCH += (s.ch * s.gramos / 100);
        });

        // Calcular deltas (errores)
        let errP = obj.p - curP;
        let errG = obj.g - curG;
        let errCH = obj.ch - curCH;

        // Ajustar gramos priorizando fuertemente los CH
        seleccionados.forEach(s => {
            let impactoCH = errCH * (s.ch / 100) * 3.0; // Multiplicador de prioridad CH
            let impactoP  = errP  * (s.p / 100)  * 1.5; // Prioridad secundaria
            let impactoG  = errG  * (s.g / 100)  * 0.5; // Prioridad baja
            
            s.gramos = Math.max(1, s.gramos + (impactoCH + impactoP + impactoG) * 0.1);
        });
    }

    // Renderizado del desglose final
    let resHtml = `<h3>📊 Resultado Exacto para: ${c.charAt(0).toUpperCase() + c.slice(1)} (Día ${d})</h3>`;
    resHtml += `<table><tr><th>Alimento</th><th>Gramos</th><th>Kcal</th><th>Prot (g)</th><th>Grasa (g)</th><th>CH (g)</th></tr>`;
    
    let tP = 0, tG = 0, tCH = 0, tK = 0;
    
    seleccionados.forEach(s => {
        const pA = (s.p * s.gramos / 100);
        const gA = (s.g * s.gramos / 100);
        const chA = (s.ch * s.gramos / 100);
        const kA = (s.kcal * s.gramos / 100);
        
        tP += pA; tG += gA; tCH += chA; tK += kA;
        
        resHtml += `<tr>
            <td style="text-align:left;">${s.n}</td>
            <td><b>${Math.round(s.gramos)}g</b></td>
            <td>${Math.round(kA)}</td>
            <td>${pA.toFixed(1)}</td>
            <td>${gA.toFixed(1)}</td>
            <td>${chA.toFixed(1)}</td>
        </tr>`;
    });

    resHtml += `<tr class="total-row">
        <td style="text-align:right;">TOTAL REAL ALCANZADO:</td>
        <td>-</td>
        <td>${Math.round(tK)}</td>
        <td>${tP.toFixed(1)}</td>
        <td>${tG.toFixed(1)}</td>
        <td>${tCH.toFixed(1)}</td>
    </tr>`;
    resHtml += `</table>`;
    
    // Cuadro comparativo final
    resHtml += `<div style="background:#f8fafc; padding:10px; margin-top:10px; font-size:0.85rem; color:#64748b; border:1px solid #e2e8f0; border-radius:6px;">
        <b>Objetivo Teórico:</b> Prot: ${obj.p.toFixed(1)}g | Grasa: ${obj.g.toFixed(1)}g | CH: ${obj.ch.toFixed(1)}g
    </div>`;

    document.getElementById('resultadoReceta').innerHTML = resHtml;
}
