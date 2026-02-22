/**
 * LÓGICA NUTRICIONAL MIQUEL - VERSIÓN BUSCADOR DINÁMICO
 */

let baseDatosAlimentos = [];
let ingredientesElegidos = [];

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
        const respuesta = await fetch('./alimentos.csv?v=' + Date.now());
        if (!respuesta.ok) throw new Error("No se encuentra alimentos.csv");
        
        const texto = await respuesta.text();
        const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
        
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
            statusDiv.innerHTML = `✅ <strong>${baseDatosAlimentos.length}</strong> alimentos cargados.`;
            document.getElementById('diseñador').style.display = 'block';
            poblarDatalist();
        }
    } catch (e) {
        statusDiv.innerHTML = `❌ Error: ${e.message}`;
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

// FUNCIÓN PARA AÑADIR DESDE EL BUSCADOR
window.añadirAlimentoLista = function() {
    const input = document.getElementById('buscadorIngrediente');
    const nombre = input.value.trim();
    const alimento = baseDatosAlimentos.find(a => a.nombre.toLowerCase() === nombre.toLowerCase());

    if (alimento) {
        if (!ingredientesElegidos.find(i => i.nombre === alimento.nombre)) {
            ingredientesElegidos.push(alimento);
            renderizarListaElegidos();
            input.value = "";
        } else {
            alert("Este alimento ya está en la lista.");
        }
    } else {
        alert("Alimento no encontrado. Asegúrate de seleccionarlo del desplegable.");
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

window.calcularObjetivos = function() {
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
};

window.ejecutarSolverReceta = function() {
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

    if(!obj) return alert("Primero calcula los objetivos diarios en el Paso 2.");
    if(ingredientesElegidos.length === 0) return alert("Añade al menos un ingrediente con el buscador.");

    // SOLVER CIENTÍFICO
    let gramos = ingredientesElegidos.map(() => 100);
    for(let i=0; i<1000; i++) {
        let cP = 0, cG = 0, cCH = 0;
        ingredientesElegidos.forEach((al, idx) => {
            cP += (al.p * gramos[idx] / 100);
            cG += (al.g * gramos[idx] / 100);
            cCH += (al.ch * gramos[idx] / 100);
        });

        ingredientesElegidos.forEach((al, idx) => {
            let error = 0;
            if (al.p > al.ch && al.p > al.g) error = (obj.p - cP) * 0.1;
            else if (al.g > al.p && al.g > al.ch) error = (obj.g - cG) * 0.1;
            else if (al.ch > al.p && al.ch > al.g) error = (obj.ch - cCH) * 0.1;
            gramos[idx] = Math.max(0, gramos[idx] + error);
        });
    }

    let resHTML = `<div class="receta-box">
        <h4>Cantidades para tu ${comida} (${tipoDia}):</h4><ul>`;
    ingredientesElegidos.forEach((al, i) => {
        resHTML += `<li><strong>${Math.round(gramos[i])}g</strong> de ${al.nombre}</li>`;
    });
    resHTML += `</ul></div>`;
    document.getElementById('objetivoComidaDetalle').innerHTML = resHTML;
};
