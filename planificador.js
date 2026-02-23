/** * SISTEMA NUTRICIONAL MIQUEL V6 - FINAL STABLE
 * Auditoría de datos y Solver Dinámico con edición manual
 */

let baseDatosAlimentos = [];
let ingredientesElegidos = [];
let objetivosCalculados = null;

// Constantes de reparto científico según tu perfil
const REPARTOS = {
    desayuno: { p: 0.10, g: 0.10, ch: 0.27 },
    comida:   { p: 0.39, g: 0.40, ch: 0.26 },
    merienda: { p: 0.08, g: 0.06, ch: 0.17 },
    cena:     { p: 0.43, g: 0.44, ch: 0.30 }
};

window.onload = () => cargarDatosCSV();

async function cargarDatosCSV() {
    const status = document.getElementById('statusCsv');
    try {
        const res = await fetch('./alimentos.csv?v=' + Date.now());
        const texto = await res.text();
        const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
        const sep = lineas[0].includes(';') ? ';' : (lineas[0].includes('\t') ? '\t' : ',');
        
        baseDatosAlimentos = lineas.slice(1).map(linea => {
            const col = linea.split(sep);
            // Limpieza científica de números (soporta 87,60 y 87.60)
            const parse = (v) => {
                if(!v) return 0;
                let s = v.toString().replace(/\./g, '').replace(',', '.');
                return parseFloat(s) || 0;
            };
            return {
                nombre: col[0].trim(),
                kcal: parse(col[1]),
                p: parse(col[2]),
                g: parse(col[3]),
                ch: parse(col[4])
            };
        }).filter(a => a.nombre.length > 1);

        if(status) status.innerHTML = `✅ ${baseDatosAlimentos.length} alimentos cargados.`;
        poblarDatalist();
    } catch (e) {
        if(status) status.innerHTML = "❌ Error al leer alimentos.csv";
    }
}

function poblarDatalist() {
    const dl = document.getElementById('listaIngredientes');
    if(dl) dl.innerHTML = baseDatosAlimentos.map(a => `<option value="${a.nombre}">`).join('');
}

window.añadirAlimentoLista = function() {
    const input = document.getElementById('buscadorIngrediente');
    const al = baseDatosAlimentos.find(a => a.nombre.toLowerCase() === input.value.trim().toLowerCase());
    if (al && !ingredientesElegidos.find(i => i.nombre === al.nombre)) {
        ingredientesElegidos.push({ ...al, gramos: 100, manual: false });
        renderizarTags();
    }
    input.value = "";
};

function renderizarTags() {
    const cont = document.getElementById('ulSeleccionados');
    if(cont) cont.innerHTML = ingredientesElegidos.map((ing, i) => 
        `<span class="ingrediente-tag">${ing.nombre} <b onclick="eliminar(${i})">✕</b></span>`
    ).join('');
}

window.eliminar = (i) => { ingredientesElegidos.splice(i, 1); renderizarTags(); };

/** PASO A: CALCULAR GASTO DIARIO */
window.calcularObjetivos = function() {
    const peso = parseFloat(document.getElementById('peso').value) || 75;
    const altura = parseFloat(document.getElementById('altura').value) || 180;
    const edad = parseInt(document.getElementById('edad').value) || 34;
    const genero = document.getElementById('genero').value;
    const ajuste = 1 + (parseFloat(document.getElementById('ajuste').value) / 100);

    let bmr = (genero === 'hombre') 
        ? 88.36 + (13.4 * peso) + (4.8 * altura) - (5.7 * edad)
        : 447.59 + (9.2 * peso) + (3.1 * altura) - (4.3 * edad);

    const kcalManual = parseFloat(document.getElementById('kcalManual')?.value);
    if (kcalManual > 0) bmr = kcalManual;

    const dias = [
        { id: 'Alta', m: parseFloat(document.getElementById('multAlta').value) || 1.6, rp: 2.0, rg: 1.1 },
        { id: 'Media', m: parseFloat(document.getElementById('multMedia').value) || 1.45, rp: 1.7, rg: 1.1 },
        { id: 'Baja', m: parseFloat(document.getElementById('multBaja').value) || 1.2, rp: 1.4, rg: 0.7 }
    ];

    let html = `<table><tr><th>Día</th><th>Kcal</th><th>P</th><th>G</th><th>CH</th></tr>`;
    objetivosCalculados = {};

    dias.forEach(d => {
        const kcalT = bmr * d.m * ajuste;
        const pT = peso * d.rp;
        const gT = peso * d.rg;
        const chT = (kcalT - (pT * 4) - (gT * 9)) / 4;
        
        objetivosCalculados[d.id] = { p: pT, g: gT, ch: chT };
        html += `<tr class="dia-total"><td>${d.id}</td><td>${Math.round(kcalT)}</td><td>${Math.round(pT)}g</td><td>${Math.round(gT)}g</td><td>${Math.round(chT)}g</td></tr>`;
    });

    html += "</table>";
    document.getElementById('tablaResumen').innerHTML = html;
    document.getElementById('resultados').style.display = 'block';
};

