// Protocolo de la revisión y trabajo con los estudios incluidos:
// extracción de datos, riesgo de sesgo (ROBINS-E) y mapa de Uruguay.
// Usa las funciones y datos globales de app.js ($, esc, api, toast, cargar, R, EXT, SES, PROT, rol, clave).

/* ---------- Protocolo ---------- */
const CAMPOS_PROT = [
  ["titulo", "Título de la revisión", 1],
  ["pregunta", "Pregunta de investigación", 3],
  ["poblacion", "P · Población", 2],
  ["exposicion", "E · Exposición", 2],
  ["comparador", "C · Comparador", 2],
  ["desenlaces", "O · Desenlaces en salud", 2],
  ["disenos", "Diseños de estudio elegibles", 2],
  ["inclusion", "Criterios de inclusión", 4],
  ["exclusion", "Criterios de exclusión", 4],
  ["periodo", "Período e idiomas", 1],
  ["prospero", "Registro en PROSPERO (número)", 1],
  ["herramientaSesgo", "Herramienta de riesgo de sesgo", 1],
  ["palabrasIncluir", "Palabras a resaltar en verde al cribar: interés principal (separadas por coma)", 3],
  ["palabrasSecundarias", "Palabras a resaltar en azul al cribar: interés secundario (separadas por coma)", 2],
  ["palabrasExcluir", "Palabras a resaltar en rojo al cribar (separadas por coma)", 2],
];
const PROT_EJEMPLO = {
  pregunta: "¿Cuáles son los efectos en la salud humana de la exposición a cianobacterias (cianotoxinas) y agrotóxicos presentes en el agua de consumo humano en Uruguay? De forma secundaria: ¿y de la exposición a trihalometanos, sodio y cloruros, nitratos, metales pesados y microplásticos?",
  poblacion: "Personas (cualquier edad) que viven en Uruguay y consumen agua de la canilla o de otras fuentes de agua para beber.",
  exposicion: "Agua de consumo humano (red pública de OSE, pozos, aljibes u otras fuentes para beber) con cianobacterias o cianotoxinas (microcistinas, saxitoxinas, cilindrospermopsina, anatoxinas) o agrotóxicos (glifosato y AMPA, atrazina, 2,4-D, clorpirifos, endosulfán, imidacloprid, otros plaguicidas). Interés secundario: trihalometanos y otros subproductos de la desinfección, sodio y cloruros (crisis hídrica de 2023), nitratos y nitritos, metales pesados (arsénico, plomo) y microplásticos.",
  comparador: "Personas no expuestas o con menor exposición, o niveles por debajo de la norma de agua potable.",
  desenlaces: "Cualquier efecto en la salud humana: síntomas gastrointestinales, daño hepático, efectos neurológicos, cáncer, efectos reproductivos o en el desarrollo, intoxicaciones agudas, biomarcadores de exposición en personas.",
  disenos: "Estudios observacionales (cohortes, casos y controles, transversales, ecológicos), series de casos, informes de brotes y estudios de evaluación de riesgo en salud humana.",
  inclusion: "Estudios realizados en Uruguay.\nEvalúan agua de consumo humano (agua de canilla, red pública u otra fuente para beber).\nEvalúan exposición a cianobacterias/cianotoxinas o a agrotóxicos (interés principal), o a trihalometanos, sodio y cloruros, nitratos, metales pesados o microplásticos (interés secundario).\nReportan al menos un efecto en la salud humana o un biomarcador de exposición en personas.",
  exclusion: "Estudios fuera de Uruguay.\nAgua recreativa (playas, balnearios, baños), agua residual o de riego sin relación con el agua para beber.\nSalud animal, estudios en animales o in vitro.\nEstudios solo ambientales, sin ningún resultado en salud humana.\nContaminantes que no son de interés principal ni secundario (por ejemplo, contaminación microbiológica).\nEditoriales y revisiones narrativas (se usan para rastrear referencias).",
  herramientaSesgo: "ROBINS-E",
};
function renderProtocolo() {
  const editable = !!(clave && rol && rol.admin);
  $("#prot-form").innerHTML = CAMPOS_PROT.map(([k, l, filas]) => {
    const v = PROT[k] ?? ({ palabrasIncluir: PAL_INCLUIR, palabrasSecundarias: PAL_SECUNDARIAS, palabrasExcluir: PAL_EXCLUIR }[k] || "");
    const ph = PROT_EJEMPLO[k] ? ` placeholder="Ejemplo: ${esc(PROT_EJEMPLO[k])}"` : "";
    return `<label>${esc(l)}${filas > 1 ? `<textarea id="p-${k}" rows="${filas}"${ph}${editable ? "" : " disabled"}>${esc(v)}</textarea>` : `<input id="p-${k}" value="${esc(v)}"${ph}${editable ? "" : " disabled"}>`}</label>`;
  }).join("");
  $("#prot-acciones").hidden = !editable;
  const ult = H.filter(h => h.accion === "Protocolo actualizado").slice(-1)[0];
  $("#prot-estado").textContent = ult ? "Última actualización: " + fdt(ult.fecha) : "Todavía no se guardó el protocolo.";
  $("#crib-criterios").innerHTML = PROT.inclusion || PROT.exclusion
    ? `<b>Inclusión</b><div class="abs">${esc(PROT.inclusion || "—")}</div><b>Exclusión</b><div class="abs">${esc(PROT.exclusion || "—")}</div>`
    : `<span class="meta">Carga los criterios en la pestaña Protocolo para verlos aquí.</span>`;
}
$("#prot-ejemplo").onclick = () => {
  Object.entries(PROT_EJEMPLO).forEach(([k, v]) => { const el = $("#p-" + k); if (el && !el.value.trim()) el.value = v });
  toast("Completé los campos vacíos con un ejemplo. Revísalos y guarda.");
};
$("#prot-guardar").onclick = async () => {
  const datos = Object.fromEntries(CAMPOS_PROT.map(([k]) => [k, $("#p-" + k).value.trim()]));
  const b = $("#prot-guardar"); b.disabled = true; b.textContent = "Guardando…";
  try { await api("guardarProtocolo", datos); toast("Protocolo guardado"); await cargar(true) }
  catch (e) { toast(e.message === "Acción desconocida." ? "Falta actualizar el motor (Apps Script) para guardar el protocolo." : "No se pudo guardar: " + e.message, 6000) }
  finally { b.disabled = false; b.textContent = "Guardar protocolo" }
};

