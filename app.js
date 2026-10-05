// Registro de la revisión sistemática. Los datos viven en Google Sheets;
// esta página los lee (cualquiera) y los edita (solo con la clave).
const BASES = ["PubMed/MEDLINE", "LILACS", "SciELO", "BVS (Biblioteca Virtual en Salud)", "Scopus", "Web of Science", "Embase",
  "Cochrane Library", "Google Scholar", "Colibri (UdelaR)", "Timbó", "Literatura gris / informes (OSE, MSP, URSEA)", "Otra"];
const ESTADOS = [
  ["pend", "Pendiente de cribado"], ["dup", "Duplicado"], ["exta", "Excluida por título/resumen"],
  ["ft", "A texto completo"], ["nr", "Texto completo no recuperado"], ["extc", "Excluida a texto completo"], ["inc", "Incluida"]];
const estadoLabel = k => (ESTADOS.find(e => e[0] === k) || ESTADOS[0])[1];
const estadoKey = l => (ESTADOS.find(e => e[1] === l) || ESTADOS[0])[0];
const MAX_PDF = 30 * 1048576;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : "";
const doiUrl = d => d ? "https://doi.org/" + String(d).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "") : "";
const fdate = s => {
  if (!s) return "";
  const d = new Date(String(s).slice(0, 10) + "T12:00:00");
  return isNaN(d) ? s : d.toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" });
};
const fdt = s => s ? `${fdate(s)}${String(s).length > 10 ? " " + String(s).slice(11, 16) : ""}` : "";
const store = {
  get(k) { try { return localStorage.getItem(k) } catch (e) { return null } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch (e) { } },
};

let pdfAbierto = "", uruguayAuto = "", colaCrib = [];
// Quién entró: administración y/o Revisor 1, 2 o 3 (cribado doble ciego)
let rol = (() => { try { return JSON.parse(store.get("rol") || "null") } catch (e) { return null } })();
let mias = new Map(), otroAvance = null, doble = false, ACU = null, PROT = {}, EXT = [], SES = [], GRADE = [];
const faseNum = () => $("#c-fase").value === "pend" ? 1 : 2;
const claveDec = (codigo, fase) => codigo + "|" + fase;
let B = [], R = [], H = [], clave = store.get("clave") || "", editB = null, editR = null, pdfFile = null, cargando = false;

function toast(msg, ms = 2800) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, ms) }
function fill(sel, opts, first) { sel.innerHTML = (first ? `<option value="">${first}</option>` : "") + opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("") }
fill($("#b-base"), BASES.map(b => [b, b]));
fill($("#r-estado"), ESTADOS);
fill($("#f-estado"), [["", "Todos, sin duplicados"], ["todos", "Todos, con duplicados"], ...ESTADOS]);

/* ---------- Nombre automático del PDF (igual que en la planilla) ---------- */
const slug = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]+/g, " ").trim();
function nombrePdf(d) {
  const ap = slug(String(d.autores || "").split(/[,;]/)[0]).split(/\s+/)[0] || "SinAutor";
  const tit = slug(d.titulo).split(/\s+/).filter(w => w.length > 2).slice(0, 5).join("-") || "SinTitulo";
  return `${d.codigo || "R___"}_${ap}_${d.anio || "sf"}_${tit}.pdf`;
}
function proximoCodigo() { const n = R.map(r => parseInt(String(r.codigo).slice(1)) || 0); return "R" + String(Math.max(0, ...n) + 1).padStart(3, "0") }

/* ---------- Conexión con la planilla ---------- */
async function cargar(silencioso) {
  if (!window.API_URL) { $("#status").textContent = "Falta conectar la planilla (ver README)."; renderAll(); return }
  if (cargando || colaCrib.length) return; cargando = true;
  if (!silencioso) $("#status").textContent = "Actualizando…";
  try {
    let r;
    try { r = await fetch(window.API_URL, { cache: "no-store" }) } catch (e) { throw new Error("no se pudo llegar al motor de Google") }
    const texto = await r.text();
    let j;
    try { j = JSON.parse(texto) } catch (e) {
      throw new Error(/accounts\.google|ServiceLogin|signin/i.test(texto) ? "el motor pide iniciar sesión (revisa «Quién tiene acceso» en Apps Script)" : `respuesta inesperada del motor (código ${r.status})`);
    }
    if (!j.ok) throw new Error(j.error);
    aplicar(j);
    store.set("cache", JSON.stringify(j));
    $("#status").textContent = "Actualizado " + new Date().toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    $("#status").textContent = `Sin conexión con la planilla: ${e.message}.`;
  } finally { cargando = false }
}
function aplicar(j) {
  B = (j.busquedas || []).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  R = (j.referencias || []).map(r => ({ ...r, estadoK: estadoKey(r.estado) })).sort((a, b) => String(b.codigo).localeCompare(String(a.codigo)));
  H = j.historial || [];
  ACU = j.acuerdo || null;
  PROT = Object.fromEntries((j.protocolo || []).map(x => [x.clave, x.valor]));
  EXT = j.extraccion || []; SES = j.sesgo || []; GRADE = j.grade || [];
  renderAll();
}
// Llama al motor y traduce cada falla a un mensaje que diga qué revisar
async function api(accion, datos) {
  if (!window.API_URL) throw new Error("La página todavía no tiene la dirección del motor. Espera unos minutos y recarga.");
  let r, texto;
  try {
    r = await fetch(window.API_URL, { method: "POST", body: JSON.stringify({ clave, accion, datos }) });
    texto = await r.text();
  } catch (e) {
    throw new Error("No se pudo llegar al motor de Google (red bloqueada o acceso de la implementación). En Apps Script, «Quién tiene acceso» tiene que ser «Cualquier usuario».");
  }
  let j;
  try { j = JSON.parse(texto) } catch (e) {
    if (/accounts\.google|ServiceLogin|signin/i.test(texto)) throw new Error("El motor pide iniciar sesión: en Apps Script, «Quién tiene acceso» tiene que ser «Cualquier usuario» y hay que implementar una versión nueva.");
    if (/no se encontr|not found|unable to open|no se pudo abrir/i.test(texto)) throw new Error("Google no encontró el motor: revisa que la URL sea la de la implementación actual.");
    throw new Error(`El motor respondió algo inesperado (código ${r.status}). Mándale una captura a Claude.`);
  }
  if (!j.ok) throw new Error(j.error || "Error desconocido");
  return j;
}

/* ---------- Modo edición ---------- */
function setModo() {
  const on = !!clave;
  if (!on) rol = null;
  if (on && !rol) rol = { admin: true, revisor: "" };
  document.body.classList.toggle("editing", on);
  document.body.classList.toggle("admin", on && rol.admin);
  const quien = on ? [rol.revisor, rol.admin ? "Admin" : ""].filter(Boolean).join(" · ") : "";
  $("#mode").textContent = on ? "✏️ " + quien : "🔒 Solo lectura";
  $("#mode").classList.toggle("on", on);
  $("#crib-btn").hidden = !on || (!rol.admin && rol.revisor === "Revisor 3");
  // Lo que depende de quién entró se vuelve a dibujar
  renderExtra();
}
// Protocolo y estudios viven en estudios.js, que carga después
function renderExtra() {
  if (typeof renderEstudios === "function") { renderProtocolo(); renderEstudios() }
  if (typeof renderInicio === "function") { renderInicio(); renderChecklist() }
}
async function actualizarRol() {
  if (!clave) return;
  try {
    const j = await api("probarClave", {});
    rol = j.rol || { admin: true, revisor: "" }; // motor viejo: solo había administración
    store.set("rol", JSON.stringify(rol)); setModo(); contarConflictos();
  } catch (e) { if (e.message === "Clave incorrecta.") { clave = ""; store.set("clave", null); store.set("rol", null); setModo() } }
}
$("#mode").onclick = () => { $("#k-clave").value = ""; $("#k-clave").type = "password"; $("#k-error").hidden = true; $("#k-salir").hidden = !clave; $("#dlg-k").showModal() };
$("#k-ver").onclick = () => { const i = $("#k-clave"); i.type = i.type === "password" ? "text" : "password"; i.focus() };
$("#k-clave").addEventListener("input", () => $("#k-error").hidden = true);
$("#form-k").onsubmit = async e => {
  e.preventDefault();
  const k = $("#k-clave").value.trim(); const prev = clave; clave = k;
  const btn = e.submitter || $("#form-k").querySelector('[type="submit"]'); btn.disabled = true; btn.textContent = "Probando…"; $("#k-error").hidden = true;
  try {
    const j = await api("probarClave", {});
    rol = j.rol || { admin: true, revisor: "" };
    store.set("clave", k); store.set("rol", JSON.stringify(rol)); $("#dlg-k").close();
    toast("Entraste como " + [rol.revisor, rol.admin ? "administración" : ""].filter(Boolean).join(" y ")); contarConflictos();
    if (typeof cargarComentarios === "function") cargarComentarios();
  }
  catch (err) {
    clave = prev; const box = $("#k-error");
    // El aviso va dentro de la ventana: el toast queda detrás del diálogo
    box.innerHTML = err.message === "Clave incorrecta."
      ? `<b>Clave incorrecta.</b> Revisa:<ul><li>Mayúsculas y minúsculas (toca 👁 para ver lo que escribiste).</li><li>Que sea exactamente la que está entre comillas en <code>CLAVE</code> o en <code>REVISORES</code> del código.</li><li>Si cambiaste la clave en el código: guardar 💾 y <b>Implementar → Administrar implementaciones → ✏️ → Nueva versión</b>. Sin la versión nueva, sigue valiendo la clave anterior.</li></ul>`
      : "No pude entrar: " + err.message.replace(/[<>&]/g, "");
    box.hidden = false;
  }
  finally { btn.disabled = false; btn.textContent = "Entrar" }
  setModo();
};
$("#k-salir").onclick = () => { clave = ""; store.set("clave", null); store.set("rol", null); setModo(); $("#dlg-k").close(); toast("Ahora estás en solo lectura") };