/** PASO B: GENERADOR DE RECETA CON SOLVER */
window.ejecutarSolverReceta = function() {
    if (!objetivosCalculados || ingredientesElegidos.length === 0) {
        return alert("Primero calcula el Paso A y añade ingredientes.");
    }

    const tipoDia = document.getElementById('tipoDiaSeleccionado').value;
    const comida = document.getElementById('comidaSeleccionada').value;
    const objDia = objetivosCalculados[tipoDia] || objetivosCalculados.Alta;
    const rep = REPARTOS[comida];

    // Objetivo específico de esta comida
    const objetivo = {
        p: objDia.p * rep.p,
        g: objDia.g * rep.g,
        ch: objDia.ch * rep.ch
    };

    // SOLVER: 3000 iteraciones para equilibrar macros
    for(let n=0; n<3000; n++) {
        let actual = { p: 0, g: 0, ch: 0 };
        ingredientesElegidos.forEach(ing => {
            actual.p += (ing.p * ing.gramos / 100);
            actual.g += (ing.g * ing.gramos / 100);
            actual.ch += (ing.ch * ing.gramos / 100);
        });

        ingredientesElegidos.forEach(ing => {
            if (ing.manual) return; // Si el usuario lo editó, no se toca
            
            // Calculamos la influencia del alimento en los 3 macros
            let delta = ((objetivo.p - actual.p) * (ing.p/100)) + 
                        ((objetivo.g - actual.g) * (ing.g/100)) + 
                        ((objetivo.ch - actual.ch) * (ing.ch/100));
            
            ing.gramos = Math.max(1, Math.min(600, ing.gramos + delta * 0.1));
        });
    }
    renderizarTablaFinal(objetivo);
};

function renderizarTablaFinal(obj) {
    let tot = { k:0, p:0, g:0, ch:0 };
    let html = `
    <div class="receta-box">
        <h4>OBJETIVO: P:${obj.p.toFixed(1)}g | G:${obj.g.toFixed(1)}g | CH:${obj.ch.toFixed(1)}g</h4>
        <table style="width:100%; border-collapse:collapse;">
            <tr style="background:#f4f4f4;"><th>Alimento</th><th>Gramos</th><th>Kcal</th><th>P</th><th>G</th><th>CH</th></tr>`;

    ingredientesElegidos.forEach((ing, i) => {
        const f = ing.gramos / 100;
        const p = ing.p*f, g = ing.g*f, ch = ing.ch*f, k = ing.kcal*f;
        tot.p += p; tot.g += g; tot.ch += ch; tot.k += k;

        html += `<tr style="border-bottom:1px solid #eee;">
            <td>${ing.nombre}</td>
            <td><input type="number" value="${Math.round(ing.gramos)}" onchange="cambioManual(${i}, this.value)" style="width:60px">g</td>
            <td>${Math.round(k)}</td>
            <td>${p.toFixed(1)}</td>
            <td>${g.toFixed(1)}</td>
            <td>${ch.toFixed(1)}</td>
        </tr>`;
    });

    html += `<tr style="background:#e8f5e9; font-weight:bold;">
        <td>TOTAL REAL</td><td>-</td><td>${Math.round(tot.k)}</td>
        <td>${tot.p.toFixed(1)}</td><td>${tot.g.toFixed(1)}</td><td>${tot.ch.toFixed(1)}</td>
    </tr></table></div>`;
    
    document.getElementById('objetivoComidaDetalle').innerHTML = html;
}

window.cambioManual = function(idx, val) {
    ingredientesElegidos[idx].gramos = parseFloat(val) || 0;
    ingredientesElegidos[idx].manual = true;
    window.ejecutarSolverReceta(); // El resto de ingredientes se ajustan al nuevo valor
};
