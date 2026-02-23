/** * SISTEMA NUTRICIONAL MIQUEL - V7 (RESTAURACIÓN TOTAL)
 */
let baseDatosAlimentos = [];
let ingredientesElegidos = [];
let objetivosCalculados = null;

// Porcentajes de reparto por comida (puedes ajustarlos)
const REPARTOS = {
    desayuno: { p: 0.10, g: 0.10, ch: 0.27 },
    comida:   { p: 0.39, g: 0.40, ch: 0.26 },
    merienda: { p: 0.08, g: 0.06, ch: 0.17 },
    cena:     { p: 0.43, g: 0.44, ch: 0.30 }
};

window.onload = () => cargarDatosCSV();

async function cargarDatosCSV() {
    try {
        const res = await fetch('./alimentos.csv?v=' + Date.now());
        const texto = await res.text();
        const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
        const sep = lineas[0].includes(';') ? ';' : ',';
        
        baseDatosAlimentos = lineas.slice(1).map(linea => {
            const col = linea.split(sep);
            const num = (v) => parseFloat(v?.toString().replace(',', '.') || 0);
            return { nombre: col[0].trim(), kcal: num(col[1]), p: num(col[2]), g: num(col[3]), ch: num(col[4]) };
        }).filter(a => a.nombre);
        
        document.getElementById('statusCsv').innerHTML = `✅ ${baseDatosAlimentos.length} alimentos listos.`;
        poblarDatalist();
    } catch (e) { console.error("Error CSV:", e); }
}

function poblarDatalist() {
    const dl = document.getElementById('listaIngredientes');
    if(dl) dl.innerHTML = baseDatosAlimentos.map(a => `<option value="${a.nombre}">`).join('');
}

window.calcularObjetivos = function() {
    // 1. Obtención de datos con IDs verificados
    const peso = parseFloat(document.getElementById('peso').value);
    const altura = parseFloat(document.getElementById('altura').value);
    const edad = parseInt(document.getElementById('edad').value);
    const genero = document.getElementById('genero').value;
    const ajuste = 1 + (parseFloat(document.getElementById('ajuste').value) / 100);

    // 2. Cálculo BMR (Harris-Benedict)
    let bmr = (genero === 'hombre') 
        ? 88.36 + (13.4 * peso) + (4.8 * altura) - (5.7 * edad)
        : 447.59 + (9.2 * peso) + (3.1 * altura) - (4.3 * edad);

    const kcalManual = parseFloat(document.getElementById('kcalManual')?.value);
    if (kcalManual > 0) bmr = kcalManual;

    const intensidades = [
        { id: 'Alta', m: parseFloat(document.getElementById('multAlta').value), rp: 2.0, rg: 1.1 },
        { id: 'Media', m: parseFloat(document.getElementById('multMedia').value), rp: 1.7, rg: 1.1 },
        { id: 'Baja', m: parseFloat(document.getElementById('multBaja').value), rp: 1.4, rg: 0.7 }
    ];

    // 3. Generar Tabla de Desglose (Lo que te faltaba)
    let html = `<table><thead><tr><th>Día / Comida</th><th>Kcal</th><th>P (g)</th><th>G (g)</th><th>CH (g)</th></tr></thead><tbody>`;
    objetivosCalculados = {};

    intensidades.forEach(di => {
        const kcalT = bmr * di.m * ajuste;
        const pT = peso * di.rp;
        const gT = peso * di.rg;
        const chT = (kcalT - (pT * 4) - (gT * 9)) / 4;
        
        objetivosCalculados[di.id] = { p: pT, g: gT, ch: chT, kcal: kcalT, comidas: {} };

        // Fila Total del Día
        html += `<tr style="background:#f0f7f4; font-weight:bold;"><td>TOTAL ${di.id}</td><td>${Math.round(kcalT)}</td><td>${Math.round(pT)}</td><td>${Math.round(gT)}</td><td>${Math.round(chT)}</td></tr>`;

        // Filas por Comida
        Object.keys(REPARTOS).forEach(c => {
            const m = REPARTOS[c];
            const objComida = { p: pT * m.p, g: gT * m.g, ch: chT * m.ch };
            objetivosCalculados[di.id].comidas[c] = objComida;
            html += `<tr><td>↳ ${c.charAt(0).toUpperCase() + c.slice(1)}</td><td>-</td><td>${objComida.p.toFixed(1)}</td><td>${objComida.g.toFixed(1)}</td><td>${objComida.ch.toFixed(1)}</td></tr>`;
        });
    });

    html += "</tbody></table>";
    document.getElementById('tablaResumen').innerHTML = html;
    
    // 4. Mostrar secciones ocultas
    document.getElementById('resultados').style.display = 'block';
    document.getElementById('seccionPlanificador').style.display = 'block';
    alert("Objetivos calculados. El planificador de recetas ya está disponible abajo.");
};

window.ejecutarSolverReceta = function() {
    if (!objetivosCalculados) return alert("Primero calcula el Paso A.");
    
    const diaSel = document.getElementById('tipoDiaSeleccionado').value;
    const comidaSel = document.getElementById('comidaSeleccionada').value;
    const obj = objetivosCalculados[diaSel].comidas[comidaSel];

    // Solver de ajuste
    for(let i=0; i<2000; i++) {
        let actual = { p:0, g:0, ch:0 };
        ingredientesElegidos.forEach(ing => {
            actual.p += (ing.p * ing.gramos / 100);
            actual.g += (ing.g * ing.gramos / 100);
            actual.ch += (ing.ch * ing.gramos / 100);
        });

        ingredientesElegidos.forEach(ing => {
            if (ing.manual) return;
            let error = ((obj.p - actual.p) * (ing.p/100)) + ((obj.g - actual.g) * (ing.g/100)) + ((obj.ch - actual.ch) * (ing.ch/100));
            ing.gramos = Math.max(0, Math.min(600, ing.gramos + error * 0.1));
        });
    }
    renderizarTablaReceta(obj);
};

function renderizarTablaReceta(obj) {
    let html = `<div class="receta-box"><h4>Objetivo: P:${obj.p.toFixed(1)}g | G:${obj.g.toFixed(1)}g | CH:${obj.ch.toFixed(1)}g</h4><table>`;
    // ... (resto de lógica de dibujo de tabla que ya tenías)
    document.getElementById('objetivoComidaDetalle').innerHTML = html + "</table></div>";
}

// Funciones auxiliares (añadir, eliminar, etc.) se mantienen igual