/* ---------- Mapa esquemático de Uruguay ---------- */
// Cada cuadro es un departamento, ubicado aproximadamente según el mapa
const TEJAS = [
  ["Artigas", 2, 0], ["Salto", 1, 1], ["Rivera", 3, 1], ["Paysandú", 0, 2], ["Tacuarembó", 2, 2], ["Cerro Largo", 3, 2],
  ["Río Negro", 0, 3], ["Durazno", 2, 3], ["Treinta y Tres", 3, 3], ["Soriano", 0, 4], ["Flores", 1, 4], ["Florida", 2, 4],
  ["Lavalleja", 3, 4], ["Rocha", 4, 4], ["Colonia", 0, 5], ["San José", 1, 5], ["Canelones", 2, 5], ["Maldonado", 3, 5], ["Montevideo", 2, 6],
];
const normal = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function conteoDepartamentos() {
  const incluidos = new Set(R.filter(r => r.estadoK === "inc").map(r => r.codigo));
  const c = Object.fromEntries(TEJAS.map(([d]) => [d, 0])); let pais = 0;
  EXT.filter(e => incluidos.has(e.codigo)).forEach(e => {
    const t = normal(e.departamento);
    if (/todo el pais|nacional|todos los departamentos/.test(t)) pais++;
    TEJAS.forEach(([d]) => { if (new RegExp(`(^|[^a-z])${normal(d)}([^a-z]|$)`).test(t)) c[d]++ });
  });
  return { c, pais };
}
function mapaSvg() {
  const { c, pais } = conteoDepartamentos(), max = Math.max(1, ...Object.values(c));
  const S = 92, G = 6;
  const tejas = TEJAS.map(([d, x, y]) => {
    const n = c[d], nivel = n ? Math.ceil((n / max) * 4) : 0;
    return `<g><rect class="t${nivel}" x="${x * (S + G)}" y="${y * (S + G)}" width="${S}" height="${S}" rx="8"/>
      <text class="tn" x="${x * (S + G) + S / 2}" y="${y * (S + G) + 40}" text-anchor="middle">${d.length > 11 ? d.replace(" y ", " y ").split(" ").map((p, i, a) => `<tspan x="${x * (S + G) + S / 2}" dy="${i ? 13 : (a.length > 1 ? -6 : 0)}">${esc(p)}</tspan>`).join("") : esc(d)}</text>
      <text class="tc" x="${x * (S + G) + S / 2}" y="${y * (S + G) + 72}" text-anchor="middle">${n || "–"}</text></g>`;
  }).join("");
  return { svg: `<svg viewBox="-4 -4 ${5 * (S + G) + 4} ${7 * (S + G) + 4}" role="img" aria-label="Estudios incluidos por departamento">${tejas}</svg>`, pais };
}

