// Inicio (panel de avance y «¿qué sigue?»), guía y glosario, alertas semanales,
// checklist PRISMA 2020, comentarios entre revisores, paquete de reproducibilidad
// y cribado sin conexión. Usa los datos y funciones globales de app.js.

/* ---------- Panel de avance ---------- */
const nf = n => Number(n || 0).toLocaleString("es-UY");
function barras(datos, etiquetaEje) {
  // Barras verticales finas de un solo color, con valor encima y aviso al pasar el mouse
  if (!datos.length) return `<div class="empty">Todavía no hay datos para este gráfico.</div>`;
  const W = 360, H = 190, M = { l: 26, r: 6, t: 20, b: 30 }, max = Math.max(...datos.map(d => d[1]), 1);
  const paso = (W - M.l - M.r) / datos.length, ancho = Math.max(6, Math.min(34, paso * .62));
  const y = v => M.t + (H - M.t - M.b) * (1 - v / max);
  const ticks = [0, Math.ceil(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const etiquetasCada = Math.ceil(datos.length / 7);
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(etiquetaEje)}">
    ${ticks.map(t => `<line class="grid" x1="${M.l}" x2="${W - M.r}" y1="${y(t)}" y2="${y(t)}"/><text class="eje" x="${M.l - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join("")}
    ${datos.map(([k, v], i) => {
      const x = M.l + paso * i + (paso - ancho) / 2, top = y(v), h = Math.max(0, y(0) - top);
      const r = Math.min(4, ancho / 2, h);
      return `<g class="barra"><title>${esc(k)}: ${v}</title><rect class="hit" x="${M.l + paso * i}" y="${M.t}" width="${paso}" height="${H - M.t - M.b}"/>
        ${v ? `<path class="bar" d="M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + ancho - r} Q${x + ancho},${top} ${x + ancho},${top + r} V${y(0)} Z"/>` : ""}
        ${v && datos.length <= 12 ? `<text class="val" x="${x + ancho / 2}" y="${top - 5}" text-anchor="middle">${v}</text>` : ""}
        ${i % etiquetasCada === 0 ? `<text class="eje" x="${x + ancho / 2}" y="${H - M.b + 16}" text-anchor="middle">${esc(String(k).length > 14 ? String(k).slice(0, 13) + "…" : k)}</text>` : ""}</g>`;
    }).join("")}
    <line class="base" x1="${M.l}" x2="${W - M.r}" y1="${y(0)}" y2="${y(0)}"/></svg>`;
}
function renderInicio() {
  const k = e => R.filter(r => r.estadoK === e).length;
  const unicos = R.filter(r => r.estadoK !== "dup").length, pend = k("pend"), ft = k("ft"), inc = k("inc");
  const cribados = unicos - pend, pct = unicos ? Math.round(cribados / unicos * 100) : 0;
  const incl = R.filter(r => r.estadoK === "inc"), conExt = incl.filter(r => EXT.some(e => e.codigo === r.codigo));
  const verif = conExt.filter(r => (EXT.find(e => e.codigo === r.codigo) || {}).verificadoPor), conSes = incl.filter(r => SES.some(s => s.codigo === r.codigo && s.global));
  $("#kpis").innerHTML = [
    ["Búsquedas", B.length], ["Artículos únicos", unicos], ["Pendientes de cribar", pend], ["A texto completo", ft], ["Incluidos", inc],
  ].map(([l, v]) => `<div class="kpi"><b>${nf(v)}</b><span>${l}</span></div>`).join("");
  const barra = (l, n, d) => `<div class="prog"><div class="bar"><span>${l}</span><span class="meta">${nf(n)} de ${nf(d)}${d ? ` · ${Math.round(n / d * 100)} %` : ""}</span></div><div class="pista" role="progressbar" aria-valuenow="${d ? Math.round(n / d * 100) : 0}" aria-valuemin="0" aria-valuemax="100"><div style="width:${d ? n / d * 100 : 0}%"></div></div></div>`;
  $("#avance").innerHTML = barra("Cribado por título y resumen", cribados, unicos) +
    barra("Evaluación a texto completo", R.filter(r => ["inc", "extc", "nr"].includes(r.estadoK)).length, R.filter(r => ["ft", "inc", "extc", "nr"].includes(r.estadoK)).length) +
    barra("Extracción de datos (verificada)", verif.length, incl.length) + barra("Riesgo de sesgo", conSes.length, incl.length);
  // Artículos por año de publicación (sin duplicados)
  const anios = {}; R.filter(r => r.estadoK !== "dup" && /^\d{4}$/.test(r.anio)).forEach(r => anios[r.anio] = (anios[r.anio] || 0) + 1);
  const ks = Object.keys(anios).sort(), serie = [];
  if (ks.length) for (let a = +ks[0]; a <= +ks[ks.length - 1]; a++) serie.push([String(a), anios[a] || 0]);
  $("#graf-anios").innerHTML = barras(serie, "Artículos por año de publicación");
  // Incluidos por exposición
  const exp = {}; incl.forEach(r => {
    const e = EXT.find(x => x.codigo === r.codigo);
    String((e && e.expCat) || r.tema || "Sin clasificar").split(/;\s*/).filter(Boolean).forEach(c => exp[c] = (exp[c] || 0) + 1);
  });
  $("#graf-exp").innerHTML = barras(Object.entries(exp).sort((a, b) => b[1] - a[1]), "Estudios incluidos por exposición");
  renderSigue();
  renderAlertas();
}

/* ---------- ¿Qué sigue? ---------- */
function renderSigue() {
  const k = e => R.filter(r => r.estadoK === e).length, incl = R.filter(r => r.estadoK === "inc");
  const pasos = [];
  if (!PROT.inclusion) pasos.push(["📋", "Completa el protocolo", "Define la pregunta y los criterios de inclusión y exclusión antes de buscar. Así todas cribamos con las mismas reglas.", "protocolo"]);
  if (!B.length) pasos.push(["🔍", "Registra tu primera búsqueda", "Empieza por PubMed: copia la cadena de «Cadenas de búsqueda», búscala y pega el link de resultados en «+ Nueva búsqueda».", "busquedas"]);
  if (k("pend")) pasos.push(["▶", `Criba ${nf(k("pend"))} artículo${k("pend") === 1 ? "" : "s"} pendiente${k("pend") === 1 ? "" : "s"}`, "Lee título y resumen y decide si pasa, quizás o se excluye.", "referencias", "crib"]);
  if (typeof CONF !== "undefined" && CONF.length) pasos.push(["⚖️", `Resuelve ${CONF.length} conflicto${CONF.length === 1 ? "" : "s"}`, "Artículos en los que las dos revisoras decidieron distinto.", "referencias", "conf"]);
  if (k("ft")) pasos.push(["📄", `Evalúa ${nf(k("ft"))} a texto completo`, "Consigue el PDF, léelo entero y decide si se incluye. Si no lo consigues, marca «No se consiguió».", "referencias", "crib"]);
  const sinExt = incl.filter(r => !EXT.some(e => e.codigo === r.codigo)).length, sinVer = EXT.filter(e => !e.verificadoPor && incl.some(r => r.codigo === e.codigo)).length;
  const sinSes = incl.filter(r => !SES.some(s => s.codigo === r.codigo && s.global)).length;
  if (sinExt) pasos.push(["🔬", `Extrae los datos de ${sinExt} estudio${sinExt === 1 ? "" : "s"}`, "En la pestaña Estudios, completa el formulario de cada incluido.", "estudios"]);
  if (sinVer) pasos.push(["✅", `Verifica ${sinVer} extracción${sinVer === 1 ? "" : "es"}`, "La otra persona revisa que los datos estén bien copiados.", "estudios"]);
  if (sinSes) pasos.push(["🚦", `Evalúa el riesgo de sesgo de ${sinSes} estudio${sinSes === 1 ? "" : "s"}`, "Con ROBINS-E, dominio por dominio.", "estudios"]);
  if (incl.length && !GRADE.length) pasos.push(["⭐", "Evalúa la certeza de la evidencia (GRADE)", "Una fila por cada resultado en salud importante.", "estudios"]);
  const viejas = B.filter(b => b.fecha && (Date.now() - new Date(b.fecha + "T12:00:00")) / 864e5 > 180 && !/^Alerta automática/.test(b.notas || ""));
  if (viejas.length) pasos.push(["🔄", "Actualiza las búsquedas", `Hay ${viejas.length} búsqueda${viejas.length === 1 ? "" : "s"} de hace más de 6 meses. Las revistas piden búsquedas recientes.`, "busquedas"]);
  if (!pasos.length) pasos.push(["🎉", "¡Todo al día!", "Descarga el diagrama PRISMA, el texto de métodos, el checklist y el paquete de reproducibilidad para enviar el artículo.", "prisma"]);
  $("#sigue").innerHTML = pasos.slice(0, 3).map(([ic, t, d, tab, acc], i) => `<div class="paso${i ? "" : " uno"}"><span class="ic">${ic}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div>
    <button class="btn ${i ? "ghost" : ""}" data-ir="${tab}" data-acc="${acc || ""}">Ir</button></div>`).join("");
  $("#sigue").querySelectorAll("[data-ir]").forEach(b => b.onclick = () => {
    show(b.dataset.ir); window.scrollTo({ top: 0, behavior: "smooth" });
    if (clave && b.dataset.acc === "crib") $("#crib-btn").click();
    if (clave && b.dataset.acc === "conf") $("#conf-btn").click();
  });
}

/* ---------- Alertas semanales ---------- */
let ALERTAS = null;
async function cargarAlertas() {
  if (!clave || !rol || !rol.admin) return;
  try { ALERTAS = await api("alertas", { que: "estado" }) } catch (e) { ALERTAS = { error: e.message } }
  renderAlertas();
}
function renderAlertas() {
  const box = $("#alertas-box");
  if (!clave || !rol || !rol.admin) { box.hidden = true; return }
  box.hidden = false;
  const fuentes = B.filter(b => /pubmed\.ncbi\.nlm\.nih\.gov\/.*term=|colibri\.udelar/i.test(b.link || "") && !/^Alerta automática/.test(b.notas || ""));
  const st = ALERTAS;
  $("#alertas-estado").innerHTML = !st ? "Consultando…" : st.error ? (st.error === "Acción desconocida." ? "Para usar las alertas hay que actualizar el motor (Apps Script)." : esc(st.error))
    : `${st.activas ? "🟢 <b>Activadas</b>: cada lunes a las 8 revisa tus búsquedas y te avisa por mail." : "⚪ <b>Desactivadas</b>."}${st.ultima ? ` Última revisión: ${esc(fdate(st.ultima))}.` : ""}<br>Revisa ${fuentes.length} búsqueda${fuentes.length === 1 ? "" : "s"} con link de PubMed o Colibri.`;
  $("#al-on").hidden = !st || !!st.error || st.activas; $("#al-off").hidden = !st || !!st.error || !st.activas; $("#al-probar").hidden = !st || !!st.error;
}
async function accionAlertas(que, btn) {
  btn.disabled = true; const t = btn.textContent; btn.textContent = que === "probar" ? "Buscando…" : "…";
  try {
    const j = await api("alertas", { que });
    ALERTAS = { ...ALERTAS, activas: j.activas, ultima: j.resultado ? new Date().toLocaleDateString("sv") : (ALERTAS && ALERTAS.ultima) };
    if (que === "probar") { const n = j.resultado.total; toast(n ? (n === 1 ? "Encontré 1 artículo nuevo: ya está en Referencias y te mandé el mail." : `Encontré ${n} artículos nuevos: ya están en Referencias y te mandé el mail.`) : "No hay artículos nuevos desde la última revisión.", 7000); await cargar(true) }
    else toast(j.activas ? "Alertas activadas" : "Alertas desactivadas");
  } catch (e) { toast("No se pudo: " + e.message, 7000) }
  finally { btn.disabled = false; btn.textContent = t; renderAlertas() }
}
$("#al-on").onclick = e => accionAlertas("activar", e.target);
$("#al-off").onclick = e => accionAlertas("desactivar", e.target);
$("#al-probar").onclick = e => accionAlertas("probar", e.target);

/* ---------- Checklist PRISMA 2020 ---------- */
const CHECKLIST = [
  ["Título", 1, "Título", "Identifica el informe como una revisión sistemática."],
  ["Resumen", 2, "Resumen estructurado", "Sigue la lista PRISMA 2020 para resúmenes."],
  ["Introducción", 3, "Justificación", "Describe la justificación de la revisión en el contexto del conocimiento existente."],
  ["Introducción", 4, "Objetivos", "Declara explícitamente los objetivos o preguntas (PECO)."],
  ["Métodos", 5, "Criterios de elegibilidad", "Criterios de inclusión y exclusión y cómo se agruparon los estudios."],
  ["Métodos", 6, "Fuentes de información", "Todas las bases, registros, sitios web y otras fuentes, con la fecha de la última búsqueda."],
  ["Métodos", 7, "Estrategia de búsqueda", "Estrategias completas de todas las bases, con filtros y límites."],
  ["Métodos", 8, "Proceso de selección", "Cuántos revisores cribaron, si fue independiente y cómo se resolvieron desacuerdos."],
  ["Métodos", 9, "Proceso de extracción de datos", "Cuántos extrajeron, si fue independiente, y cómo se verificó."],
  ["Métodos", 10, "Lista de los datos", "Desenlaces y otras variables buscadas."],
  ["Métodos", 11, "Riesgo de sesgo de los estudios", "Herramienta usada y cuántos revisores la aplicaron."],
  ["Métodos", 12, "Medidas del efecto", "Medidas de efecto usadas para cada desenlace."],
  ["Métodos", 13, "Métodos de síntesis", "Cómo se decidió qué estudios combinar y cómo se sintetizaron (por ejemplo, síntesis narrativa SWiM o metaanálisis)."],
  ["Métodos", 14, "Sesgo de publicación", "Métodos para evaluar el sesgo por resultados no publicados."],
  ["Métodos", 15, "Certeza de la evidencia", "Métodos para evaluar la certeza (por ejemplo, GRADE)."],
  ["Resultados", 16, "Selección de los estudios", "Resultados de la búsqueda y la selección, idealmente con diagrama de flujo; estudios excluidos que parecían cumplir y por qué."],
  ["Resultados", 17, "Características de los estudios", "Cita y características de cada estudio incluido."],
  ["Resultados", 18, "Riesgo de sesgo de los estudios", "Evaluación del riesgo de sesgo de cada estudio."],
  ["Resultados", 19, "Resultados de los estudios individuales", "Para cada desenlace, los resultados de cada estudio."],
  ["Resultados", 20, "Resultados de la síntesis", "Resumen de las características, el riesgo de sesgo y los resultados de cada síntesis."],
  ["Resultados", 21, "Sesgo de publicación", "Evaluación del riesgo de sesgo por resultados no publicados."],
  ["Resultados", 22, "Certeza de la evidencia", "Certeza de la evidencia para cada desenlace."],
  ["Discusión", 23, "Discusión", "Interpretación, limitaciones de la evidencia y del proceso, e implicaciones."],
  ["Otra información", 24, "Registro y protocolo", "Registro (por ejemplo, PROSPERO), dónde acceder al protocolo y cambios."],
  ["Otra información", 25, "Financiación", "Fuentes de apoyo y papel de los financiadores."],
  ["Otra información", 26, "Conflicto de intereses", "Intereses en competencia de los autores."],
  ["Otra información", 27, "Disponibilidad de datos y materiales", "Qué datos, formularios y códigos están disponibles y dónde."],
];
// Lo que la página ya genera para cada ítem
function apoyoPagina(n) {
  const incl = R.filter(r => r.estadoK === "inc");
  const a = {
    4: PROT.pregunta ? "Pregunta PECO en Protocolo" : "",
    5: PROT.inclusion ? "Criterios en Protocolo" : "",
    6: B.length ? `${B.length} búsquedas registradas con fecha` : "",
    7: B.length ? "Tabla de estrategias (PRISMA-S) en la pestaña PRISMA" : "",
    8: ACU && ACU.fase1 && ACU.fase1.n ? "Doble ciego con kappa; texto de métodos" : (R.some(r => r.estadoK !== "pend") ? "Texto de métodos" : ""),
    9: EXT.length ? `${EXT.filter(e => e.verificadoPor).length} de ${EXT.length} extracciones verificadas` : "",
    10: EXT.length ? "Formulario de extracción estándar" : "",
    11: SES.length ? "ROBINS-E en Estudios" : "",
    15: GRADE.length ? "Tabla GRADE en Estudios" : "",
    16: R.length ? "Diagrama PRISMA 2020 descargable" : "",
    17: EXT.length ? "Tabla de características en Estudios" : "",
    18: SES.length ? "Semáforo de riesgo de sesgo" : "",
    19: EXT.length ? "Resultados por estudio en la extracción" : "",
    22: GRADE.length ? "Resumen de hallazgos (GRADE)" : "",
    24: PROT.prospero ? `PROSPERO ${PROT.prospero}` : "",
    27: B.length ? "Paquete de reproducibilidad (Exportar)" : "",
  };
  return a[n] || "";
}
function renderChecklist() {
  const editable = !!(clave && rol && rol.admin);
  let seccion = "";
  $("#checklist").innerHTML = `<div class="tabla"><table class="chk"><thead><tr><th>Ítem</th><th>Qué pide</th><th>Lo que ya tienes</th><th>Página del manuscrito</th></tr></thead><tbody>${CHECKLIST.map(([sec, n, t, d]) => {
    let v = {}; try { v = JSON.parse(PROT["chk:" + n] || "{}") } catch (e) { }
    const fila = (sec !== seccion ? `<tr class="sec"><td colspan="4">${esc(sec)}</td></tr>` : "") +
      `<tr><td><b>${n}</b></td><td><b>${esc(t)}</b><br><span class="meta">${esc(d)}</span></td><td>${apoyoPagina(n) ? `<span class="pill s-inc">✓</span> <span class="meta">${esc(apoyoPagina(n))}</span>` : `<span class="meta">—</span>`}</td>
      <td><input class="chk-pag" data-n="${n}" value="${esc(v.pagina || "")}" placeholder="p. ej. 4" ${editable ? "" : "disabled"}></td></tr>`;
    seccion = sec; return fila;
  }).join("")}</tbody></table></div>`;
  $("#chk-guardar").hidden = !editable;
}
$("#chk-guardar").onclick = async () => {
  const datos = {};
  document.querySelectorAll(".chk-pag").forEach(i => datos["chk:" + i.dataset.n] = JSON.stringify({ pagina: i.value.trim() }));
  await guardar($("#chk-guardar"), { close() { } }, () => api("guardarProtocolo", datos), "Checklist guardado");
};
$("#chk-doc").onclick = () => {
  const filas = CHECKLIST.map(([sec, n, t, d]) => { let v = {}; try { v = JSON.parse(PROT["chk:" + n] || "{}") } catch (e) { } return `<tr><td>${esc(sec)}</td><td>${n}</td><td><b>${esc(t)}</b><br>${esc(d)}</td><td>${esc(v.pagina || "")}</td></tr>` }).join("");
  descargar("checklist-prisma-2020.doc", `<html><head><meta charset="utf-8"><style>body{font-family:Arial;font-size:10pt}table{border-collapse:collapse}td,th{border:1px solid #000;padding:4px;vertical-align:top}th{background:#eee}</style></head><body><h3>Lista de verificación PRISMA 2020</h3><table><tr><th>Sección</th><th>Ítem</th><th>Ítem de la lista</th><th>Ubicación (página)</th></tr>${filas}</table></body></html>`, "application/msword");
};

/* ---------- Comentarios entre revisores ---------- */
let COM = [], comActual = null;
async function cargarComentarios() {
  if (!clave) return;
  try { COM = (await api("comentarios", {})).comentarios || [] } catch (e) { COM = [] }
  if ($("#dlg-c").open) renderCrib();
  renderR();
}
const nCom = codigo => COM.filter(c => c.codigo === codigo).length;
function abrirComentarios(codigo) {
  comActual = codigo;
  const r = R.find(x => x.codigo === codigo) || {};
  $("#com-titulo").textContent = `${codigo} · ${r.titulo || ""}`;
  const lista = COM.filter(c => c.codigo === codigo);
  $("#com-lista").innerHTML = lista.length ? lista.map(c => `<div class="com"><b>${esc(c.autor)}</b> <span class="meta">${esc(fdt(c.fecha))}</span><p>${esc(c.texto)}</p></div>`).join("") : `<div class="empty">Sin comentarios todavía.</div>`;
  $("#com-texto").value = "";
  $("#dlg-com").showModal();
}
$("#com-enviar").onclick = async () => {
  const texto = $("#com-texto").value.trim(); if (!texto) return;
  const b = $("#com-enviar"); b.disabled = true;
  try { await api("comentar", { codigo: comActual, texto }); await cargarComentarios(); abrirComentarios(comActual) }
  catch (e) { toast(e.message === "Acción desconocida." ? "Para comentar hay que actualizar el motor." : "No se pudo: " + e.message, 6000) }
  finally { b.disabled = false }
};

/* ---------- Paquete de reproducibilidad ---------- */
$("#dl-paquete").onclick = async () => {
  if (!window.JSZip) { toast("No se pudo cargar el compresor. Revisa la conexión."); return }
  const b = $("#dl-paquete"); b.disabled = true; b.textContent = "Armando el paquete…";
  try {
    const zip = new JSZip(), cel = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s };
    const csv = filas => "﻿" + (filas.length ? [Object.keys(filas[0]), ...filas.map(Object.values)].map(f => f.map(cel).join(",")).join("\n") : "");
    let priv = { decisiones: [], comentarios: [] };
    if (clave && rol && rol.admin) { try { priv = await api("exportarTodo", {}) } catch (e) { } }
    const t = Prisma.textoMetodos(B, R, ACU, PROT, EXT, SES);
    zip.file("LEEME.txt", `Paquete de reproducibilidad\nRevisión sistemática: ${PROT.titulo || "agua de consumo humano y salud en Uruguay"}\nGenerado el ${new Date().toLocaleString("es-UY")} desde ${location.href}\n\nContenido:\n- protocolo.txt: pregunta, criterios y registro\n- busquedas.csv y estrategias-de-busqueda.doc: todas las búsquedas (PRISMA-S)\n- referencias.csv: todos los registros con su estado y fechas\n- historial.csv: cada cambio, con fecha y hora\n- decisiones.csv: decisiones de cada revisor en el cribado doble ciego\n- extraccion.csv, riesgo-de-sesgo.csv, grade.csv: datos de los estudios incluidos\n- diagrama-prisma-2020.svg: diagrama de flujo\n- metodos-y-resultados.txt: texto generado\n- checklist-prisma-2020.csv\n`);
    zip.file("protocolo.txt", CAMPOS_PROT.map(([k, l]) => `${l}:\n${PROT[k] || "—"}\n`).join("\n"));
    zip.file("busquedas.csv", csv(B)); zip.file("estrategias-de-busqueda.doc", Prisma.tablaWord(B));
    zip.file("referencias.csv", csv(R.map(({ estadoK, ...r }) => r))); zip.file("historial.csv", csv(H));
    if (priv.decisiones.length) zip.file("decisiones.csv", csv(priv.decisiones.map(({ fila, ...d }) => d)));
    if (priv.comentarios.length) zip.file("comentarios.csv", csv(priv.comentarios));
    zip.file("extraccion.csv", csv(EXT)); zip.file("riesgo-de-sesgo.csv", csv(SES)); zip.file("grade.csv", csv(GRADE));
    zip.file("diagrama-prisma-2020.svg", Prisma.diagrama(B, R));
    zip.file("metodos-y-resultados.txt", `MÉTODOS\n${t.metodos}\n\nRESULTADOS\n${t.resultados}\n`);
    zip.file("checklist-prisma-2020.csv", csv(CHECKLIST.map(([sec, n, ti]) => { let v = {}; try { v = JSON.parse(PROT["chk:" + n] || "{}") } catch (e) { } return { seccion: sec, item: n, titulo: ti, pagina: v.pagina || "" } })));
    const blob = await zip.generateAsync({ type: "blob" });
    descargar(`revision-agua-uy-${new Date().toLocaleDateString("sv")}.zip`, blob, "application/zip");
  } catch (e) { toast("No se pudo armar el paquete: " + e.message, 6000) }
  finally { b.disabled = false; b.textContent = "📦 Descargar paquete de reproducibilidad" }
};

/* ---------- Cribado sin conexión ---------- */
// Las decisiones pendientes de guardar se recuerdan en el dispositivo y se envían al volver internet
function guardarColaLocal() { store.set("colaCrib", colaCrib.length ? JSON.stringify(colaCrib) : null) }
try { const c = JSON.parse(store.get("colaCrib") || "[]"); if (c.length && clave) { colaCrib.push(...c); setTimeout(procesarCola, 1500) } } catch (e) { }
window.addEventListener("online", () => { toast("Volvió la conexión: guardando lo pendiente…"); if (colaCrib.length) procesarCola(); cargar(true) });
window.addEventListener("offline", () => toast("Sin conexión: puedes seguir cribando, las decisiones se guardan cuando vuelva internet.", 6000));
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });

/* ---------- Primer dibujo ---------- */
renderExtra();
cargarComentarios(); cargarAlertas();
