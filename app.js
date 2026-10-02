// Registro de la revisión sistemática. Los datos viven en Google Sheets;
// esta página los lee (cualquiera) y los edita (solo con la clave).
const BASES = ["PubMed/MEDLINE", "LILACS", "SciELO", "BVS (Biblioteca Virtual en Salud)", "Scopus", "Web of Science", "Embase",
  "Cochrane Library", "Google Scholar", "Colibri (UdelaR)", "Timbó", "Literatura gris / informes (OSE, MSP, URSEA)", "Otra"];
const ESTADOS = [
  ["pend", "Pendiente de cribado"], ["dup", "Duplicado"], ["exta", "Excluida por título/resumen"],
  ["ft", "A texto completo"], ["extc", "Excluida a texto completo"], ["inc", "Incluida"]];
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
let B = [], R = [], H = [], clave = store.get("clave") || "", editB = null, editR = null, pdfFile = null, cargando = false;

function toast(msg, ms = 2800) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, ms) }
function fill(sel, opts, first) { sel.innerHTML = (first ? `<option value="">${first}</option>` : "") + opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("") }
fill($("#b-base"), BASES.map(b => [b, b]));
fill($("#r-estado"), ESTADOS);
fill($("#f-estado"), ESTADOS, "Todos los estados");

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
  document.body.classList.toggle("editing", on);
  $("#mode").textContent = on ? "✏️ Modo edición" : "🔒 Solo lectura";
  $("#mode").classList.toggle("on", on);
}
$("#mode").onclick = () => { $("#k-clave").value = ""; $("#k-salir").hidden = !clave; $("#dlg-k").showModal() };
$("#form-k").onsubmit = async e => {
  e.preventDefault();
  const k = $("#k-clave").value; const prev = clave; clave = k;
  try { await api("probarClave", {}); store.set("clave", k); $("#dlg-k").close(); toast("Modo edición activado") }
  catch (err) { clave = prev; toast(err.message === "Clave incorrecta." ? "Clave incorrecta." : err.message, 9000) }
  setModo();
};
$("#k-salir").onclick = () => { clave = ""; store.set("clave", null); setModo(); $("#dlg-k").close(); toast("Ahora estás en solo lectura") };

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
      <div class="top"><span class="t">${esc(b.base)}</span><span class="meta">${esc(fdate(b.fecha))} · ${Number(b.n || 0).toLocaleString("es-UY")} resultados · ${nref} ref.</span></div>
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
  const rows = R.filter(r => (!st || r.estadoK === st) && (!fb || r.busqueda === fb) &&
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
      ${link || safeUrl(r.pdf) || r.resumen ? `<div class="links">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">Ver en la fuente ↗</a>` : ""}${safeUrl(r.pdf) ? `<a href="${esc(r.pdf)}" target="_blank" rel="noopener">PDF ↗</a>` : ""}${r.resumen ? '<span class="meta">Con resumen</span>' : ""}</div>` : ""}
    </div>`}).join("");
  el.querySelectorAll(".item a").forEach(a => a.onclick = e => e.stopPropagation());
  el.querySelectorAll(".item").forEach(i => { i.onclick = () => openR(i.dataset.id); i.onkeydown = e => { if (e.key === "Enter" && e.target === i) openR(i.dataset.id) } });
}
$("#f-text").oninput = renderR; $("#f-estado").onchange = renderR; $("#f-busq").onchange = renderR;