/* ---------- Estudios incluidos ---------- */
const NIVELES = ["Bajo riesgo", "Algunas preocupaciones", "Alto riesgo", "Muy alto riesgo", "Sin información"];
const DOMINIOS = [
  ["d1", "Confusión", "¿Se controlaron los factores que influyen a la vez en la exposición y en el desenlace (edad, nivel socioeconómico, otras fuentes de exposición…)?"],
  ["d2", "Medición de la exposición", "¿La exposición al agua (contaminante, consumo) se midió bien y de la misma forma en todos?"],
  ["d3", "Selección de participantes", "¿La forma de elegir a los participantes pudo relacionarse con la exposición y el desenlace?"],
  ["d4", "Intervenciones posteriores a la exposición", "¿Hubo cambios después de la exposición (filtros, cambio de fuente de agua) que afecten los resultados?"],
  ["d5", "Datos faltantes", "¿Faltan datos de exposición, desenlace o participantes, y eso pudo sesgar el resultado?"],
  ["d6", "Medición del desenlace", "¿El desenlace en salud se midió bien y sin conocer la exposición?"],
  ["d7", "Selección del resultado reportado", "¿Eligieron qué resultado mostrar según lo que salió (entre varios análisis o medidas)?"],
];
const claseNivel = v => ({ "Bajo riesgo": "rb", "Algunas preocupaciones": "rm", "Alto riesgo": "ra", "Muy alto riesgo": "rv", "Sin información": "rs" }[v] || "");
const CAMPOS_EXT = [
  ["diseno", "Diseño del estudio", 1, "Transversal, cohorte, casos y controles, ecológico…"],
  ["poblacion", "Población", 2, "Quiénes, edad, dónde"], ["n", "Tamaño de muestra", 1, ""],
  ["periodo", "Período del estudio", 1, "Años de recolección de datos"],
  ["fuente", "Fuente de agua", 1, "Agua de canilla (red OSE), pozo, aljibe…"],
  ["contaminante", "Exposición / contaminante", 1, "Cianotoxina o agrotóxico, y cuál (microcistina, glifosato…)"],
  ["medicionExp", "Medición de la exposición", 2, "Cómo y dónde se midió"],
  ["desenlace", "Desenlace en salud", 1, ""], ["medicionDes", "Medición del desenlace", 2, ""],
  ["efecto", "Medida de efecto", 1, "OR, RR, diferencia de medias, prevalencia…"],
  ["resultados", "Resultados principales", 3, "Con intervalos de confianza si los hay"],
  ["confusores", "Ajuste por confusores", 2, ""], ["financiamiento", "Financiamiento / conflictos de interés", 1, ""],
  ["notas", "Notas", 2, ""],
];
/* ---------- Categorías para el mapa de evidencia ---------- */
const CAT_EXP = ["Cianotoxinas", "Agrotóxicos", "Trihalometanos", "Sodio y cloruros", "Nitratos", "Metales pesados", "Microplásticos"];
const CAT_DES = ["Gastrointestinal", "Hepático", "Neurológico", "Cáncer", "Reproductivo y desarrollo", "Renal", "Cardiovascular / presión arterial", "Intoxicación aguda", "Biomarcadores de exposición", "Otro"];
const chips = (id, opciones, valor) => {
  const sel = new Set(String(valor || "").split(/;\s*/).filter(Boolean));
  return opciones.map(o => `<label class="chk"><input type="checkbox" value="${esc(o)}"${sel.has(o) ? " checked" : ""}> ${esc(o)}</label>`).join("");
};
const leerChips = id => [...$(id).querySelectorAll("input:checked")].map(i => i.value).join("; ");

