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
  if (cargando) return; cargando = true;
  if (!silencioso) $("#status").textContent = "Actualizando…";
  try {
    const r = await fetch(window.API_URL, { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    aplicar(j);
    store.set("cache", JSON.stringify(j));
    $("#status").textContent = "Actualizado " + new Date().toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    $("#status").textContent = "Sin conexión con la planilla. Mostrando lo último guardado en este dispositivo.";
  } finally { cargando = false }
}
function aplicar(j) {
  B = (j.busquedas || []).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  R = (j.referencias || []).map(r => ({ ...r, estadoK: estadoKey(r.estado) })).sort((a, b) => String(b.codigo).localeCompare(String(a.codigo)));
  H = j.historial || [];
  renderAll();
}
async function api(accion, datos) {
  const r = await fetch(window.API_URL, { method: "POST", body: JSON.stringify({ clave, accion, datos }) });
  const j = await r.json();
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
  catch (err) { clave = prev; toast(err.message === "Clave incorrecta." ? "Clave incorrecta." : "No se pudo conectar con la planilla.") }
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
    </div>`}).join("");
  el.querySelectorAll(".item").forEach(i => { i.onclick = () => openB(i.dataset.id); i.onkeydown = e => { if (e.key === "Enter") openB(i.dataset.id) } });
}
function renderR() {
  const el = $("#list-r");
  const q = $("#f-text").value.trim().toLowerCase(), st = $("#f-estado").value;
  const rows = R.filter(r => (!st || r.estadoK === st) &&
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
$("#f-text").oninput = renderR; $("#f-estado").onchange = renderR;

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
  lock($("#form-b")); $("#dlg-b").showModal();
}
function openR(codigo) {
  editR = codigo; const d = codigo ? R.find(r => r.codigo === codigo) : {};
  $("#dlg-r-title").textContent = codigo ? `Referencia ${codigo}` : "Nueva referencia";
  for (const k of ["titulo", "autores", "anio", "revista", "doi", "link", "resumen", "motivo", "tema", "notas"]) $("#r-" + k).value = d[k] ?? "";
  $("#r-busqueda").value = d.busqueda || ""; $("#r-estado").value = d.estadoK || "pend"; $("#r-del").hidden = !codigo || !clave;
  $("#r-drive").value = ""; pdfFile = null; $("#r-pdf").value = "";
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

$("#add-b").onclick = () => openB(null);
$("#add-r").onclick = () => openR(null);

async function guardar(btn, dlg, fn, okMsg) {
  btn.disabled = true; const txt = btn.textContent; btn.textContent = "Guardando…";
  try { await fn(); dlg.close(); toast(okMsg); await cargar(true) }
  catch (e) { toast(e.message === "Clave incorrecta." ? "La clave ya no es válida. Vuelve a entrar al modo edición." : "No se pudo guardar: " + e.message, 4500) }
  finally { btn.disabled = false; btn.textContent = txt }
}
$("#form-b").onsubmit = e => {
  e.preventDefault();
  const datos = { id: editB || "", base: $("#b-base").value, fecha: $("#b-fecha").value, cadena: $("#b-cadena").value.trim(), filtros: $("#b-filtros").value.trim(),
    n: Number($("#b-n").value || 0), campos: $("#b-campos").value.trim(), notas: $("#b-notas").value.trim() };
  guardar(e.submitter || $('#form-b button[type="submit"]'), $("#dlg-b"), () => api("guardarBusqueda", datos), "Búsqueda guardada");
};
$("#form-r").onsubmit = e => {
  e.preventDefault();
  const datos = { codigo: editR || "", titulo: $("#r-titulo").value.trim(), autores: $("#r-autores").value.trim(), anio: $("#r-anio").value,
    revista: $("#r-revista").value.trim(), doi: $("#r-doi").value.trim(), link: $("#r-link").value.trim(), resumen: $("#r-resumen").value.trim(),
    busqueda: $("#r-busqueda").value, estado: $("#r-estado").value, motivo: $("#r-motivo").value.trim(), tema: $("#r-tema").value.trim(),
    notas: $("#r-notas").value.trim(), pdfLink: safeUrl($("#r-drive").value.trim()) };
  const file = pdfFile;
  guardar($("#r-save"), $("#dlg-r"), async () => {
    if (file) { toast("Subiendo PDF…", 20000); datos.pdfBase64 = await leerBase64(file) }
    await api("guardarReferencia", datos);
  }, file ? "Referencia y PDF guardados" : "Referencia guardada");
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
    "Registrada", "Cribada", "Estado", "Estado desde", "Motivo exclusión", "Exposición", "PDF", "Nombre del PDF", "Notas"],
    R.map(r => [r.codigo, r.titulo, r.autores, r.anio, r.revista, r.doi, r.link, r.resumen, r.base, r.fechaBusqueda, r.creado, r.fechaCribado,
      r.estado, r.fechaEstado, r.motivo, r.tema, r.pdf, r.pdfNombre, r.notas]));
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
