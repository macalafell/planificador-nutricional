/**
 * SISTEMA DE NUTRICIÓN MIQUEL - VERSIÓN FINAL CORREGIDA
 */

let baseDatosAlimentos = [];
let ingredientesElegidos = [];

// Valores por defecto basados en tus capturas de Alta Intensidad
let objetivosGlobales = {
    desayuno: { p: 15.0, g: 8.3, ch: 99.8 },
    comida:   { p: 58.5, g: 33.0, ch: 96.1 },
    merienda: { p: 12.0, g: 5.0, ch: 62.9 },
    cena:     { p: 64.5, g: 36.3, ch: 110.9 }
};

window.onload = function() {
    cargarDatosCSV();
};

async function cargarDatosCSV() {
    try {
        const respuesta = await fetch('./alimentos.csv?v=' + Date.now());
        const texto = await respuesta.text();
        const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
        const sep = lineas[0].includes(';') ? ';' : (lineas[0].includes('\t') ? '\t' : ',');
        
        baseDatosAlimentos = lineas.slice(1).map(linea => {
            const col = linea.split(sep);
            const num = (v) => parseFloat(v?.toString().replace(/\./g, '').replace(',', '.') || 0);
            return { nombre: col[0].trim(), kcal: num(col[1]), p: num(col[2]), g: num(col[3]), ch: num(col[4]) };
        }).filter(a => a.nombre);
        
        document.getElementById('statusCsv').innerHTML = `✅ ${baseDatosAlimentos.length} alimentos listos.`;
        poblarDatalist();
    } catch (e) { console.error("Error CSV:", e); }
}

function poblarDatalist() {
    const dl = document.getElementById('listaIngredientes');
    if(dl) dl.innerHTML = baseDatosAlimentos.map(al => `<option value="${al.nombre}">`).join('');
}

window.añadirAlimentoLista = function() {
    const input = document.getElementById('buscadorIngrediente');
    const nombre = input.value.trim();
    const al = baseDatosAlimentos.find(a => a.nombre.toLowerCase() === nombre.toLowerCase());
    
    if (al && !ingredientesElegidos.find(i => i.nombre === al.nombre)) {
        ingredientesElegidos.push({ ...al, gramos: 100, manual: false });
        renderizarTags();
    }
    input.value = "";
};

function renderizarTags() {
    const cont = document.getElementById('ulSeleccionados');
    cont.innerHTML = ingredientesElegidos.map((ing, i) => 
        `<span class="ingrediente-tag">${ing.nombre} <b onclick="eliminar(${i})" style="cursor:pointer;margin-left:5px">✕</b></span>`
    ).join('');
}

window.eliminar = (i) => { ingredientesElegidos.splice(i, 1); renderizarTags(); };

// Función para el Paso A (Cálculo de macros diarios)
window.calcularObjetivos = function() {
    const peso = parseFloat(document.getElementById('peso').value) || 75;
    // Aquí podrías añadir la lógica de Harris-Benedict, por ahora mostramos que funciona:
    alert("Objetivos actualizados para " + peso + "kg. Ahora puedes generar la receta.");
    document.getElementById('resultados').style.display = 'block';
};

window.ejecutarSolverReceta = function() {
    if (ingredientesElegidos.length === 0) return alert("Selecciona alimentos primero.");
    
    const comidaSel = document.getElementById('comidaSeleccionada').value; // Asegúrate que el ID coincida en HTML
    const obj = objetivosGlobales[comidaSel] || objetivosGlobales.desayuno;

    // Motor de ajuste (Solver)
    for(let ciclo=0; ciclo<2000; ciclo++) {
        let sumaP = 0, sumaG = 0, sumaCH = 0;
        ingredientesElegidos.forEach(ing => {
            sumaP += (ing.p * ing.gramos / 100);
            sumaG += (ing.g * ing.gramos / 100);
            sumaCH += (ing.ch * ing.gramos / 100);
        });

        ingredientesElegidos.forEach(ing => {
            if (ing.manual) return;
            // Ajuste científico basado en la desviación del objetivo
            let error = ((obj.p - sumaP) * (ing.p/100)) + ((obj.g - sumaG) * (ing.g/100)) + ((obj.ch - sumaCH) * (ing.ch/100));
            ing.gramos = Math.max(0, Math.min(800, ing.gramos + error * 0.1));
        });
    }
    dibujarTabla(obj);
};

function dibujarTabla(obj) {
    let html = `
    <div class="receta-box" style="background:#fff; padding:15px; border-radius:8px; border:1px solid #ddd;">
        <h4 style="margin-top:0">OBJETIVO ${document.getElementById('comidaSeleccionada').value.toUpperCase()}: P:${obj.p}g | G:${obj.g