/* ---------- Mapa de evidencia: exposición × efecto en salud ---------- */
function mapaEvidencia() {
  const incl = new Set(R.filter(r => r.estadoK === "inc").map(r => r.codigo));
  const ext = EXT.filter(e => incl.has(e.codigo) && e.expCat && e.desCat);
  if (!ext.length) return `<div class="empty">El mapa de evidencia aparece cuando, en la extracción de datos, marques la categoría de exposición y de efecto en salud de los estudios incluidos.</div>`;
  const celdas = {}; let max = 1;
  ext.forEach(e => e.expCat.split(/;\s*/).forEach(x => e.desCat.split(/;\s*/).forEach(d => {
    const k = x + "|" + d; (celdas[k] = celdas[k] || []).push(e.codigo); max = Math.max(max, celdas[k].length);
  })));
  const filas = CAT_EXP.filter(x => ext.some(e => e.expCat.includes(x))), cols = CAT_DES.filter(d => ext.some(e => e.desCat.includes(d)));
  const CW = 92, RH = 54, L = 150, T = 90, W = L + cols.length * CW + 90, H = T + filas.length * RH + 10;
  let svg = cols.map((d, j) => `<text class="eje" transform="translate(${L + j * CW + CW / 2} ${T - 8}) rotate(-30)" text-anchor="start">${esc(d)}</text>`).join("");
  filas.forEach((x, i) => {
    const y = T + i * RH + RH / 2;
    svg += `<text class="eje fila" x="${L - 10}" y="${y + 4}" text-anchor="end">${esc(x)}</text><line class="grid" x1="${L}" x2="${W - 90}" y1="${y}" y2="${y}"/>`;
    cols.forEach((d, j) => {
      const est = celdas[x + "|" + d] || [], cx = L + j * CW + CW / 2;
      if (!est.length) { svg += `<circle class="vacio" cx="${cx}" cy="${y}" r="3"/>`; return }
      const r = 9 + 15 * Math.sqrt(est.length / max);
      svg += `<g class="burb"><title>${esc(x)} × ${esc(d)}: ${est.length} estudio${est.length === 1 ? "" : "s"} (${est.join(", ")})</title><circle cx="${cx}" cy="${y}" r="${r}"/><text x="${cx}" y="${y + 5}" text-anchor="middle">${est.length}</text></g>`;
    });
  });
  return `<div class="tabla"><svg class="evid" viewBox="0 0 ${W} ${H}" style="min-width:${Math.min(W, 640)}px">${svg}</svg></div>
    <p class="note">Cada burbuja muestra cuántos estudios incluidos evalúan esa exposición y ese efecto en salud (pasa el dedo o el mouse para ver cuáles). Los puntitos son vacíos de evidencia.</p>`;
}