/* ---------- Pestañas ---------- */
document.querySelectorAll("nav.tabs button").forEach(b => b.onclick = () => show(b.dataset.tab));
function show(tab) {
  document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab));
  document.querySelectorAll("section.view").forEach(s => s.hidden = s.id !== "v-" + tab);
  store.set("tab", tab);
}
if (store.get("tab")) show(store.get("tab"));
document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => b.closest("dialog").close());

/* ---------- Listas ---------- */
function renderB() {
  const el = $("#list-b");
  if (!B.length) { el.innerHTML = `<div class="empty">Todavía no hay búsquedas.${clave ? " Toca <b>+ Nueva búsqueda</b> y anota la base, la fecha, la cadena exacta y cuántos resultados salieron." : ""}</div>`; return }
  el.innerHTML = B.map(b => {
    const nref = R.filter(r => r.busqueda === b.id).length;
    return `<div class="item" data-id="${esc(b.id)}" tabindex="0">
      <div class="top"><span class="t">${esc(b.base)}${Prisma.metodoDe(b) === "otros" ? ' <span class="meta">· otros métodos</span>' : ""}</span><span class="meta">${esc(fdate(b.fecha))} · ${Number(b.n || 0).toLocaleString("es-UY")} resultados · ${nref} ref.</span></div>
      <div class="q">${esc(b.cadena)}</div>
      ${b.filtros ? `<div class="meta">Filtros: ${esc(b.filtros)}</div>` : ""}
      ${safeUrl(b.link) ? `<div class="links"><a href="${esc(b.link)}" target="_blank" rel="noopener">Ver resultados ↗</a></div>` : ""}
    </div>`}).join("");
  el.querySelectorAll(".item a").forEach(a => a.onclick = e => e.stopPropagation());
  el.querySelectorAll(".item").forEach(i => { i.onclick = () => openB(i.dataset.id); i.onkeydown = e => { if (e.key === "Enter") openB(i.dataset.id) } });
}
function renderR() {
  const el = $("#list-r");
  const q = $("#f-text").value.trim().toLowerCase(), st = $("#f-estado").value, fb = $("#f-busq").value;
  const dupl = indiceDuplicados();
  const rows = R.filter(r => (st === "todos" || (!st ? r.estadoK !== "dup" : r.estadoK === st)) && (!fb || r.busqueda === fb) &&
    (!q || [r.codigo, r.titulo, r.autores, r.doi, r.notas, r.tema, r.revista].join(" ").toLowerCase().includes(q)));
  if (!R.length) { el.innerHTML = `<div class="empty">Sin referencias todavía.${clave ? " Agrega cada artículo que salga de tus búsquedas y ve cambiando su estado a medida que lo revisas." : ""}</div>`; return }
  if (!rows.length) { el.innerHTML = `<div class="empty">Ninguna referencia coincide con el filtro.</div>`; return }
  el.innerHTML = rows.map(r => {
    const link = safeUrl(r.link) || doiUrl(r.doi);
    const fechas = [r.creado ? "Registrada " + fdate(r.creado) : "", r.fechaBusqueda ? `Buscada ${fdate(r.fechaBusqueda)} en ${r.base}` : "",
      r.fechaCribado ? "Cribada " + fdate(r.fechaCribado) : "",
      r.estadoK !== "pend" && r.fechaEstado && r.fechaEstado !== r.fechaCribado ? `${r.estado} ${fdate(r.fechaEstado)}` : ""].filter(Boolean).join(" · ");
    return `<div class="item" data-id="${esc(r.codigo)}" tabindex="0">
      <div class="top"><span class="t"><span class="meta">${esc(r.codigo)}</span> ${esc(r.titulo)}</span><span class="pill s-${r.estadoK}">${esc(r.estado)}</span></div>
      <div class="meta">${esc([r.autores, r.anio, r.revista].filter(Boolean).join(" · "))}</div>
      ${r.tema || r.motivo ? `<div class="meta">${esc([r.tema, r.motivo ? "Motivo: " + r.motivo : ""].filter(Boolean).join(" · "))}</div>` : ""}
      ${fechas ? `<div class="meta">${esc(fechas)}</div>` : ""}
      ${dupl.de[r.codigo] ? `<div class="meta">🔁 Duplicado de <a href="#" data-ir="${esc(dupl.de[r.codigo])}">${esc(dupl.de[r.codigo])}</a></div>` : ""}
      ${(dupl.copias[r.codigo] || []).length ? `<div class="meta">🔁 También apareció en: ${dupl.copias[r.codigo].map(d => `${esc(d.base || "otra búsqueda")}${d.fechaBusqueda ? " " + esc(fdate(d.fechaBusqueda)) : ""} (<a href="#" data-ir="${esc(d.codigo)}">${esc(d.codigo)}</a>)`).join(", ")}</div>` : ""}
      ${link || safeUrl(r.pdf) || r.resumen ? `<div class="links">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">Ver en la fuente ↗</a>` : ""}${safeUrl(r.pdf) ? `<a href="${esc(r.pdf)}" target="_blank" rel="noopener">PDF ↗</a>` : ""}${r.resumen ? '<span class="meta">Con resumen</span>' : ""}${typeof nCom === "function" && nCom(r.codigo) ? `<span class="meta">💬 ${nCom(r.codigo)}</span>` : ""}</div>` : ""}
    </div>`}).join("");
  el.querySelectorAll(".item a").forEach(a => a.onclick = e => { e.stopPropagation(); if (a.dataset.ir) { e.preventDefault(); openR(a.dataset.ir) } });
  el.querySelectorAll(".item").forEach(i => { i.onclick = () => openR(i.dataset.id); i.onkeydown = e => { if (e.key === "Enter" && e.target === i) openR(i.dataset.id) } });
}
// Une cada duplicado con su original (mismo DOI o mismo título)
function indiceDuplicados() {
  const orig = new Map(), de = {}, copias = {};
  R.filter(r => r.estadoK !== "dup").forEach(r => {
    if (r.doi) orig.set("d:" + Importar.claveDoi(r.doi), r.codigo);
    if (r.titulo && !orig.has("t:" + Importar.claveTitulo(r.titulo))) orig.set("t:" + Importar.claveTitulo(r.titulo), r.codigo);
  });
  R.filter(r => r.estadoK === "dup").forEach(r => {
    const nota = (String(r.notas || "").match(/Duplicado de (R\d+)/) || [])[1];
    const o = (r.doi && orig.get("d:" + Importar.claveDoi(r.doi))) || orig.get("t:" + Importar.claveTitulo(r.titulo)) || nota;
    if (!o || o === r.codigo) return;
    de[r.codigo] = o; (copias[o] = copias[o] || []).push(r);
  });
  return { de, copias };
}
$("#f-text").oninput = renderR; $("#f-estado").onchange = renderR; $("#f-busq").onchange = renderR;

function renderP() {
  $("#prisma-svg").innerHTML = R.length || B.length ? Prisma.diagrama(B, R) : `<div class="empty">El diagrama se arma solo cuando registres búsquedas y referencias.</div>`;
  $("#acuerdo").innerHTML = acuerdoHtml();
  $("#tabla-busq").innerHTML = Prisma.tablaHtml(B);
  const t = Prisma.textoMetodos(B, R, ACU, PROT, EXT, SES);
  $("#txt-metodos").textContent = t.metodos; $("#txt-resultados").textContent = t.resultados;
  $("#txt-aviso").textContent = t.aviso; $("#txt-aviso").hidden = !t.aviso;
}
function descargar(nombre, contenido, tipo) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo }));
  a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
$("#dl-svg").onclick = () => descargar("diagrama-prisma-2020.svg", Prisma.diagrama(B, R), "image/svg+xml");
$("#dl-png").onclick = () => {
  const svg = Prisma.diagrama(B, R), img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = img.width * 2; c.height = img.height * 2;
    const g = c.getContext("2d"); g.scale(2, 2); g.drawImage(img, 0, 0);
    c.toBlob(b => descargar("diagrama-prisma-2020.png", b), "image/png");
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
};
$("#dl-tabla-doc").onclick = () => descargar("estrategias-de-busqueda.doc", Prisma.tablaWord(B), "application/msword");
$("#dl-tabla-csv").onclick = () => descargar("estrategias-de-busqueda.csv", Prisma.tablaCsv(B), "text/csv;charset=utf-8");
document.querySelectorAll("[data-copiar]").forEach(b => b.onclick = async () => {
  const el = $(b.dataset.copiar);
  try { await navigator.clipboard.writeText(el.textContent); toast("Copiado") }
  catch (e) { const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Texto seleccionado: cópialo") }
});
// Kappa de Cohen con la escala de Landis y Koch
function acuerdoHtml() {
  if (!ACU || !((ACU.fase1 && ACU.fase1.n) || (ACU.fase2 && ACU.fase2.n))) return "";
  const nivel = k => k < 0 ? "pobre" : k <= .2 ? "leve" : k <= .4 ? "aceptable" : k <= .6 ? "moderado" : k <= .8 ? "considerable" : "casi perfecto";
  const fila = (t, a) => a && a.n ? `<div class="box"><span>${t}<ul class="reasons"><li>${a.n} artículos cribados por los dos</li><li>Coincidieron en el ${Math.round(a.acuerdo * 100)}% · ${a.conflictos} conflicto${a.conflictos === 1 ? "" : "s"}</li><li>Acuerdo ${nivel(a.kappa)}</li></ul></span><b>κ ${a.kappa.toFixed(2).replace(".", ",")}</b></div>` : "";
  return `<div class="stage">Acuerdo entre revisores (kappa de Cohen)</div>${fila("Fase 1 · título y resumen", ACU.fase1)}${fila("Fase 2 · texto completo", ACU.fase2)}`;
}
function renderAll() {
  renderB(); renderR(); renderP(); renderExtra();
  fill($("#r-busqueda"), B.map(b => [b.id, `${b.base} · ${fdate(b.fecha)}`]), "Sin asociar");
  const fb = $("#f-busq").value;
  fill($("#f-busq"), B.map(b => [b.id, `${b.base} · ${fdate(b.fecha)}`]), "Todas las búsquedas");
  $("#f-busq").value = B.some(b => b.id === fb) ? fb : "";
  if ($("#dlg-c").open) renderCrib();
}

/* ---------- Diálogos ---------- */
function lock(form) {
  const ro = !clave || (form.id === "form-b" && !rol.admin);
  form.querySelectorAll("input,select,textarea").forEach(i => { if (i.type !== "file") i.disabled = ro });
  form.querySelector('button[type="submit"]').hidden = ro;
}
function histHtml(rows) {
  return rows.length ? `<span class="lbl">Historial (automático)</span><ol>${rows.map(h => `<li>${h.fecha ? esc(fdt(h.fecha)) + ": " : ""}${esc(h.accion)}${h.detalle ? " · " + esc(h.detalle) : ""}</li>`).join("")}</ol>` : "";
}
function openB(id) {
  editB = id; const d = id ? B.find(b => b.id === id) : {};
  $("#dlg-b-title").textContent = id ? "Búsqueda" : "Nueva búsqueda";
  $("#b-base").value = d.base || BASES[0]; $("#b-fecha").value = d.fecha || new Date().toLocaleDateString("sv");
  $("#b-cadena").value = d.cadena || ""; $("#b-filtros").value = d.filtros || ""; $("#b-n").value = d.n ?? "";
  $("#b-metodo").value = Prisma.metodoDe(id ? d : { base: $("#b-base").value });
  $("#b-campos").value = d.campos || ""; $("#b-notas").value = d.notas || ""; $("#b-del").hidden = !id || !clave || !rol.admin;
  const hist = id ? [{ fecha: d.creado, accion: "Registrada" }, ...(d.actualizado && d.actualizado !== d.creado ? [{ fecha: d.actualizado, accion: "Última edición" }] : [])] : [];
  $("#b-hist").innerHTML = histHtml(hist); $("#b-hist").hidden = !id;
  $("#bl-url").value = ""; $("#imp-file").value = ""; $("#imp-res").hidden = true; importando = null; actualizando = null;
  $("#upd-btn").hidden = !id || !clave || !rol.admin;
  $("#feed-url").value = ""; $("#feed-box").open = false;
  $("#b-link").value = d.link || ((String(d.notas || "").match(/Link de resultados: (\S+)/) || [])[1] || ""); mostrarPm();
  lock($("#form-b")); $("#dlg-b").showModal();
}
function openR(codigo) {
  editR = codigo; const d = codigo ? R.find(r => r.codigo === codigo) : {};
  $("#dlg-r-title").textContent = codigo ? `Referencia ${codigo}` : "Nueva referencia";
  for (const k of ["titulo", "autores", "anio", "revista", "doi", "link", "resumen", "motivo", "tema", "notas"]) $("#r-" + k).value = d[k] ?? "";
  $("#r-busqueda").value = d.busqueda || ""; $("#r-estado").value = d.estadoK || "pend"; $("#r-del").hidden = !codigo || !clave || !rol.admin;
  $("#r-drive").value = ""; pdfFile = null; $("#r-pdf").value = "";
  $("#auto-in").value = ""; pdfAbierto = ""; uruguayAuto = d.uruguay || ""; $("#oa-box").hidden = true;
  mostrarUy(uruguayAuto ? { texto: uruguayAuto, ok: !/^No /.test(uruguayAuto) } : null);
  renderPdf(d); updNombre();
  const hist = codigo ? H.filter(h => h.codigo === codigo) : [];
  const dupl = codigo ? indiceDuplicados() : { de: {}, copias: {} };
  const extra = (dupl.copias[codigo] || []).map(d => ({ fecha: d.creado, accion: "También apareció en " + (d.base || "otra búsqueda"), detalle: d.codigo }))
    .concat(dupl.de[codigo] ? [{ fecha: "", accion: "Duplicado de " + dupl.de[codigo], detalle: "" }] : []);
  $("#r-hist").innerHTML = histHtml(hist.concat(extra)); $("#r-hist").hidden = !hist.length && !extra.length;
  $("#r-com").hidden = !codigo || !clave;
  $("#r-com").textContent = `💬 Comentarios${codigo && typeof nCom === "function" && nCom(codigo) ? ` (${nCom(codigo)})` : ""}`;
  lock($("#form-r"));
  // El estado lo deciden los revisores en el cribado doble ciego
  if (clave && !rol.admin) { $("#r-estado").disabled = true; $("#r-motivo").disabled = true }
  $("#dlg-r").showModal();
}
function renderPdf(d) {
  const box = $("#pdf-cur");
  if (pdfFile) { box.innerHTML = `<span class="progress">Listo para subir al guardar: ${esc(pdfFile.name)} (${(pdfFile.size / 1048576).toFixed(1)} MB)</span>`; return }
  if (safeUrl(d.pdf)) {
    box.innerHTML = `<a class="links" href="${esc(d.pdf)}" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600">${esc(d.pdfNombre || "Abrir PDF")} ↗</a>${d.pdfFecha ? `<span class="meta">Guardado ${esc(fdate(d.pdfFecha))}</span>` : ""}`;
    return;
  }
  box.innerHTML = `<span class="meta">Sin PDF.${d.link || d.doi ? " Puedes buscarlo en la fuente." : ""}</span>`;
}
function updNombre() {
  const t = $("#r-titulo").value.trim();
  $("#r-nombre").textContent = t ? nombrePdf({ codigo: editR || proximoCodigo(), autores: $("#r-autores").value, anio: $("#r-anio").value, titulo: t }) : "Se genera al completar autor, año y título";
}
["#r-autores", "#r-anio", "#r-titulo"].forEach(s => $(s).addEventListener("input", updNombre));
$("#r-pdf").onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > MAX_PDF) { toast("El PDF pesa más de 30 MB y no se puede subir. Guárdalo en Drive y pega el link."); e.target.value = ""; return }
  pdfFile = f; renderPdf({});
};
const leerBase64 = f => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = mal; r.readAsDataURL(f) });

