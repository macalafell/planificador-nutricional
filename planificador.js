/**
 * PLANIFICADOR NUTRICIONAL - MIQUEL (VERSIÓN FINAL COMPLETA)
 * Enfoque: Científico-Contable para Trail Running
 */

// Variables de estado global
let baseDatosAlimentos = [];
let ingredientesElegidos = [];

// Matriz de reparto (Porcentajes sobre el total de macros del día)
const REPARTOS = {
    desayuno: { p: 0.10, g: 0.10, ch: 0.27 },
    comida:   { p: 0.39, g: 0.40, ch: 0.26 },
    merienda: { p: 0.08, g: 0.06, ch: 0.17 },
    cena:     { p: 0.43, g: 0.44, ch: 0.30 }
};

window.onload = function() {
    console.log("Sistema cargado. Iniciando auditoría de datos...");
    cargarDatosCSV();
    
    // Configuración del Slider de Ajuste
    const slider = document.getElementById('ajuste');
    if(slider) {
        slider.oninput = function() {
            document.getElementById('valAjuste').innerText = this.value + '%';
        };
    }
};

/**
 * 1. CARGA Y PROCESAMIENTO DE DATOS (CSV)
 */
async function cargarDatosCSV() {
    const statusDiv = document.getElementById('statusCsv');
    try {
        // Cache busting con timestamp para evitar versiones antiguas
        const respuesta = await fetch('./alimentos.csv?v=' + Date.now());
        if (!respuesta.ok) throw new Error("Archivo alimentos.csv no encontrado en el servidor.");
        
        const texto = await respuesta.text();
        const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
        
        // Procesamiento con limpieza de comas decimales (formato contable ES)
        baseDatosAlimentos = lineas.slice(1).map(linea => {
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
            poblarDatalist();
        } else {
            statusDiv.innerHTML = "⚠️ El CSV se leyó pero no hay datos válidos. Revisa el formato.";
        }
    } catch (e) {
        statusDiv.innerHTML = `❌ Error de sistema: ${e.message}`;
        console.error(e);
    }
}

function poblarDatalist() {
    const dl = document.getElementById('listaIngredientes');
    dl.innerHTML = "";
    baseDatosAlimentos.forEach(al => {
        const opt = document.createElement('option');
        opt.value = al.nombre;
        dl.appendChild(opt);
    });
}

/**
 * 2. GESTIÓN DE LA LISTA DE INGREDIENTES (BUSCADOR)
 */
window.añadirAlimentoLista = function() {
    const input = document.getElementById('buscadorIngrediente');
    const nombre = input.value.trim();
    // Búsqueda insensible a mayúsculas
    const alimento = baseDatosAlimentos.find(a => a.nombre.toLowerCase() === nombre.toLowerCase());

    if (alimento) {
        if (!ingredientesElegidos.find(i => i.nombre === alimento.nombre)) {
            ingredientesElegidos.push(alimento);
            renderizarListaElegidos();
            input.value = "";
            input.focus();
        } else {
            alert("Este alimento ya está en la receta.");
        }
    } else {
        alert("Alimento no reconocido. Por favor, selecciona uno del desplegable.");
    }
};

function renderizarListaElegidos() {
    const ul = document.getElementById('ulSeleccionados');
    ul.innerHTML = "";
    ingredientesElegidos.forEach((al, index) => {
        const li = document.createElement('li');
        li.className = "ingrediente-tag";
        li.innerHTML = `
            <span>${al.nombre}</span>
            <span class="btn-remove" onclick="eliminarIngrediente(${index})">✕</span>
        `;
        ul.appendChild(li);
    });
}

window.eliminarIngrediente = function(index) {
    ingredientesElegidos.splice(index, 1);
    renderizarListaElegidos();
};

/**
 * 3. CÁLCULO DE OBJETIVOS DIARIOS (PASO 2)
 */
window.calcularObjetivos = function() {
    const peso = parseFloat(document.getElementById('peso').value);
    const altura = parseFloat(document.getElementById('altura').value);
    const edad = parseInt(document.getElementById('edad').value);
    const genero = document.getElementById('genero').value;
    const ajuste = 1 + (parseFloat(document.getElementById('ajuste').value) / 100);

    // Ecuación de Harris-Benedict revisada
    let bmr = (genero === 'hombre') 
        ? 88.36 + (13.4 * peso) + (4.8 * altura) - (5.7 * edad)
        : 447.59 + (9.2 * peso) + (3.1 * altura) - (4.3 * edad);

    // Sobrescritura manual si existe
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
};

/**
 * 4. SOLVER DE RECETA (PASO 4)
 */
window.ejecutarSolverReceta = function() {
    const comida = document.getElementById('comidaSeleccionada').value;
    const tipoDia = document.getElementById('tipoDiaSeleccionado').value;
    const tablaResumen = document.getElementById('tablaResumen');
    
    // Verificamos si existe la tabla de objetivos
    if (!tablaResumen.querySelector('table')) {
        alert("Primero debes calcular los Objetivos Diarios en el Paso 2.");
        return;
    }

    if (ingredientesElegidos.length === 0) {
        alert("Añade ingredientes a la receta usando el buscador.");
        return;
    }

    // Extraer objetivos específicos para la comida seleccionada
    let objComida = null;
    const filas = tablaResumen.querySelectorAll('tr');
    filas.forEach(f => {
        if(f.cells[0].innerText.includes(tipoDia)) {
            objComida = {
                p: parseFloat(f.cells[2].innerText) * REPARTOS[comida].p,
                g: parseFloat(f.cells[3].innerText) * REPARTOS[comida].g,
                ch: parseFloat(f.cells[4].innerText) * REPARTOS[comida].ch
            };
        }
    });

    // Algoritmo Solver: Ajuste iterativo de masas
    let gramos = ingredientesElegidos.map(() => 100); 
    const iteraciones = 1000;
    const factorAprendizaje = 0.1;

    for(let i=0; i < iteraciones; i++) {
        let actualP = 0, actualG = 0, actualCH = 0;
        
        // Calcular macros actuales con las cantidades de esta iteración
        ingredientesElegidos.forEach((al, idx) => {
            actualP += (al.p * gramos[idx] / 100);
            actualG += (al.g * gramos[idx] / 100);
            actualCH += (al.ch * gramos[idx] / 100);
        });

        // Ajustar cada ingrediente según su macro dominante para cerrar el error
        ingredientesElegidos.forEach((al, idx) => {
            let correccion = 0;
            if (al.p > al.ch && al.p > al.g) {
                correccion = (objComida.p - actualP) * factorAprendizaje;
            } else if (al.g > al.p && al.g > al.ch) {
                correccion = (objComida.g - actualG) * factorAprendizaje;
            } else {
                correccion = (objComida.ch - actualCH) * factorAprendizaje;
            }
            gramos[idx] = Math.max(0, gramos[idx] + correccion);
        });
    }

    // Renderizar Receta Final
    let resHTML = `<div class="receta-box">
        <h3>Cantidades para tu ${comida} (${tipoDia}):</h3>
        <p style="font-size:0.8rem; color:#555;">Objetivo parcial: P:${objComida.p.toFixed(1)}g | G:${objComida.g.toFixed(1)}g | CH:${objComida.ch.toFixed(1)}g</p>
        <ul style="font-weight:bold; font-size:1.1rem; border-top: 1px solid #aaa; padding-top:10px;">`;
    
    ingredientesElegidos.forEach((al, i) => {
        if(gramos[i] > 0.5) { // Evitamos mostrar trazas insignificantes
            resHTML += `<li>${Math.round(gramos[i])}g de ${al.nombre}</li>`;
        }
    });
    
    resHTML += `</ul></div>`;
    document.getElementById('objetivoComidaDetalle').innerHTML = resHTML;
    // Scroll suave al resultado
    document.getElementById('objetivoComidaDetalle').scrollIntoView({ behavior: 'smooth' });
};