/* ---------- Certeza de la evidencia (GRADE) ---------- */
const GR_NIVELES = { sesgo: ["No serio", "Serio", "Muy serio"], inconsistencia: ["No seria", "Seria", "Muy seria"], indirecta: ["No seria", "Seria", "Muy seria"], imprecision: ["No seria", "Seria", "Muy seria"], publicacion: ["No detectado", "Sospechado"] };
const GR_CERTEZA = ["Alta", "Moderada", "Baja", "Muy baja"];
const GR_SIMB = { "Alta": "⊕⊕⊕⊕", "Moderada": "⊕⊕⊕◯", "Baja": "⊕⊕◯◯", "Muy baja": "⊕◯◯◯" };
function certezaSugerida(g) {
  // Observacionales empiezan en «Baja» (4 = alta … 1 = muy baja); bajan por cada problema y suben por factores a favor
  let n = /aleatoriz|ensayo/i.test(g.diseno || "") ? 4 : 2;
  ["sesgo", "inconsistencia", "indirecta", "imprecision"].forEach(k => { if (/^Muy/.test(g[k])) n -= 2; else if (/^Seri/.test(g[k])) n -= 1 });
  if (g.publicacion === "Sospechado") n -= 1;
  if (/gran magnitud|dosis|confusión/i.test(g.aumentan || "")) n += 1;
  return GR_CERTEZA[4 - Math.max(1, Math.min(4, n))];
}
function renderGrade() {
  const editable = !!clave;
  $("#grade-add").hidden = !editable;
  $("#grade").innerHTML = GRADE.length ? `<div class="tabla"><table><thead><tr><th>Resultado</th><th>Exposición</th><th>Estudios</th><th>Hallazgo</th><th>Certeza</th></tr></thead><tbody>${GRADE.map(g => `<tr${editable ? ` class="clic" data-g="${esc(g.id)}"` : ""}>
    <td><b>${esc(g.resultado)}</b></td><td>${esc(g.exposicion)}</td><td>${esc(g.estudios)}<br><span class="meta">${esc(g.diseno)}</span></td><td>${esc(g.efecto)}</td>
    <td><span class="cert c${GR_CERTEZA.indexOf(g.certeza)}">${GR_SIMB[g.certeza] || ""} ${esc(g.certeza || "—")}</span>${[["sesgo", "riesgo de sesgo"], ["inconsistencia", "inconsistencia"], ["indirecta", "evidencia indirecta"], ["imprecision", "imprecisión"]].filter(([k]) => /^(Seri|Muy)/.test(g[k] || "")).map(([k, l]) => `<br><span class="meta">↓ ${l}: ${esc(g[k].toLowerCase())}</span>`).join("")}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">Agrega una fila por cada resultado en salud importante (por ejemplo, «síntomas gastrointestinales» o «biomarcadores de glifosato en orina») y evalúa qué tan confiable es la evidencia.</div>`;
  $("#grade").querySelectorAll("[data-g]").forEach(tr => tr.onclick = () => abrirGrade(tr.dataset.g));
}
let gradeActual = null;
function abrirGrade(id) {
  gradeActual = id || null;
  const g = GRADE.find(x => x.id === id) || {};
  const sel = (k, ops) => `<select id="g-${k}"><option value="">— Elegir —</option>${ops.map(o => `<option${o === g[k] ? " selected" : ""}>${o}</option>`).join("")}</select>`;
  $("#g-campos").innerHTML = `
    <label>Resultado en salud<input id="g-resultado" value="${esc(g.resultado || "")}" placeholder="Síntomas gastrointestinales"></label>
    <label>Exposición<input id="g-exposicion" value="${esc(g.exposicion || "")}" list="g-exps" placeholder="Cianotoxinas"></label>
    <datalist id="g-exps">${CAT_EXP.map(c => `<option value="${esc(c)}">`).join("")}</datalist>
    <label>Estudios (códigos)<input id="g-estudios" value="${esc(g.estudios || "")}" placeholder="R004, R012"></label>
    <label>Diseño de los estudios<input id="g-diseno" value="${esc(g.diseno || "")}" placeholder="Observacionales (transversales)"></label>
    <label>Riesgo de sesgo${sel("sesgo", GR_NIVELES.sesgo)}</label>
    <label>Inconsistencia (resultados distintos entre estudios)${sel("inconsistencia", GR_NIVELES.inconsistencia)}</label>
    <label>Evidencia indirecta (población o exposición no tan parecida a la pregunta)${sel("indirecta", GR_NIVELES.indirecta)}</label>
    <label>Imprecisión (pocos participantes, intervalos amplios)${sel("imprecision", GR_NIVELES.imprecision)}</label>
    <label>Sesgo de publicación${sel("publicacion", GR_NIVELES.publicacion)}</label>
    <label>Factores que aumentan la certeza<input id="g-aumentan" value="${esc(g.aumentan || "")}" placeholder="Efecto de gran magnitud, gradiente dosis-respuesta…"></label>
    <label>Hallazgo / efecto<textarea id="g-efecto" rows="2" placeholder="Mayor frecuencia de síntomas en expuestos (OR 2,1; IC 95 % 1,3 a 3,4)">${esc(g.efecto || "")}</textarea></label>
    <label>Certeza de la evidencia${sel("certeza", GR_CERTEZA)}</label>
    <label>Comentarios<textarea id="g-comentarios" rows="2">${esc(g.comentarios || "")}</textarea></label>`;
  $("#g-borrar").hidden = !id || !(rol && rol.admin);
  $("#dlg-g").showModal();
}
const GR_CAMPOS = ["resultado", "exposicion", "estudios", "diseno", "sesgo", "inconsistencia", "indirecta", "imprecision", "publicacion", "aumentan", "efecto", "certeza", "comentarios"];
$("#grade-add").onclick = () => abrirGrade(null);
$("#g-sugerir").onclick = () => {
  const g = Object.fromEntries(GR_CAMPOS.map(k => [k, $("#g-" + k).value]));
  $("#g-certeza").value = certezaSugerida(g); toast("Sugerencia según GRADE: revísala con tu equipo.");
};
$("#form-g").onsubmit = async ev => {
  ev.preventDefault();
  const d = Object.fromEntries(GR_CAMPOS.map(k => [k, $("#g-" + k).value.trim()])); d.id = gradeActual || "";
  if (!d.resultado) { toast("Escribe el resultado en salud."); return }
  await guardar($("#g-guardar"), $("#dlg-g"), () => api("guardarGrade", d), "Guardado");
};
$("#g-borrar").onclick = () => guardar($("#g-borrar"), $("#dlg-g"), () => api("borrarGrade", { id: gradeActual }), "Fila eliminada");
$("#grade-doc").onclick = () => {
  const filas = GRADE.map(g => `<tr><td>${esc(g.resultado)}</td><td>${esc(g.exposicion)}</td><td>${esc(g.estudios)}<br>${esc(g.diseno)}</td><td>${esc(g.sesgo)}</td><td>${esc(g.inconsistencia)}</td><td>${esc(g.indirecta)}</td><td>${esc(g.imprecision)}</td><td>${esc(g.publicacion)}</td><td>${esc(g.efecto)}</td><td>${GR_SIMB[g.certeza] || ""} ${esc(g.certeza)}</td></tr>`).join("");
  descargar("resumen-de-hallazgos-grade.doc", `<html><head><meta charset="utf-8"><style>body{font-family:Arial;font-size:9pt}table{border-collapse:collapse}td,th{border:1px solid #000;padding:4px;vertical-align:top}th{background:#eee}</style></head><body><h3>Resumen de hallazgos y certeza de la evidencia (GRADE)</h3><table><tr><th>Resultado</th><th>Exposición</th><th>Estudios y diseño</th><th>Riesgo de sesgo</th><th>Inconsistencia</th><th>Evidencia indirecta</th><th>Imprecisión</th><th>Sesgo de publicación</th><th>Hallazgo</th><th>Certeza</th></tr>${filas}</table><p>GRADE: ⊕⊕⊕⊕ alta · ⊕⊕⊕◯ moderada · ⊕⊕◯◯ baja · ⊕◯◯◯ muy baja.</p></body></html>`, "application/msword");
};