function renderP() {
  const ident = B.reduce((s, b) => s + Number(b.n || 0), 0);
  const c = k => R.filter(r => r.estadoK === k).length;
  const dup = c("dup"), exta = c("exta"), extc = c("extc"), inc = c("inc"), ft = c("ft"), pend = c("pend");
  const reasons = {}; R.forEach(r => { if (r.estadoK === "extc") { const m = r.motivo || "Sin motivo anotado"; reasons[m] = (reasons[m] || 0) + 1 } });
  const byBase = {}; B.forEach(b => { byBase[b.base] = (byBase[b.base] || 0) + Number(b.n || 0) });
  const list = o => `<ul class="reasons">${Object.entries(o).map(([k, v]) => `<li>${esc(k)}: ${v.toLocaleString("es-UY")}</li>`).join("")}</ul>`;
  const box = (l, n, side, extra = "") => `<div class="box${side ? " side" : ""}"><span>${l}${extra}</span><b>${n.toLocaleString("es-UY")}</b></div>`;
  $("#prisma").innerHTML = `
    <div class="stage">Identificación</div>
    ${box("Registros identificados en bases de datos", ident, false, Object.keys(byBase).length ? list(byBase) : "")}
    ${box("Registros cargados en este registro", R.length)}
    ${box("Duplicados eliminados", dup, true)}
    <div class="stage">Cribado</div>
    ${box("Registros cribados (título/resumen)", R.length - dup)}
    ${box("Pendientes de cribar", pend, true)}
    ${box("Excluidos por título/resumen", exta, true)}
    ${box("Evaluados a texto completo", ft + extc + inc)}
    ${box("Excluidos a texto completo", extc, true, Object.keys(reasons).length ? list(reasons) : "")}
    <div class="stage">Incluidos</div>
    ${box("Estudios incluidos en la revisión", inc)}
    ${ident > R.length ? `<p class="note">Hay ${(ident - R.length).toLocaleString("es-UY")} resultados de búsqueda que todavía no están cargados como referencias.</p>` : ""}`;
}
function renderAll() {
  renderB(); renderR(); renderP();
  fill($("#r-busqueda"), B.map(b => [b.id, `${b.base} · ${fdate(b.fecha)}`]), "Sin asociar");
  const fb = $("#f-busq").value;
  fill($("#f-busq"), B.map(b => [b.id, `${b.base} · ${fdate(b.fecha)}`]), "Todas las búsquedas");
  $("#f-busq").value = B.some(b => b.id === fb) ? fb : "";
  if ($("#dlg-c").open) renderCrib();
}

