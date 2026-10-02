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
  ["palabrasIncluir", "Palabras a resaltar en verde al cribar (separadas por coma)", 3],
  ["palabrasExcluir", "Palabras a resaltar en rojo al cribar (separadas por coma)", 2],
];
const PROT_EJEMPLO = {
  poblacion: "Población residente en Uruguay (cualquier edad).",
  exposicion: "Consumo de agua potable (red pública OSE, pozos u otras fuentes) y sus contaminantes: microbiológicos, nitratos, arsénico, plomo, cianotoxinas, trihalometanos, sodio, agroquímicos…",
  comparador: "Población no expuesta o con menor exposición, o niveles por debajo de la norma.",
  desenlaces: "Cualquier desenlace en salud: enfermedades gastrointestinales, metahemoglobinemia, plombemia, cáncer, hipertensión, enfermedad renal, biomarcadores de exposición…",
  disenos: "Estudios observacionales (cohortes, casos y controles, transversales, ecológicos), series de casos e informes de brotes.",
  inclusion: "Estudios realizados en Uruguay.\nEvalúan agua de consumo humano.\nReportan al menos un desenlace en salud o un biomarcador de exposición.",
  exclusion: "Estudios fuera de Uruguay.\nAgua recreativa, residual o de riego sin vínculo con el consumo.\nEstudios en animales o in vitro.\nEditoriales y revisiones narrativas (se usan para rastrear referencias).",
  herramientaSesgo: "ROBINS-E",
};
function renderProtocolo() {
  const editable = !!(clave && rol && rol.admin);
  $("#prot-form").innerHTML = CAMPOS_PROT.map(([k, l, filas]) => {
    const v = PROT[k] ?? (k === "palabrasIncluir" ? PAL_INCLUIR : k === "palabrasExcluir" ? PAL_EXCLUIR : "");
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
  ["fuente", "Fuente de agua", 1, "Red OSE, pozo, aljibe, agua embotellada…"],
  ["contaminante", "Exposición / contaminante", 1, "Nitratos, arsénico, plomo…"],
  ["medicionExp", "Medición de la exposición", 2, "Cómo y dónde se midió"],
  ["desenlace", "Desenlace en salud", 1, ""], ["medicionDes", "Medición del desenlace", 2, ""],
  ["efecto", "Medida de efecto", 1, "OR, RR, diferencia de medias, prevalencia…"],
  ["resultados", "Resultados principales", 3, "Con intervalos de confianza si los hay"],
  ["confusores", "Ajuste por confusores", 2, ""], ["financiamiento", "Financiamiento / conflictos de interés", 1, ""],
  ["notas", "Notas", 2, ""],
];
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
  $("#e-campos").innerHTML = CAMPOS_EXT.map(([k, l, filas, ph]) => `<label>${esc(l)}${filas > 1 ? `<textarea id="e-${k}" rows="${filas}" placeholder="${esc(ph)}">${esc(e[k] || "")}</textarea>` : `<input id="e-${k}" value="${esc(e[k] || "")}" placeholder="${esc(ph)}">`}</label>`).join("");
  const yo = rol && (rol.revisor || "administración");
  $("#e-estado").textContent = e.extraidoPor ? `Extraído por ${e.extraidoPor} (${fdt(e.fecha)})${e.verificadoPor ? ` · Verificado por ${e.verificadoPor} (${fdt(e.fechaVerif)})` : " · Falta que otra persona lo verifique"}` : "Todavía no se extrajeron datos de este estudio.";
  $("#e-verif").hidden = !e.extraidoPor || !!e.verificadoPor || e.extraidoPor === yo;
  $("#dlg-e").showModal();
}
$("#form-e").onsubmit = async ev => {
  ev.preventDefault();
  const datos = { codigo: extActual, departamento: [...$("#e-deps").querySelectorAll("input:checked")].map(i => i.value).join("; ") };
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