function renderEstudios() {
  const inc = R.filter(r => r.estadoK === "inc").sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
  const ext = Object.fromEntries(EXT.map(e => [e.codigo, e])), ses = Object.fromEntries(SES.map(s => [s.codigo, s]));
  const m = mapaSvg();
  $("#mapa").innerHTML = m.svg;
  $("#mapa-nota").textContent = `Según el campo «Departamento(s)» de la extracción de datos${m.pais ? ` · ${m.pais} de alcance nacional` : ""}.`;
  const logueado = !!clave;
  $("#est-list").innerHTML = inc.length ? inc.map(r => {
    const e = ext[r.codigo], s = ses[r.codigo];
    const chipE = e ? (e.verificadoPor ? `<span class="pill s-inc">Datos verificados</span>` : `<span class="pill s-ft">Datos sin verificar</span>`) : `<span class="pill s-pend">Sin extraer</span>`;
    const chipS = s && s.global ? `<span class="pill ${claseNivel(s.global)}">Sesgo: ${esc(s.global)}</span>` : `<span class="pill s-pend">Sin riesgo de sesgo</span>`;
    return `<div class="item nohover"><div class="top"><span class="t"><span class="meta">${esc(r.codigo)}</span> ${esc(r.titulo)}</span></div>
      <div class="meta">${esc([r.autores, r.anio].filter(Boolean).join(" · "))}${e && e.departamento ? " · " + esc(e.departamento) : ""}</div>
      <div class="bar">${chipE}${chipS}</div>
      ${logueado ? `<div class="bar"><button class="btn ghost" data-ext="${esc(r.codigo)}">Extraer datos</button><button class="btn ghost" data-ses="${esc(r.codigo)}">Riesgo de sesgo</button></div>` : ""}</div>`;
  }).join("") : `<div class="empty">Cuando incluyas estudios (estado «Incluida»), aparecen aquí para extraer los datos y evaluar el riesgo de sesgo.</div>`;
  $("#est-list").querySelectorAll("[data-ext]").forEach(b => b.onclick = () => abrirExtraccion(b.dataset.ext));
  $("#est-list").querySelectorAll("[data-ses]").forEach(b => b.onclick = () => abrirSesgo(b.dataset.ses));
  $("#evidencia").innerHTML = mapaEvidencia();
  renderGrade();
  // Semáforo de riesgo de sesgo
  const conSes = inc.filter(r => ses[r.codigo]);
  $("#semaforo").innerHTML = conSes.length ? `<div class="tabla"><table class="sem"><thead><tr><th>Estudio</th>${DOMINIOS.map(([k]) => `<th title="${esc(DOMINIOS.find(d => d[0] === k)[1])}">${k.toUpperCase()}</th>`).join("")}<th>Global</th></tr></thead><tbody>${conSes.map(r => {
    const s = ses[r.codigo]; const celda = v => `<td><span class="dot ${claseNivel(v)}" title="${esc(v || "Sin evaluar")}">${{ rb: "+", rm: "−", ra: "×", rv: "!", rs: "?" }[claseNivel(v)] || ""}</span></td>`;
    return `<tr><td>${esc(r.codigo)} ${esc((r.autores || "").split(/[,;]/)[0])} ${esc(r.anio || "")}</td>${DOMINIOS.map(([k]) => celda(s[k])).join("")}${celda(s.global)}</tr>`;
  }).join("")}</tbody></table></div>
  <div class="leyenda">${NIVELES.map(n => `<span><span class="dot ${claseNivel(n)}">${{ rb: "+", rm: "−", ra: "×", rv: "!", rs: "?" }[claseNivel(n)]}</span> ${n}</span>`).join("")}</div>
  <p class="note">${DOMINIOS.map(([k, l]) => `${k.toUpperCase()}: ${l}`).join(" · ")}</p>` : `<div class="empty">El semáforo de riesgo de sesgo aparece cuando evalúes el primer estudio.</div>`;
  // Tabla de características de los estudios
  const conExt = inc.filter(r => ext[r.codigo]);
  $("#tabla-ext").innerHTML = conExt.length ? `<div class="tabla"><table><thead><tr><th>Estudio</th><th>Diseño</th><th>Población (n)</th><th>Departamento</th><th>Fuente de agua</th><th>Exposición</th><th>Desenlace</th><th>Resultados</th></tr></thead><tbody>${conExt.map(r => {
    const e = ext[r.codigo];
    return `<tr><td>${esc(r.codigo)}<br>${esc((r.autores || "").split(/[,;]/)[0])} ${esc(r.anio || "")}</td><td>${esc(e.diseno)}</td><td>${esc(e.poblacion)}${e.n ? ` (n = ${esc(e.n)})` : ""}</td><td>${esc(e.departamento)}</td><td>${esc(e.fuente)}</td><td>${esc(e.contaminante)}</td><td>${esc(e.desenlace)}</td><td>${esc(e.resultados)}</td></tr>`;
  }).join("")}</tbody></table></div>` : `<div class="empty">La tabla de características aparece cuando extraigas los datos del primer estudio.</div>`;
}