/* ---------- Diálogos ---------- */
function lock(form) {
  const ro = !clave;
  form.querySelectorAll("input,select,textarea").forEach(i => { if (i.type !== "file") i.disabled = ro });
  form.querySelector('button[type="submit"]').hidden = ro;
}
function histHtml(rows) {
  return rows.length ? `<span class="lbl">Historial (automático)</span><ol>${rows.map(h => `<li>${esc(fdt(h.fecha))}: ${esc(h.accion)}${h.detalle ? " · " + esc(h.detalle) : ""}</li>`).join("")}</ol>` : "";
}
function openB(id) {
  editB = id; const d = id ? B.find(b => b.id === id) : {};
  $("#dlg-b-title").textContent = id ? "Búsqueda" : "Nueva búsqueda";
  $("#b-base").value = d.base || BASES[0]; $("#b-fecha").value = d.fecha || new Date().toLocaleDateString("sv");
  $("#b-cadena").value = d.cadena || ""; $("#b-filtros").value = d.filtros || ""; $("#b-n").value = d.n ?? "";
  $("#b-campos").value = d.campos || ""; $("#b-notas").value = d.notas || ""; $("#b-del").hidden = !id || !clave;
  const hist = id ? [{ fecha: d.creado, accion: "Registrada" }, ...(d.actualizado && d.actualizado !== d.creado ? [{ fecha: d.actualizado, accion: "Última edición" }] : [])] : [];
  $("#b-hist").innerHTML = histHtml(hist); $("#b-hist").hidden = !id;
  $("#bl-url").value = ""; $("#imp-file").value = ""; $("#imp-res").hidden = true; importando = null;
  $("#feed-url").value = ""; $("#feed-box").open = false;
  $("#b-link").value = d.link || ((String(d.notas || "").match(/Link de resultados: (\S+)/) || [])[1] || ""); mostrarPm();
  lock($("#form-b")); $("#dlg-b").showModal();
}
function openR(codigo) {
  editR = codigo; const d = codigo ? R.find(r => r.codigo === codigo) : {};
  $("#dlg-r-title").textContent = codigo ? `Referencia ${codigo}` : "Nueva referencia";
  for (const k of ["titulo", "autores", "anio", "revista", "doi", "link", "resumen", "motivo", "tema", "notas"]) $("#r-" + k).value = d[k] ?? "";
  $("#r-busqueda").value = d.busqueda || ""; $("#r-estado").value = d.estadoK || "pend"; $("#r-del").hidden = !codigo || !clave;
  $("#r-drive").value = ""; pdfFile = null; $("#r-pdf").value = "";
  $("#auto-in").value = ""; pdfAbierto = ""; uruguayAuto = d.uruguay || ""; $("#oa-box").hidden = true;
  mostrarUy(uruguayAuto ? { texto: uruguayAuto, ok: !/^No /.test(uruguayAuto) } : null);
  renderPdf(d); updNombre();
  const hist = codigo ? H.filter(h => h.codigo === codigo) : [];
  $("#r-hist").innerHTML = histHtml(hist); $("#r-hist").hidden = !hist.length;
  lock($("#form-r")); $("#dlg-r").showModal();
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
  const refs = Importar.marcarDuplicados(leido.refs, R).map(r => {
    const c = Autocompletar.chequeoUruguay(r);
    return { ...r, uruguay: textoUy(c), esUy: c.afUy || c.menciona };
  });
  const dups = refs.filter(r => r.duplicadoDe).length, uy = refs.filter(r => r.esUy).length;
  importando = { archivo: origen, refs };
  // Completa la búsqueda con lo que trae el archivo
  if (!editB || !Number($("#b-n").value)) $("#b-n").value = leido.total ?? refs.length;
  if (leido.base && !editB) $("#b-base").value = leido.base;
  res.innerHTML = `<span><b>${refs.length}</b> artículos ${donde}.</span>
    ${aviso ? `<span class="uycheck warn">${esc(aviso)}</span>` : ""}
    <span>${refs.length - dups} nuevos · ${dups} duplicados${dups ? " (ya estaban en el registro o repetidos)" : ""}.</span>
    <span>🇺🇾 ${uy} con autores de Uruguay o que mencionan Uruguay.</span>
    ${dups ? `<label><input type="checkbox" id="imp-dups" checked> Registrar los duplicados con estado «Duplicado» (cuentan en PRISMA)</label>` : ""}
    ${editB ? `<button type="button" class="btn" id="imp-go">Importar</button>` : `<span class="note" id="imp-go-nota"></span>`}`;
  const chk = $("#imp-dups"), go = $("#imp-go"), nota = $("#imp-go-nota");
  const etiqueta = () => {
    const n = refs.length - (chk && !chk.checked ? dups : 0), t = `${n} artículo${n === 1 ? "" : "s"}`;
    if (go) go.textContent = "Importar " + t;
    if (nota) nota.textContent = `Al guardar la búsqueda se ${n === 1 ? "carga" : "cargan"} ${t} en Referencias.`;
  };
  if (chk) chk.onchange = etiqueta;
  etiqueta();
  if (go) { if (!refs.length) go.hidden = true; go.onclick = () => importarAhora() }
}
// PubMed deja pedir los resultados de una búsqueda: los traemos con el link
$("#pm-btn").onclick = async () => {
  const btn = $("#pm-btn"); btn.disabled = true;
  try {
    const leido = await Importar.traerPubmed($("#b-link").value, t => btn.textContent = t);
    mostrarImportacion("PubMed (link)", "traídos de PubMed", leido, leido.aviso);
  } catch (e) { toast("No pude traer los artículos de PubMed: " + e.message, 7000) }
  finally { btn.disabled = false; btn.textContent = "Traer artículos de PubMed" }
};
$("#bl-btn").onclick = () => {
  const d = Importar.leerLink($("#bl-url").value);
  if (!d) { toast("Eso no parece un link. Copia la dirección completa de la barra del navegador."); return }
  if (BASES.includes(d.base)) $("#b-base").value = d.base;
  if (d.cadena) $("#b-cadena").value = d.cadena;
  if (d.filtros) $("#b-filtros").value = d.filtros;
  $("#b-link").value = d.link; mostrarPm();
  toast(d.cadena ? `Listo: ${d.base}${d.filtros ? ", con filtros" : ""}. Revisa los campos y completa la cantidad de resultados si no adjuntas archivo.`
    : `Reconocí ${d.base}, pero el link no trae la búsqueda escrita. Cópiala a mano en «Cadena de búsqueda».`, 6000);
};
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
  const lista = importando.refs.filter(r => conDups || !r.duplicadoDe).map(r => ({
    titulo: r.titulo, autores: r.autores, anio: r.anio, revista: r.revista, doi: r.doi, link: r.link, resumen: r.resumen,
    uruguay: r.uruguay, estado: r.duplicadoDe ? "dup" : "pend", notas: r.duplicadoDe ? "Duplicado de " + r.duplicadoDe : "",
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

/* ---------- Cribado: artículo por artículo ---------- */
const MOTIVOS = ["No es en Uruguay", "No evalúa agua de consumo", "Sin desenlace en salud", "Diseño no elegible", "No es un estudio original", "Texto completo no disponible"];
let cribActual = null, cribHist = [], cribSaltados = new Set();
function colaFase() {
  const fase = $("#c-fase").value, fb = $("#f-busq").value;
  return R.filter(r => r.estadoK === fase && (!fb || r.busqueda === fb) && !cribSaltados.has(r.codigo))
    .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
}
function renderCrib() {
  const fase = $("#c-fase").value, cola = colaFase();
  const total = R.filter(r => r.estadoK === fase && (!$("#f-busq").value || r.busqueda === $("#f-busq").value)).length;
  if (!cribActual || cribActual.estadoK !== fase || cribSaltados.has(cribActual.codigo)) cribActual = cola[0] || null;
  else cribActual = R.find(r => r.codigo === cribActual.codigo) || cola[0] || null;
  $("#c-excl").hidden = true; $("#c-undo").hidden = !cribHist.length;
  $("#c-prog").textContent = total ? `Quedan ${total} ${fase === "pend" ? "pendientes de cribado" : "a texto completo"}${cribSaltados.size ? ` · ${cribSaltados.size} saltados` : ""}` : "";
  $("#c-si").textContent = fase === "pend" ? "✓ Pasa" : "✓ Incluir";
  $("#c-dup").hidden = fase !== "pend";
  const card = $("#c-card");
  if (!cribActual) {
    $("#c-btns").hidden = true;
    card.innerHTML = `<div class="empty">${cribSaltados.size ? `No quedan más, salvo ${cribSaltados.size} que saltaste. <button type="button" class="btn ghost" id="c-reset">Volver a ver los saltados</button>`
      : fase === "pend" ? "¡No quedan artículos pendientes de cribado! 🎉" : "No hay artículos esperando la lectura a texto completo."}</div>`;
    const rs = $("#c-reset"); if (rs) rs.onclick = () => { cribSaltados.clear(); renderCrib() };
    return;
  }
  $("#c-btns").hidden = false;
  const r = cribActual, link = safeUrl(r.link) || doiUrl(r.doi), uy = r.uruguay || "";
  card.innerHTML = `<div class="meta">${esc(r.codigo)}${r.base ? " · " + esc(r.base) : ""}</div>
    <h3>${esc(r.titulo)}</h3>
    <div class="meta">${esc([r.autores, r.anio, r.revista].filter(Boolean).join(" · "))}</div>
    ${uy ? `<div class="uycheck ${/^No se detect/.test(uy) ? "warn" : "ok"}">${/^No se detect/.test(uy) ? "⚠️ " : "🇺🇾 "}${esc(uy)}</div>` : ""}
    <div class="abs">${r.resumen ? esc(r.resumen) : '<span class="meta">Sin resumen cargado.</span>'}</div>
    <div class="links">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">Ver en la fuente ↗</a>` : ""}${safeUrl(r.pdf) ? `<a href="${esc(r.pdf)}" target="_blank" rel="noopener">PDF ↗</a>` : ""}<a href="#" id="c-editar">Editar ficha</a></div>`;
  $("#c-editar").onclick = e => { e.preventDefault(); $("#dlg-c").close(); openR(r.codigo) };
  card.scrollTop = 0;
}
function abrirCrib() {
  cribSaltados.clear(); cribHist = []; cribActual = null;
  $("#c-fase").value = R.some(r => r.estadoK === "pend") || !R.some(r => r.estadoK === "ft") ? "pend" : "ft";
  $("#c-motivos").innerHTML = MOTIVOS.map(m => `<button type="button">${esc(m)}</button>`).join("");
  $("#c-motivos").querySelectorAll("button").forEach(b => b.onclick = () => decidir(fase2Excl(), b.textContent));
  renderCrib(); actualizarGuardado(); $("#dlg-c").showModal();
}
const fase2Excl = () => $("#c-fase").value === "pend" ? "exta" : "extc";
function decidir(estado, motivo) {
  const r = cribActual; if (!r) return;
  cribHist.push({ codigo: r.codigo, estadoK: r.estadoK, estado: r.estado, motivo: r.motivo });
  r.estadoK = estado; r.estado = estadoLabel(estado); r.motivo = motivo || "";
  colaCrib.push({ ...r }); procesarCola();
  cribActual = null; renderCrib(); renderR(); renderP();
}
async function procesarCola() {
  if (procesarCola.activo) return; procesarCola.activo = true;
  while (colaCrib.length) {
    actualizarGuardado();
    const r = colaCrib[0];
    try {
      await api("guardarReferencia", { codigo: r.codigo, titulo: r.titulo, autores: r.autores, anio: r.anio, revista: r.revista, doi: r.doi,
        link: r.link, resumen: r.resumen, busqueda: r.busqueda, estado: r.estadoK, motivo: r.motivo, tema: r.tema, notas: r.notas, uruguay: r.uruguay });
      colaCrib.shift();
    } catch (e) {
      toast("No se pudo guardar " + r.codigo + ": " + e.message + ". Reintento en unos segundos.", 5000);
      await new Promise(ok => setTimeout(ok, 5000));
    }
  }
  procesarCola.activo = false; actualizarGuardado(); cargar(true);
}
function actualizarGuardado() { $("#c-guard").textContent = colaCrib.length ? `Guardando ${colaCrib.length}…` : "✓ Todo guardado" }
$("#crib-btn").onclick = abrirCrib;
$("#c-cerrar").onclick = () => $("#dlg-c").close();
$("#c-fase").onchange = () => { cribActual = null; cribSaltados.clear(); renderCrib() };
$("#c-si").onclick = () => decidir($("#c-fase").value === "pend" ? "ft" : "inc");
$("#c-no").onclick = () => { $("#c-excl").hidden = false; $("#c-motivo").value = ""; $("#c-excl").scrollIntoView({ block: "nearest" }) };
$("#c-excl-ok").onclick = () => decidir(fase2Excl(), $("#c-motivo").value.trim());
$("#c-motivo").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#c-excl-ok").click() } });
$("#c-dup").onclick = () => decidir("dup");
$("#c-skip").onclick = () => { if (cribActual) { cribSaltados.add(cribActual.codigo); cribActual = null; renderCrib() } };
function deshacer() {
  const h = cribHist.pop(); if (!h) return;
  const r = R.find(x => x.codigo === h.codigo); if (!r) return;
  Object.assign(r, { estadoK: h.estadoK, estado: h.estado, motivo: h.motivo });
  colaCrib.push({ ...r }); procesarCola();
  if ($("#c-fase").value !== h.estadoK) $("#c-fase").value = h.estadoK;
  cribActual = r; renderCrib(); renderR(); renderP();
}
$("#c-undo").onclick = deshacer;
$("#dlg-c").addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  const k = e.key.toLowerCase();
  if (k === "s") $("#c-si").click(); else if (k === "n") $("#c-no").click();
  else if (k === "d" && !$("#c-dup").hidden) $("#c-dup").click();
  else if (k === "arrowright") $("#c-skip").click(); else if (k === "arrowleft") deshacer();
  else return;
  e.preventDefault();
});

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
    n: Number($("#b-n").value || 0), campos: $("#b-campos").value.trim(), notas: $("#b-notas").value.trim(), link: $("#b-link").value.trim() };
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
try { const c = JSON.parse(store.get("cache") || "null"); if (c) aplicar(c); else renderAll() } catch (e) { renderAll() }
cargar();
document.addEventListener("visibilitychange", () => { if (!document.hidden) cargar(true) });