/* ---------- Autocompletar por DOI, PMID o link ---------- */
function mostrarUy(c) {
  const el = $("#uy-check");
  if (!c) { el.hidden = true; return }
  el.hidden = false; el.className = "uycheck " + (c.ok ? "ok" : "warn"); el.textContent = (c.ok ? "🇺🇾 " : "⚠️ ") + c.texto;
}
function textoUy(c) {
  if (c.afUy) return "Autores con afiliación en Uruguay" + (c.inst.length ? ": " + c.inst.slice(0, 3).join(", ") : "") + (c.menciona ? ". Menciona Uruguay en título o resumen." : ".");
  if (c.menciona) return "Menciona Uruguay en el título o el resumen (sin afiliación uruguaya detectada).";
  return "No se detectó Uruguay en las afiliaciones ni en el título o el resumen. Revisa si cumple el criterio de inclusión.";
}
$("#auto-btn").onclick = async () => {
  const entrada = $("#auto-in").value.trim();
  if (!entrada) { toast("Pega primero el DOI, el PMID o el link."); return }
  const btn = $("#auto-btn"); btn.disabled = true; btn.textContent = "Buscando…";
  try {
    const d = await Autocompletar.buscar(entrada);
    let n = 0;
    for (const k of ["titulo", "autores", "anio", "revista", "doi", "link", "resumen"]) {
      const v = String(d[k] ?? "").trim();
      if (v && !$("#r-" + k).value.trim()) { $("#r-" + k).value = v; n++ }
    }
    if (!$("#r-link").value && /^https?:\/\//i.test(entrada)) $("#r-link").value = entrada;
    updNombre();
    const c = Autocompletar.chequeoUruguay(d);
    uruguayAuto = textoUy(c); mostrarUy({ texto: uruguayAuto, ok: c.afUy || c.menciona });
    pdfAbierto = safeUrl(d.pdfAbierto);
    const box = $("#oa-box");
    if (pdfAbierto && !pdfFile) {
      box.hidden = false;
      box.innerHTML = `<div class="oa"><a href="${esc(pdfAbierto)}" target="_blank" rel="noopener" style="color:var(--ok);font-weight:600">PDF de acceso abierto disponible ↗</a>
        <label><input type="checkbox" id="oa-guardar" checked> Guardarlo solo en Drive al guardar la referencia</label></div>`;
    } else if (d.linkAbierto) {
      box.hidden = false;
      box.innerHTML = `<div class="oa"><a href="${esc(d.linkAbierto)}" target="_blank" rel="noopener" style="color:var(--ok);font-weight:600">Versión de acceso abierto ↗</a><span class="note">Ábrela, baja el PDF y súbelo con «Subir PDF».</span></div>`;
    } else box.hidden = true;
    toast(n ? `Completé ${n} campo${n > 1 ? "s" : ""} con datos de ${d.fuentes.join(", ")}. Revísalos.` : "No había campos vacíos para completar.", 4000);
  } catch (e) {
    if (e.message === "sin-id") {
      if (/^https?:\/\//i.test(entrada) && !$("#r-link").value) $("#r-link").value = entrada;
      toast("No encontré un DOI ni un PMID ahí. Guardé el link; busca el DOI en la página del artículo y pégalo para completar el resto.", 6000);
    } else toast("No encontré ese artículo en OpenAlex, Crossref ni PubMed. Complétalo a mano.", 5000);
  } finally { btn.disabled = false; btn.textContent = "Completar" }
};
$("#auto-in").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#auto-btn").click() } });

/* ---------- Importar resultados (RIS, PubMed, XML) ---------- */
let importando = null;
$("#imp-file").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  let leido;
  try { leido = Importar.leer(await f.text()) }
  catch (err) { $("#imp-res").hidden = false; $("#imp-res").innerHTML = `<span class="uycheck warn">No reconozco el formato de «${esc(f.name)}». Usa RIS, BibTeX, CSV, formato PubMed o XML.</span>`; importando = null; return }
  const nombres = { ris: "RIS", pubmed: "PubMed", xml: "XML de PubMed", dc: "XML de repositorio", feed: "hilo RSS/Atom", bibtex: "BibTeX", csv: "CSV" };
  mostrarImportacion(f.name, `en el archivo (${nombres[leido.formato]})`, leido);
};
// Muestra el resumen de lo que se va a importar y lo deja listo para guardar
function mostrarImportacion(origen, donde, leido, aviso) {
  const res = $("#imp-res"); res.hidden = false;
  let refs = Importar.marcarDuplicados(leido.refs, R).map(r => {
    const c = Autocompletar.chequeoUruguay(r);
    return { ...r, uruguay: textoUy(c), esUy: c.afUy || c.menciona };
  });
  // Al actualizar una búsqueda solo interesa lo nuevo: lo que ya estaba registrado no se vuelve a cargar
  let yaEstaban = 0;
  if (actualizando) { const antes = refs.length; refs = refs.filter(r => !/^R\d+$/.test(r.duplicadoDe || "")); yaEstaban = antes - refs.length }
  const dups = refs.filter(r => r.duplicadoDe).length, uy = refs.filter(r => r.esUy).length;
  importando = { archivo: origen, refs };
  // Completa la búsqueda con lo que trae el archivo
  if (actualizando) $("#b-n").value = refs.length;
  else if (!editB || !Number($("#b-n").value)) $("#b-n").value = leido.total ?? refs.length;
  if (leido.base && !editB) $("#b-base").value = leido.base;
  res.innerHTML = `<span><b>${refs.length}</b> artículos ${donde}.</span>
    ${aviso ? `<span class="uycheck warn">${esc(aviso)}</span>` : ""}
    <span>${refs.length - dups} nuevos · ${dups} duplicados${dups ? " (ya estaban en el registro o repetidos)" : ""}.</span>
    ${actualizando ? `<span>🔄 ${yaEstaban} ya estaban registrados de la búsqueda anterior y no se vuelven a cargar.</span>` : ""}
    <span>🇺🇾 ${uy} con autores de Uruguay o que mencionan Uruguay.</span>
    ${leido.soloUy ? `<label><input type="checkbox" id="imp-uy" checked> Cargar solo los ${uy} relacionados con Uruguay</label>` : ""}
    ${dups ? `<label><input type="checkbox" id="imp-dups" checked> Registrar los duplicados con estado «Duplicado» (cuentan en PRISMA)</label>` : ""}
    ${editB ? `<button type="button" class="btn" id="imp-go">Importar</button>` : `<span class="note" id="imp-go-nota"></span>`}`;
  const chk = $("#imp-dups"), go = $("#imp-go"), nota = $("#imp-go-nota"), chkUy = $("#imp-uy");
  const etiqueta = () => {
    const n = refs.filter(r => (!chk || chk.checked || !r.duplicadoDe) && (!chkUy || !chkUy.checked || r.esUy)).length, t = `${n} artículo${n === 1 ? "" : "s"}`;
    if (go) go.textContent = "Importar " + t;
    if (nota) nota.textContent = `Al guardar la búsqueda se ${n === 1 ? "carga" : "cargan"} ${t} en Referencias.`;
  };
  if (chk) chk.onchange = etiqueta;
  if (chkUy) chkUy.onchange = etiqueta;
  etiqueta();
  if (go) { if (!refs.length) go.hidden = true; go.onclick = () => importarAhora() }
}
// Rastreo de citas hacia atrás y hacia adelante de los estudios incluidos
$("#cit-btn").onclick = async () => {
  const inc = R.filter(r => r.estadoK === "inc");
  if (!inc.length) { toast("Primero tiene que haber estudios incluidos."); return }
  const btn = $("#cit-btn"); btn.disabled = true;
  try {
    const leido = await Importar.rastreoCitas(inc, t => btn.textContent = t);
    leido.soloUy = true;
    $("#b-base").value = "Otra"; $("#b-metodo").value = "otros";
    $("#b-cadena").value = `Rastreo de citas hacia atrás (referencias citadas) y hacia adelante (artículos que los citan) de ${leido.estudios} estudios incluidos, con OpenAlex.`;
    $("#b-campos").value = "No aplica"; $("#b-filtros").value = "Ninguno";
    mostrarImportacion("Rastreo de citas (OpenAlex)", "encontrados en el rastreo de citas", leido,
      leido.sinDoi ? `${leido.sinDoi} estudio${leido.sinDoi === 1 ? "" : "s"} incluido${leido.sinDoi === 1 ? "" : "s"} sin DOI no se pudieron rastrear: revisa sus referencias a mano.` : "");
  } catch (e) { toast("No pude hacer el rastreo de citas: " + e.message, 7000) }
  finally { btn.disabled = false; btn.textContent = "🔁 Rastreo de citas de los estudios incluidos" }
};
// Actualizar una búsqueda: la repite hoy y carga solo lo nuevo
let actualizando = null;
$("#upd-btn").onclick = () => {
  const b = B.find(x => x.id === editB); if (!b) return;
  $("#dlg-b").close(); openB(null);
  actualizando = b.id;
  $("#dlg-b-title").textContent = "Actualizar búsqueda";
  $("#b-base").value = b.base; $("#b-metodo").value = Prisma.metodoDe(b);
  $("#b-cadena").value = b.cadena || ""; $("#b-filtros").value = b.filtros || ""; $("#b-campos").value = b.campos || "";
  $("#b-link").value = b.link || ""; mostrarPm();
  $("#b-notas").value = `Actualización de la búsqueda del ${fdate(b.fecha)} (${b.id}). Solo se cargan los registros nuevos.`;
  if (!$("#pm-btn").hidden) $("#pm-btn").click();
  else if ($("#feed-url").value) $("#feed-btn").click();
  else toast("Repite la búsqueda en la base y adjunta el archivo de resultados: solo se cargarán los artículos nuevos.", 7000);
};

// PubMed deja pedir los resultados de una búsqueda: los traemos con el link
$("#pm-btn").onclick = async () => {
  const btn = $("#pm-btn"); btn.disabled = true;
  try {
    const leido = await Importar.traerPubmed($("#b-link").value, t => btn.textContent = t);
    mostrarImportacion("PubMed (link)", "traídos de PubMed", leido, leido.aviso);
  } catch (e) { toast("No pude traer los artículos de PubMed: " + e.message, 7000) }
  finally { btn.disabled = false; btn.textContent = "Traer artículos de PubMed" }
};
$("#b-base").addEventListener("change", () => { $("#b-metodo").value = Prisma.OTROS_POR_DEFECTO.includes($("#b-base").value) ? "otros" : "bases" });
$("#bl-btn").onclick = () => {
  const d = Importar.leerLink($("#bl-url").value);
  if (!d) { toast("Eso no parece un link. Copia la dirección completa de la barra del navegador."); return }
  if (BASES.includes(d.base)) { $("#b-base").value = d.base; $("#b-base").dispatchEvent(new Event("change")) }
  if (d.cadena) $("#b-cadena").value = d.cadena;
  if (d.filtros) $("#b-filtros").value = d.filtros;
  $("#b-link").value = d.link; mostrarPm();
  if (/bvsalud/.test(d.sitio) && d.cadena) { contarBvs(d.link); return }
  toast(d.cadena ? `Listo: ${d.base}${d.filtros ? ", con filtros" : ""}. Revisa los campos y completa la cantidad de resultados si no adjuntas archivo.`
    : `Reconocí ${d.base}, pero el link no trae la búsqueda escrita. Cópiala a mano en «Cadena de búsqueda».`, 6000);
};
// BVS/LILACS: el motor baja los resultados y se lee el total (primero en XML, si no en la página)
async function contarBvs(link) {
  toast("Leyendo cuántos resultados hay en la BVS…", 15000);
  const total = texto => {
    const m = texto.match(/numFound="(\d+)"/) || texto.match(/<total[^>]*>\s*([\d.,]+)/i)
      || texto.replace(/<[^>]+>/g, " ").match(/(?:Resultados?|Results?)\s*:?\s*\d+\s*[-–]\s*\d+\s+(?:de|of|do)\s+([\d.,]+)/i);
    return m ? Number(m[1].replace(/[.,\s]/g, "")) : NaN;
  };
  let n = NaN;
  const xml = new URL(link); xml.searchParams.set("output", "xml"); xml.searchParams.set("count", "1");
  for (const u of [xml.href, link]) {
    try { const r = await api("traerUrl", { url: u }); n = total(r.texto || ""); if (n >= 0) break } catch (e) { }
  }
  if (n >= 0) { $("#b-n").value = n; toast(`Listo: ${$("#b-base").value}, ${n} resultados. Compara con el número que muestra la BVS.`, 7000) }
  else toast("Completé la base, la cadena y los filtros, pero no pude leer cuántos resultados hay: anótalo a mano (está arriba de la lista en la BVS).", 8000);
}
function mostrarPm() {
  $("#pm-btn").hidden = !/pubmed\.ncbi\.nlm\.nih\.gov\/.*term=/i.test($("#b-link").value);
  const hilo = Importar.linkHiloColibri($("#b-link").value);
  if (hilo && !$("#feed-url").value) { $("#feed-url").value = hilo; $("#feed-box").open = true }
}
$("#feed-btn").onclick = async () => {
  const url = $("#feed-url").value.trim() || Importar.linkHiloColibri($("#b-link").value);
  if (!/^https?:\/\//i.test(url)) { toast("Pega el link del hilo RSS/Atom o del XML."); return }
  $("#feed-url").value = url;
  const btn = $("#feed-btn"); btn.disabled = true;
  try {
    const leido = await Importar.traerHilo(url, async u => api("traerUrl", { url: u }), t => btn.textContent = t);
    const avisos = [];
    if (leido.total > leido.refs.length) avisos.push(`El sitio dice que hay ${leido.total} resultados y llegaron ${leido.refs.length}.`);
    // El hilo de Colibri solo usa el texto buscado: los filtros (años, tipo…) no se aplican
    if (/colibri/.test(url) && $("#b-filtros").value.trim()) avisos.push("El hilo de Colibri no aplica los filtros de la búsqueda (años, tipo de documento…): trae todo lo que coincide con el texto. Compara la cantidad con la de Colibri y descarta lo que no corresponda al cribar.");
    const aviso = avisos.join(" ");
    mostrarImportacion(new URL(url).hostname, "traídos del hilo", leido, aviso);
  } catch (e) {
    toast(e.message === "Acción desconocida." ? "Para traer hilos hay que actualizar el código del motor (Apps Script)."
      : "No pude traer el hilo: " + e.message + ". Prueba descargarlo y adjuntarlo como archivo.", 8000);
  } finally { btn.disabled = false; btn.textContent = "Traer" }
};
$("#b-link").addEventListener("input", mostrarPm);
$("#bl-url").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#bl-btn").click() } });
// Carga los artículos del archivo en la búsqueda indicada (de a 50 por pedido)
async function importarA(busqueda, progreso) {
  const conDups = !$("#imp-dups") || $("#imp-dups").checked;
  const soloUy = $("#imp-uy") && $("#imp-uy").checked;
  const lista = importando.refs.filter(r => (conDups || !r.duplicadoDe) && (!soloUy || r.esUy)).map(r => ({
    titulo: r.titulo, autores: r.autores, anio: r.anio, revista: r.revista, doi: r.doi, link: r.link, resumen: r.resumen,
    uruguay: r.uruguay, estado: r.duplicadoDe ? "dup" : "pend", notas: [r.duplicadoDe ? "Duplicado de " + r.duplicadoDe : "", r.notas || ""].filter(Boolean).join(" · "),
  }));
  let hechos = 0;
  try {
    for (let i = 0; i < lista.length; i += 50) {
      progreso(`Importando… ${hechos} de ${lista.length}`);
      await api("importarReferencias", { busqueda, archivo: importando.archivo, referencias: lista.slice(i, i + 50) });
      hechos += Math.min(50, lista.length - i);
    }
  } catch (e) {
    throw new Error(e.message === "Acción desconocida." ? "falta actualizar el código de Apps Script para poder importar (ver README: «Si cambias el código de Apps Script»)."
      : `se importaron ${hechos} de ${lista.length}. ${e.message}`);
  }
  importando = null;
  return hechos;
}
async function importarAhora() {
  const go = $("#imp-go"); go.disabled = true;
  try {
    const n = await importarA(editB, t => go.textContent = t);
    $("#dlg-b").close(); toast(`Importé ${n} artículo${n === 1 ? "" : "s"}. Están en Referencias como «Pendiente de cribado».`, 5000);
    await cargar(true); show("referencias");
  } catch (e) { go.disabled = false; go.textContent = "Reintentar"; toast("No se pudo importar: " + e.message, 9000) }
}

/* ---------- Resaltado de palabras clave al cribar ---------- */
const DEPARTAMENTOS = ["Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida", "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha", "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres"];
const PAL_INCLUIR = "Uruguay, uruguayo, uruguaya, Montevideo, Canelones, Paysandú, Tacuarembó, Treinta y Tres, Cerro Largo, Maldonado, agua potable, agua de consumo, agua de bebida, agua de canilla, agua de la canilla, agua corriente, red pública, drinking water, tap water, potable water, OSE, pozo, pozos, well water, cianobacteria, cianobacterias, cyanobacteria, cyanobacterial, cianotoxina, cianotoxinas, cyanotoxin, cyanotoxins, microcistina, microcistinas, microcystin, microcystins, saxitoxina, saxitoxin, cilindrospermopsina, cylindrospermopsin, anatoxina, anatoxin, floración, floraciones, bloom, blooms, agrotóxico, agrotóxicos, agroquímico, agroquímicos, plaguicida, plaguicidas, pesticida, pesticidas, pesticide, pesticides, herbicida, herbicide, glifosato, glyphosate, AMPA, atrazina, atrazine, 2,4-D, clorpirifos, chlorpyrifos, endosulfán, endosulfan, imidacloprid, salud, health, humanos, humans, niños, children, embarazadas, orina, urine, biomarcador, biomarker";
const PAL_SECUNDARIAS = "trihalometano, trihalometanos, trihalomethane, trihalomethanes, THM, cloroformo, chloroform, subproductos de la desinfección, disinfection byproducts, sodio, sodium, cloruro, cloruros, chloride, salinidad, salinity, crisis hídrica, nitrato, nitratos, nitrate, nitrates, nitrito, nitrite, metahemoglobinemia, methemoglobinemia, arsénico, arsenic, plomo, lead, plombemia, metales pesados, heavy metals, microplástico, microplásticos, microplastic, microplastics";
const PAL_EXCLUIR = "Argentina, Brasil, Brazil, Chile, Paraguay, México, recreativa, recreativas, recreational, playa, playas, beach, beaches, balneario, bañistas, bathing, swimming, aguas residuales, wastewater, riego, irrigation, animal, animales, ganado, bovino, bovinos, cattle, ovinos, peces, fish, ratas, ratones, rats, mice, in vitro, revisión narrativa, editorial";
const palabras = t => String(t || "").split(/[,;\n]/).map(x => x.trim()).filter(x => x.length > 1);
function resaltar(texto) {
  let h = esc(texto);
  const sinTilde = w => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/a/gi, "[aá]").replace(/e/gi, "[eé]").replace(/i/gi, "[ií]").replace(/o/gi, "[oó]").replace(/u/gi, "[uúü]").replace(/n/gi, "[nñ]");
  const marcar = (lista, clase) => {
    const ws = palabras(lista).sort((a, b) => b.length - a.length);
    if (!ws.length) return;
    const re = new RegExp(`(^|[^\\p{L}])(${ws.map(sinTilde).join("|")})(?=$|[^\\p{L}])`, "giu");
    // Solo en el texto, nunca dentro de una etiqueta ya marcada
    h = h.split(/(<[^>]+>)/).map((t, i) => i % 2 ? t : t.replace(re, (m, a, w) => `${a}<mark class="${clase}">${w}</mark>`)).join("");
  };
  marcar(PROT.palabrasIncluir || PAL_INCLUIR, "mi");
  marcar(PROT.palabrasSecundarias || PAL_SECUNDARIAS, "ms");
  marcar(PROT.palabrasExcluir || PAL_EXCLUIR, "mx");
  return h;
}

/* ---------- Cribado: artículo por artículo ---------- */
const MOTIVOS = ["No es en Uruguay", "No es agua de consumo humano", "Agua recreativa", "No evalúa salud humana", "Salud animal o estudio en animales", "Contaminante fuera del alcance", "Diseño no elegible", "No es un estudio original"];
let cribActual = null, cribHist = [], cribSaltados = new Set();
let PRIO = { puntajes: new Map(), modelo: { listo: false, pos: 0, neg: 0 } };
function calcularPrioridad() {
  const lista = R.filter(r => r.estadoK === "pend" || r.estadoK === "ft");
  PRIO = Prioridad.puntuar(R, lista, { incluir: palabras(PROT.palabrasIncluir || PAL_INCLUIR), excluir: palabras(PROT.palabrasExcluir || PAL_EXCLUIR), secundarias: palabras(PROT.palabrasSecundarias || PAL_SECUNDARIAS) });
}
function colaFase() {
  const fase = $("#c-fase").value, fb = $("#f-busq").value, porProb = $("#c-orden").value === "prob";
  return R.filter(r => r.estadoK === fase && (!fb || r.busqueda === fb) && !cribSaltados.has(r.codigo) && !(doble && mias.has(claveDec(r.codigo, faseNum()))))
    .sort((a, b) => porProb ? (PRIO.puntajes.get(b.codigo) || 0) - (PRIO.puntajes.get(a.codigo) || 0) : String(a.codigo).localeCompare(String(b.codigo)));
}
function renderCrib() {
  const fase = $("#c-fase").value, cola = colaFase();
  const total = doble ? cola.length + cribSaltados.size : R.filter(r => r.estadoK === fase && (!$("#f-busq").value || r.busqueda === $("#f-busq").value)).length;
  if (!cribActual || cribActual.estadoK !== fase || cribSaltados.has(cribActual.codigo) || (doble && mias.has(claveDec(cribActual.codigo, faseNum())))) cribActual = cola[0] || null;
  else cribActual = R.find(r => r.codigo === cribActual.codigo) || cola[0] || null;
  $("#c-excl").hidden = true; $("#c-undo").hidden = !cribHist.length;
  const hechas = [...mias.keys()].filter(k => k.endsWith("|" + faseNum())).length;
  const otro = doble && otroAvance && otroAvance.revisor ? ` · ${otroAvance.revisor} lleva ${otroAvance["fase" + faseNum()]}` : "";
  $("#c-prog").textContent = (total ? `Te quedan ${total}${cribSaltados.size ? ` (${cribSaltados.size} saltados)` : ""}` : "") + (doble ? ` · Llevas ${hechas}${otro}` : "");
  $("#c-quien").textContent = doble ? `Cribando como ${rol.revisor} · doble ciego: no ves las decisiones del otro revisor` : "Cribado directo (administración): cada decisión cambia el estado enseguida";
  $("#c-si").textContent = fase === "pend" ? "✓ Pasa" : "✓ Incluir";
  $("#c-dup").hidden = fase !== "pend"; $("#c-quiza").hidden = fase !== "pend"; $("#c-nr").hidden = fase === "pend";
  const card = $("#c-card");
  if (!cribActual) {
    $("#c-btns").hidden = true;
    card.innerHTML = `<div class="empty">${cribSaltados.size ? `No quedan más, salvo ${cribSaltados.size} que saltaste. <button type="button" class="btn ghost" id="c-reset">Volver a ver los saltados</button>`
      : doble ? `¡Terminaste esta fase! 🎉 Cuando ${otroAvance && otroAvance.revisor ? otroAvance.revisor : "el otro revisor"} también termine, los desacuerdos aparecen en «⚖️ Conflictos».`
      : fase === "pend" ? "¡No quedan artículos pendientes de cribado! 🎉" : "No hay artículos esperando la lectura a texto completo."}</div>`;
    const rs = $("#c-reset"); if (rs) rs.onclick = () => { cribSaltados.clear(); renderCrib() };
    return;
  }
  $("#c-btns").hidden = false;
  const r = cribActual, link = safeUrl(r.link) || doiUrl(r.doi), uy = r.uruguay || "";
  const prob = PRIO.puntajes.get(r.codigo), nc = typeof nCom === "function" ? nCom(r.codigo) : 0;
  card.innerHTML = `<div class="meta">${esc(r.codigo)}${r.base ? " · " + esc(r.base) : ""}${prob != null ? ` · <span class="prob" title="${PRIO.modelo.listo ? `Aprendido de ${PRIO.modelo.pos} que pasaron y ${PRIO.modelo.neg} excluidos, más las palabras del protocolo` : "Según las palabras del protocolo y el chequeo de Uruguay (aprende después de 5 que pasen y 5 excluidos)"}">🧠 ${Math.round(prob * 100)} % probable</span>` : ""}</div>
    <h3>${resaltar(r.titulo)}</h3>
    <div class="meta">${esc([r.autores, r.anio, r.revista].filter(Boolean).join(" · "))}</div>
    ${uy ? `<div class="uycheck ${/^No se detect/.test(uy) ? "warn" : "ok"}">${/^No se detect/.test(uy) ? "⚠️ " : "🇺🇾 "}${esc(uy)}</div>` : ""}
    <div class="abs">${r.resumen ? resaltar(r.resumen) : '<span class="meta">Sin resumen cargado.</span>'}</div>
    <div class="links">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">Ver en la fuente ↗</a>` : ""}${safeUrl(r.pdf) ? `<a href="${esc(r.pdf)}" target="_blank" rel="noopener">PDF ↗</a>` : ""}<a href="#" id="c-editar">Editar ficha</a><a href="#" id="c-com">💬 Comentarios${nc ? ` (${nc})` : ""}</a></div>`;
  $("#c-editar").onclick = e => { e.preventDefault(); $("#dlg-c").close(); openR(r.codigo) };
  $("#c-com").onclick = e => { e.preventDefault(); abrirComentarios(r.codigo) };
  card.scrollTop = 0;
}
async function abrirCrib() {
  cribSaltados.clear(); cribHist = []; cribActual = null;
  doble = !!(rol && (rol.revisor === "Revisor 1" || rol.revisor === "Revisor 2"));
  mias = new Map(); otroAvance = null;
  if (doble) {
    const btn = $("#crib-btn"); btn.disabled = true; btn.textContent = "Cargando…";
    try {
      const j = await api("misDecisiones", {});
      j.mias.forEach(m => mias.set(claveDec(m.codigo, m.fase), m)); otroAvance = j.otro;
    } catch (e) { toast("No pude cargar tus decisiones: " + e.message, 6000); return }
    finally { btn.disabled = false; btn.textContent = "▶ Cribar" }
  }
  $("#c-fase").value = R.some(r => r.estadoK === "pend") || !R.some(r => r.estadoK === "ft") ? "pend" : "ft";
  $("#c-motivos").innerHTML = MOTIVOS.map(m => `<button type="button">${esc(m)}</button>`).join("");
  $("#c-motivos").querySelectorAll("button").forEach(b => b.onclick = () => decidir(fase2Excl(), b.textContent));
  calcularPrioridad(); renderCrib(); actualizarGuardado(); $("#dlg-c").showModal();
}
const fase2Excl = () => $("#c-fase").value === "pend" ? "exta" : "extc";
function decidir(estado, motivo) {
  const r = cribActual; if (!r) return;
  if (doble) {
    const fase = faseNum(), decision = motivo === "__quiza" ? "quiza" : { ft: "si", inc: "si", exta: "no", extc: "no", dup: "dup", nr: "nr" }[estado];
    if (motivo === "__quiza") motivo = "";
    mias.set(claveDec(r.codigo, fase), { codigo: r.codigo, fase: String(fase), decision, motivo: motivo || "" });
    cribHist.push({ doble: true, codigo: r.codigo, fase });
    colaCrib.push({ doble: true, codigo: r.codigo, fase, decision, motivo: motivo || "" }); procesarCola();
    cribActual = null; renderCrib(); return;
  }
  cribHist.push({ codigo: r.codigo, estadoK: r.estadoK, estado: r.estado, motivo: r.motivo, notas: r.notas });
  if (motivo === "__quiza") { motivo = ""; r.notas = [r.notas, "Quizás en el cribado por título y resumen"].filter(Boolean).join(" · ") }
  r.estadoK = estado; r.estado = estadoLabel(estado); r.motivo = motivo || "";
  colaCrib.push({ ...r }); procesarCola();
  cribActual = null; renderCrib(); renderR(); renderP();
}
async function procesarCola() {
  if (procesarCola.activo) return; procesarCola.activo = true;
  while (colaCrib.length) {
    actualizarGuardado(); if (typeof guardarColaLocal === "function") guardarColaLocal();
    if (!navigator.onLine) break; // se retoma con el evento «online»
    const r = colaCrib[0];
    if (r.doble) {
      try { await api("decidir", { codigo: r.codigo, fase: r.fase, decision: r.decision, motivo: r.motivo }); colaCrib.shift() }
      catch (e) {
        if (/ya no está en esta fase|Solo el Revisor|Clave incorrecta/.test(e.message)) { colaCrib.shift(); toast(e.message, 6000) }
        else { toast("No se pudo guardar " + r.codigo + ": " + e.message + ". Reintento en unos segundos.", 5000); await new Promise(ok => setTimeout(ok, 5000)) }
      }
      continue;
    }
    try {
      await api("guardarReferencia", { codigo: r.codigo, titulo: r.titulo, autores: r.autores, anio: r.anio, revista: r.revista, doi: r.doi,
        link: r.link, resumen: r.resumen, busqueda: r.busqueda, estado: r.estadoK, motivo: r.motivo, tema: r.tema, notas: r.notas, uruguay: r.uruguay });
      colaCrib.shift();
    } catch (e) {
      toast("No se pudo guardar " + r.codigo + ": " + e.message + ". Reintento en unos segundos.", 5000);
      await new Promise(ok => setTimeout(ok, 5000));
    }
  }
  procesarCola.activo = false; actualizarGuardado(); if (typeof guardarColaLocal === "function") guardarColaLocal();
  if (colaCrib.length) return;
  await cargar(true); contarConflictos();
}
function actualizarGuardado() { $("#c-guard").textContent = colaCrib.length ? (navigator.onLine ? `Guardando ${colaCrib.length}…` : `📴 ${colaCrib.length} para guardar cuando vuelva internet`) : "✓ Todo guardado" }
$("#crib-btn").onclick = abrirCrib;
$("#c-cerrar").onclick = () => $("#dlg-c").close();
$("#c-fase").onchange = () => { cribActual = null; cribSaltados.clear(); renderCrib() };
$("#c-orden").onchange = () => { cribActual = null; calcularPrioridad(); renderCrib(); store.set("orden", $("#c-orden").value) };
if (store.get("orden")) $("#c-orden").value = store.get("orden");
$("#c-si").onclick = () => decidir($("#c-fase").value === "pend" ? "ft" : "inc");
$("#c-no").onclick = () => { $("#c-excl").hidden = false; $("#c-motivo").value = ""; $("#c-excl").scrollIntoView({ block: "nearest" }) };
$("#c-excl-ok").onclick = () => decidir(fase2Excl(), $("#c-motivo").value.trim());
$("#c-motivo").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#c-excl-ok").click() } });
$("#c-dup").onclick = () => decidir("dup");
$("#c-quiza").onclick = () => decidir("ft", "__quiza");
$("#c-nr").onclick = () => decidir("nr", "Texto completo no disponible");
$("#c-skip").onclick = () => { if (cribActual) { cribSaltados.add(cribActual.codigo); cribActual = null; renderCrib() } };
function deshacer() {
  const h = cribHist.pop(); if (!h) return;
  if (h.doble) {
    mias.delete(claveDec(h.codigo, h.fase));
    colaCrib.push({ doble: true, codigo: h.codigo, fase: h.fase, decision: "" }); procesarCola();
    cribActual = R.find(x => x.codigo === h.codigo) || null; renderCrib(); return;
  }
  const r = R.find(x => x.codigo === h.codigo); if (!r) return;
  Object.assign(r, { estadoK: h.estadoK, estado: h.estado, motivo: h.motivo, notas: h.notas });
  colaCrib.push({ ...r }); procesarCola();
  if ($("#c-fase").value !== h.estadoK) $("#c-fase").value = h.estadoK;
  cribActual = r; renderCrib(); renderR(); renderP();
}
$("#c-undo").onclick = deshacer;
$("#dlg-c").addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  const k = e.key.toLowerCase();
  if (k === "s") $("#c-si").click(); else if (k === "n") $("#c-no").click();
  else if (k === "q" && !$("#c-quiza").hidden) $("#c-quiza").click(); else if (k === "c" && !$("#c-nr").hidden) $("#c-nr").click();
  else if (k === "d" && !$("#c-dup").hidden) $("#c-dup").click();
  else if (k === "arrowright") $("#c-skip").click(); else if (k === "arrowleft") deshacer();
  else return;
  e.preventDefault();
});

/* ---------- Conflictos: desacuerdos entre Revisor 1 y Revisor 2 ---------- */
let CONF = [];
async function contarConflictos() {
  if (!clave) return;
  try { CONF = (await api("conflictos", {})).conflictos || [] } catch (e) { CONF = [] }
  $("#conf-btn").textContent = `⚖️ Conflictos${CONF.length ? ` (${CONF.length})` : ""}`;
  if ($("#dlg-x").open) renderConflictos();
}
function renderConflictos() {
  const el = $("#x-list");
  if (!CONF.length) { el.innerHTML = `<div class="empty">No hay conflictos pendientes. Aparecen acá cuando los dos revisores decidieron distinto sobre un artículo.</div>`; return }
  const tercero = rol && rol.revisor === "Revisor 3";
  el.innerHTML = CONF.map((c, i) => {
    const r = R.find(x => x.codigo === c.codigo) || { titulo: c.codigo };
    const op = d => `${esc(d.texto)}${d.motivo ? " · " + esc(d.motivo) : ""}`;
    return `<div class="xcard" data-i="${i}">
      <div class="meta">${esc(c.codigo)} · Fase ${c.fase} (${c.fase === 1 ? "título y resumen" : "texto completo"})</div>
      <b>${esc(r.titulo)}</b>
      ${r.resumen ? `<details><summary class="note">Ver resumen</summary><div class="abs">${resaltar(r.resumen)}</div></details>` : ""}
      <div class="xops"><span><b>Revisor 1:</b> ${op(c.r1)}</span><span><b>Revisor 2:</b> ${op(c.r2)}</span></div>
      <a href="#" class="x-com" data-c="${esc(c.codigo)}">💬 Comentarios${nCom(c.codigo) ? ` (${nCom(c.codigo)})` : ""}</a>
      <label>Cómo se resuelve<select class="x-met"><option value="consenso"${tercero ? "" : " selected"}>Consenso entre Revisor 1 y Revisor 2</option><option value="tercero"${tercero ? " selected" : ""}>Decisión del Revisor 3</option></select></label>
      <input class="x-mot" list="motivos" placeholder="Motivo (si se excluye)">
      <div class="bar"><button type="button" class="btn cok" data-d="si">✓ ${c.fase === 1 ? "Pasa" : "Incluir"}</button><button type="button" class="btn danger" data-d="no">✗ Excluir</button>${c.fase === 1 ? '<button type="button" class="btn ghost" data-d="dup">Duplicado</button>' : '<button type="button" class="btn ghost" data-d="nr">No se consiguió</button>'}</div>
    </div>`;
  }).join("");
  el.querySelectorAll(".x-com").forEach(a => a.onclick = e => { e.preventDefault(); abrirComentarios(a.dataset.c) });
  el.querySelectorAll(".xcard").forEach(card => card.querySelectorAll("button[data-d]").forEach(b => b.onclick = async () => {
    const c = CONF[card.dataset.i], decision = b.dataset.d, motivo = card.querySelector(".x-mot").value.trim();
    if (decision === "no" && !motivo) { toast("Escribe o elige el motivo de exclusión."); card.querySelector(".x-mot").focus(); return }
    card.querySelectorAll("button").forEach(x => x.disabled = true);
    try {
      await api("resolver", { codigo: c.codigo, fase: c.fase, decision, motivo, metodo: card.querySelector(".x-met").value });
      toast(c.codigo + " resuelto"); await cargar(true); await contarConflictos();
    } catch (e) { toast("No se pudo resolver: " + e.message, 6000); card.querySelectorAll("button").forEach(x => x.disabled = false) }
  }));
}
$("#conf-btn").onclick = async () => { renderConflictos(); $("#dlg-x").showModal(); await contarConflictos() };

$("#add-b").onclick = () => openB(null);
$("#add-r").onclick = () => openR(null);

async function guardar(btn, dlg, fn, okMsg) {
  btn.disabled = true; const txt = btn.textContent; btn.textContent = "Guardando…";
  try { const j = await fn(); dlg.close(); toast(j && j.aviso ? j.aviso : okMsg, j && j.aviso ? 6000 : 2800); await cargar(true) }
  catch (e) { toast(e.message === "Clave incorrecta." ? "La clave ya no es válida. Vuelve a entrar al modo edición." : "No se pudo guardar: " + e.message, 4500) }
  finally { btn.disabled = false; btn.textContent = txt }
}
$("#form-b").onsubmit = e => {
  e.preventDefault();
  const datos = { id: editB || "", base: $("#b-base").value, fecha: $("#b-fecha").value, cadena: $("#b-cadena").value.trim(), filtros: $("#b-filtros").value.trim(),
    n: Number($("#b-n").value || 0), campos: $("#b-campos").value.trim(), notas: $("#b-notas").value.trim(), link: $("#b-link").value.trim(), metodo: $("#b-metodo").value };
  const btn = e.submitter || $('#form-b button[type="submit"]');
  const conArchivo = !!importando;
  guardar(btn, $("#dlg-b"), async () => {
    const j = await api("guardarBusqueda", datos);
    editB = j.id; // si la importación falla, reintentar no duplica la búsqueda
    if (importando) {
      const n = await importarA(j.id, t => btn.textContent = t).catch(err => { throw new Error("la búsqueda se guardó, pero " + err.message) });
      j.aviso = `Búsqueda guardada y ${n} artículo${n === 1 ? "" : "s"} cargado${n === 1 ? "" : "s"} en Referencias.`;
    }
    return j;
  }, "Búsqueda guardada").then(() => { if (conArchivo && !importando) show("referencias") });
};
$("#form-r").onsubmit = e => {
  e.preventDefault();
  const datos = { codigo: editR || "", titulo: $("#r-titulo").value.trim(), autores: $("#r-autores").value.trim(), anio: $("#r-anio").value,
    revista: $("#r-revista").value.trim(), doi: $("#r-doi").value.trim(), link: $("#r-link").value.trim(), resumen: $("#r-resumen").value.trim(),
    busqueda: $("#r-busqueda").value, estado: $("#r-estado").value, motivo: $("#r-motivo").value.trim(), tema: $("#r-tema").value.trim(),
    notas: $("#r-notas").value.trim(), pdfLink: safeUrl($("#r-drive").value.trim()), uruguay: uruguayAuto };
  const oaChk = $("#oa-guardar");
  if (!pdfFile && pdfAbierto && oaChk && oaChk.checked && !$("#oa-box").hidden) datos.pdfUrl = pdfAbierto;
  const file = pdfFile;
  guardar($("#r-save"), $("#dlg-r"), async () => {
    if (file) { toast("Subiendo PDF…", 20000); datos.pdfBase64 = await leerBase64(file) }
    if (datos.pdfUrl) toast("Guardando el PDF de acceso abierto en Drive…", 20000);
    return api("guardarReferencia", datos);
  }, file || datos.pdfUrl ? "Referencia y PDF guardados" : "Referencia guardada");
};
function armDelete(btn, go) {
  btn.onclick = () => {
    if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = "Eliminar"; go() }
    else { btn.dataset.armed = 1; btn.textContent = "Toca otra vez para eliminar"; setTimeout(() => { delete btn.dataset.armed; btn.textContent = "Eliminar" }, 3500) }
  };
}
armDelete($("#b-del"), () => guardar($("#b-del"), $("#dlg-b"), () => api("borrarBusqueda", { id: editB }), "Búsqueda eliminada"));
armDelete($("#r-del"), () => guardar($("#r-del"), $("#dlg-r"), () => api("borrarReferencia", { codigo: editR }), "Referencia eliminada"));

/* ---------- Exportar ---------- */
const csvCell = v => { const s = String(v ?? ""); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s };
const csv = (head, rows) => "﻿" + [head, ...rows].map(r => r.map(csvCell).join(",")).join("\n");
function build(name) {
  if (name === "busquedas.csv") return csv(["ID", "Base", "Fecha de búsqueda", "Cadena", "Filtros", "Campos", "Resultados", "Notas", "Registrada"],
    B.map(b => [b.id, b.base, b.fecha, b.cadena, b.filtros, b.campos, b.n, b.notas, b.creado]));
  if (name === "referencias.csv") return csv(["Código", "Título", "Autores", "Año", "Revista", "DOI", "Link", "Resumen", "Base", "Fecha de búsqueda",
    "Registrada", "Cribada", "Estado", "Estado desde", "Motivo exclusión", "Exposición", "Uruguay (chequeo automático)", "PDF", "Nombre del PDF", "Notas"],
    R.map(r => [r.codigo, r.titulo, r.autores, r.anio, r.revista, r.doi, r.link, r.resumen, r.base, r.fechaBusqueda, r.creado, r.fechaCribado,
      r.estado, r.fechaEstado, r.motivo, r.tema, r.uruguay, r.pdf, r.pdfNombre, r.notas]));
  return R.map(r => {
    const L = ["TY  - JOUR", `ID  - ${r.codigo}`, `TI  - ${r.titulo}`];
    String(r.autores || "").split(/[;,]\s*(?=[A-ZÁÉÍÓÚÑ])/).filter(Boolean).forEach(a => L.push(`AU  - ${a.trim()}`));
    if (r.anio) L.push(`PY  - ${r.anio}`); if (r.revista) L.push(`JO  - ${r.revista}`); if (r.doi) L.push(`DO  - ${r.doi}`);
    if (safeUrl(r.link)) L.push(`UR  - ${r.link}`); if (safeUrl(r.pdf)) L.push(`L1  - ${r.pdf}`);
    if (r.resumen) L.push(`AB  - ${r.resumen.replace(/\s*\n\s*/g, " ")}`);
    const n = [r.estado, r.tema, r.motivo, r.notas].filter(Boolean).join(" | "); if (n) L.push(`N1  - ${n}`);
    L.push("ER  - "); return L.join("\n");
  }).join("\n\n");
}
document.querySelectorAll("[data-exp]").forEach(b => b.onclick = () => {
  const name = b.dataset.exp, type = name.endsWith(".ris") ? "application/x-research-info-systems" : "text/csv";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([build(name)], { type: type + ";charset=utf-8" }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

/* ---------- Inicio ---------- */
setModo();
actualizarRol();
try { const c = JSON.parse(store.get("cache") || "null"); if (c) aplicar(c); else renderAll() } catch (e) { renderAll() }
cargar();
document.addEventListener("visibilitychange", () => { if (!document.hidden) cargar(true) });

$("#r-com").onclick = () => abrirComentarios(editR);