/* ---------- Extracción de datos ---------- */
let extActual = null;
function abrirExtraccion(codigo) {
  extActual = codigo;
  const r = R.find(x => x.codigo === codigo) || {}, e = EXT.find(x => x.codigo === codigo) || {};
  $("#dlg-e-title").textContent = `Extracción de datos · ${codigo}`;
  $("#e-ref").textContent = r.titulo || "";
  const deps = new Set(String(e.departamento || "").split(/[;,]/).map(x => x.trim()).filter(Boolean));
  $("#e-deps").innerHTML = ["Todo el país", ...TEJAS.map(t => t[0]).sort((a, b) => a.localeCompare(b))].map(d =>
    `<label class="chk"><input type="checkbox" value="${esc(d)}"${deps.has(d) ? " checked" : ""}> ${esc(d)}</label>`).join("");
  $("#e-expcat").innerHTML = chips("#e-expcat", CAT_EXP, e.expCat);
  $("#e-descat").innerHTML = chips("#e-descat", CAT_DES, e.desCat);
  $("#e-campos").innerHTML = CAMPOS_EXT.map(([k, l, filas, ph]) => `<label>${esc(l)}${filas > 1 ? `<textarea id="e-${k}" rows="${filas}" placeholder="${esc(ph)}">${esc(e[k] || "")}</textarea>` : `<input id="e-${k}" value="${esc(e[k] || "")}" placeholder="${esc(ph)}">`}</label>`).join("");
  const yo = rol && (rol.revisor || "administración");
  $("#e-estado").textContent = e.extraidoPor ? `Extraído por ${e.extraidoPor} (${fdt(e.fecha)})${e.verificadoPor ? ` · Verificado por ${e.verificadoPor} (${fdt(e.fechaVerif)})` : " · Falta que otra persona lo verifique"}` : "Todavía no se extrajeron datos de este estudio.";
  $("#e-verif").hidden = !e.extraidoPor || !!e.verificadoPor || e.extraidoPor === yo;
  $("#dlg-e").showModal();
}
$("#form-e").onsubmit = async ev => {
  ev.preventDefault();
  const datos = { codigo: extActual, departamento: [...$("#e-deps").querySelectorAll("input:checked")].map(i => i.value).join("; "), expCat: leerChips("#e-expcat"), desCat: leerChips("#e-descat") };
  CAMPOS_EXT.forEach(([k]) => datos[k] = $("#e-" + k).value.trim());
  await guardar($("#e-guardar"), $("#dlg-e"), () => api("guardarExtraccion", datos), "Datos guardados. Ahora otra persona tiene que verificarlos.");
};
$("#e-verif").onclick = () => guardar($("#e-verif"), $("#dlg-e"), () => api("verificarExtraccion", { codigo: extActual }), "Extracción verificada");

/* ---------- Riesgo de sesgo ---------- */
let sesActual = null;
function abrirSesgo(codigo) {
  sesActual = codigo;
  const r = R.find(x => x.codigo === codigo) || {}, s = SES.find(x => x.codigo === codigo) || {};
  const herramienta = s.herramienta || PROT.herramientaSesgo || "ROBINS-E";
  $("#dlg-s-title").textContent = `Riesgo de sesgo · ${codigo}`;
  $("#s-ref").textContent = `${r.titulo || ""} · Herramienta: ${herramienta}`;
  const opciones = v => `<option value="">— Elegir —</option>` + NIVELES.map(n => `<option${n === v ? " selected" : ""}>${n}</option>`).join("");
  $("#s-dominios").innerHTML = DOMINIOS.map(([k, l, ayuda], i) => `<div class="dom"><b>D${i + 1}. ${esc(l)}</b><span class="note">${esc(ayuda)}</span>
    <select id="s-${k}">${opciones(s[k])}</select><textarea id="s-j${i + 1}" rows="2" placeholder="Justificación (cita del texto, página…)">${esc(s["j" + (i + 1)] || "")}</textarea></div>`).join("")
    + `<div class="dom glob"><b>Riesgo de sesgo global</b><span class="note">Suele ser el peor de los dominios.</span><select id="s-global">${opciones(s.global)}</select><textarea id="s-jg" rows="2" placeholder="Justificación">${esc(s.jg || "")}</textarea></div>`;
  $("#s-estado").textContent = s.evaluador ? `Evaluado por ${s.evaluador} (${fdt(s.fecha)})` : "";
  $("#dlg-s").showModal();
}
$("#s-auto").onclick = () => {
  const orden = ["Bajo riesgo", "Algunas preocupaciones", "Alto riesgo", "Muy alto riesgo"];
  const vals = DOMINIOS.map(([k]) => $("#s-" + k).value).filter(v => orden.includes(v));
  if (!vals.length) { toast("Primero evalúa los dominios."); return }
  $("#s-global").value = vals.sort((a, b) => orden.indexOf(b) - orden.indexOf(a))[0];
};
$("#form-s").onsubmit = async ev => {
  ev.preventDefault();
  const datos = { codigo: sesActual, herramienta: (SES.find(x => x.codigo === sesActual) || {}).herramienta || PROT.herramientaSesgo || "ROBINS-E", global: $("#s-global").value, jg: $("#s-jg").value.trim() };
  DOMINIOS.forEach(([k], i) => { datos[k] = $("#s-" + k).value; datos["j" + (i + 1)] = $("#s-j" + (i + 1)).value.trim() });
  await guardar($("#s-guardar"), $("#dlg-s"), () => api("guardarSesgo", datos), "Riesgo de sesgo guardado");
};
$("#dl-ext").onclick = () => {
  const cel = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s };
  const filas = EXT.map(e => { const r = R.find(x => x.codigo === e.codigo) || {}; return [e.codigo, r.titulo, r.autores, r.anio, ...CAMPOS_EXT.map(([k]) => e[k]), e.departamento, e.extraidoPor, e.verificadoPor] });
  descargar("extraccion-de-datos.csv", "﻿" + [["Código", "Título", "Autores", "Año", ...CAMPOS_EXT.map(c => c[1]), "Departamento(s)", "Extraído por", "Verificado por"], ...filas].map(f => f.map(cel).join(",")).join("\n"), "text/csv;charset=utf-8");
};

// Primer dibujo con lo que ya haya cargado app.js
renderExtra();
