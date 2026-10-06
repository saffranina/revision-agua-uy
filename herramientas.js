// Herramientas de la etapa de búsqueda y cribado:
// PDFs abiertos en lote, revisión de posibles duplicados y búsqueda manual / literatura gris.
(function () {
  const hoy = () => new Date().toLocaleDateString("sv");
  const datosRef = r => ({ codigo: r.codigo, titulo: r.titulo, autores: r.autores, anio: r.anio, revista: r.revista, doi: r.doi, link: r.link,
    resumen: r.resumen, busqueda: r.busqueda, estado: r.estadoK, motivo: r.motivo, tema: r.tema, notas: r.notas, uruguay: r.uruguay });

  /* ---------- PDFs de acceso abierto en lote ---------- */
  // Busca en OpenAlex (que incluye los datos de Unpaywall) un PDF gratuito para cada artículo de la Fase 2 o incluido sin PDF
  $("#pdf-lote").onclick = async () => {
    const box = $("#pdf-res"), btn = $("#pdf-lote");
    const lista = R.filter(r => (r.estadoK === "ft" || r.estadoK === "inc") && !r.pdf);
    if (!lista.length) { box.hidden = false; box.innerHTML = `<span>No hay artículos de la Fase 2 o incluidos sin PDF.</span>`; return }
    const conDoi = lista.filter(r => r.doi), encontrados = [];
    btn.disabled = true; box.hidden = false;
    for (let i = 0; i < conDoi.length; i++) {
      box.innerHTML = `<span>⏳ Buscando PDFs abiertos… ${i + 1} de ${conDoi.length}</span>`;
      try {
        const r = await fetch("https://api.openalex.org/works/" + encodeURIComponent("doi:" + Importar.claveDoi(conDoi[i].doi)) + "?select=best_oa_location,primary_location,locations");
        if (!r.ok) continue;
        const w = await r.json();
        const pdf = (w.best_oa_location && w.best_oa_location.pdf_url) || (w.primary_location && w.primary_location.pdf_url) || ((w.locations || []).find(l => l.pdf_url) || {}).pdf_url;
        if (pdf) encontrados.push({ ref: conDoi[i], pdf });
      } catch (e) { }
    }
    btn.disabled = false;
    const sinDoi = lista.length - conDoi.length;
    box.innerHTML = `<span><b>${encontrados.length}</b> de ${lista.length} artículo${lista.length === 1 ? "" : "s"} sin PDF ${encontrados.length === 1 ? "tiene" : "tienen"} una versión gratuita.${sinDoi ? ` ${sinDoi} no ${sinDoi === 1 ? "tiene" : "tienen"} DOI y no se pudo${sinDoi === 1 ? "" : "ieron"} buscar.` : ""}</span>
      ${encontrados.length ? `<ul class="mias">${encontrados.map(x => `<li><b>${esc(x.ref.codigo)}</b> ${esc(x.ref.titulo)} · <a href="${esc(x.pdf)}" target="_blank" rel="noopener">PDF ↗</a></li>`).join("")}</ul>
      <button type="button" class="btn" id="pdf-go">Guardar ${encontrados.length === 1 ? "el PDF" : `los ${encontrados.length} PDF`} en Drive</button>` : ""}`;
    const go = $("#pdf-go"); if (!go) return;
    go.onclick = async () => {
      go.disabled = true; let ok = 0; const fallas = [];
      for (let i = 0; i < encontrados.length; i++) {
        go.textContent = `Guardando ${i + 1} de ${encontrados.length}…`;
        try {
          const j = await api("guardarReferencia", { ...datosRef(encontrados[i].ref), pdfUrl: encontrados[i].pdf });
          if (j.aviso) fallas.push(encontrados[i]); else ok++;
        } catch (e) { fallas.push(encontrados[i]) }
      }
      box.innerHTML = `<span>✅ ${ok} PDF guardado${ok === 1 ? "" : "s"} en Drive con el nombre automático.</span>
        ${fallas.length ? `<span class="uycheck warn">${fallas.length} no se ${fallas.length === 1 ? "pudo" : "pudieron"} bajar solo${fallas.length === 1 ? "" : "s"} (la revista lo bloquea). Ábrelos y súbelos con «Subir PDF» en la ficha:</span>
        <ul class="mias">${fallas.map(x => `<li><b>${esc(x.ref.codigo)}</b> <a href="${esc(x.pdf)}" target="_blank" rel="noopener">PDF ↗</a></li>`).join("")}</ul>` : ""}`;
      await cargar(true);
    };
  };

  /* ---------- Posibles duplicados ---------- */
  // Además de los idénticos (mismo DOI o título), busca títulos muy parecidos del mismo año o cercano
  const IGN = "dupIgnorados";
  const ignorados = () => { try { return new Set(JSON.parse(store.get(IGN) || "[]")) } catch (e) { return new Set() } };
  const palabrasDe = t => new Set(String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(w => w.length > 2));
  function parecidos() {
    const lista = R.filter(r => r.estadoK !== "dup" && r.titulo).map(r => ({ r, p: palabrasDe(r.titulo), a: Number(r.anio) || 0 }));
    const ign = ignorados(), pares = [];
    for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
      const A = lista[i], B = lista[j];
      if (A.a && B.a && Math.abs(A.a - B.a) > 1) continue;
      if (Math.min(A.p.size, B.p.size) < 3 || Math.max(A.p.size, B.p.size) > 2.5 * Math.min(A.p.size, B.p.size)) continue;
      let com = 0; A.p.forEach(w => { if (B.p.has(w)) com++ });
      const sim = com / (A.p.size + B.p.size - com);
      const mismoDoi = A.r.doi && B.r.doi && Importar.claveDoi(A.r.doi) === Importar.claveDoi(B.r.doi);
      if ((sim >= 0.75 || mismoDoi) && !ign.has([A.r.codigo, B.r.codigo].sort().join("|"))) { const [x, y] = [A.r, B.r].sort((m, n) => String(m.codigo).localeCompare(String(n.codigo))); pares.push({ a: x, b: y, sim: mismoDoi ? 1 : sim }) }
    }
    return pares.sort((x, y) => y.sim - x.sim);
  }
  const ficha = r => `<div class="dup-ficha"><b>${esc(r.codigo)}</b> · <span class="pill s-${r.estadoK}">${esc(r.estado)}</span><br>${esc(r.titulo)}
    <div class="meta">${esc([r.autores, r.anio, r.revista, r.base].filter(Boolean).join(" · "))}${r.doi ? " · DOI " + esc(r.doi) : ""}</div></div>`;
  function renderDup() {
    const pares = parecidos(), el = $("#dup-lista"), admin = rol && rol.admin;
    if (!pares.length) { el.innerHTML = `<div class="empty">No encontré artículos con títulos casi iguales. 🎉 Los idénticos ya se marcan solos al importar.</div>`; return }
    el.innerHTML = `<p class="note">${pares.length} par${pares.length === 1 ? "" : "es"} con títulos muy parecidos (mismo año o cercano). Revisa si son el mismo trabajo: pasa mucho entre LILACS, SciELO y Colibri, o entre un artículo y su versión en otro idioma.${admin ? "" : " Para marcarlos hace falta la clave de administración."}</p>` +
      pares.map((x, i) => `<div class="dup-par">${ficha(x.a)}${ficha(x.b)}<div class="meta">Parecido: ${Math.round(x.sim * 100)} %</div>
        <div class="cad-btns">${admin ? `<button type="button" class="btn ghost" data-dup="${i}" data-cual="b">${esc(x.b.codigo)} es duplicado de ${esc(x.a.codigo)}</button>
        <button type="button" class="btn ghost" data-dup="${i}" data-cual="a">${esc(x.a.codigo)} es duplicado de ${esc(x.b.codigo)}</button>` : ""}
        <button type="button" class="btn ghost" data-ign="${i}">No son el mismo</button></div></div>`).join("");
    el.querySelectorAll("[data-ign]").forEach(b => b.onclick = () => {
      const x = pares[b.dataset.ign], s = ignorados(); s.add([x.a.codigo, x.b.codigo].sort().join("|")); store.set(IGN, JSON.stringify([...s])); renderDup();
    });
    el.querySelectorAll("[data-dup]").forEach(b => b.onclick = async () => {
      const x = pares[b.dataset.dup], dup = b.dataset.cual === "b" ? x.b : x.a, orig = b.dataset.cual === "b" ? x.a : x.b;
      b.disabled = true; b.textContent = "Guardando…";
      try {
        await api("guardarReferencia", { ...datosRef(dup), estado: "dup", notas: ["Duplicado de " + orig.codigo, dup.notas].filter(Boolean).join(" · ") });
        toast(`${dup.codigo} quedó como duplicado de ${orig.codigo}`); await cargar(true); renderDup();
      } catch (e) { b.disabled = false; toast("No se pudo guardar: " + e.message, 6000) }
    });
  }
  $("#dup-btn").onclick = () => { renderDup(); $("#dlg-dup").showModal() };

  /* ---------- Búsqueda manual y literatura gris ---------- */
  // Cada fuente: revistas uruguayas que no están completas en las bases, repositorios e instituciones.
  // Lo revisado se guarda en el protocolo (claves «man:…») con fecha, cantidad encontrada y notas.
  const google = (sitio, extra) => "https://www.google.com/search?q=" + encodeURIComponent(`site:${sitio} ${extra || "agua potable (cianobacterias OR agrotóxicos OR plaguicidas OR nitratos OR arsénico OR plomo)"}`);
  const ojs = base => base + "/search/search?query=" + encodeURIComponent("agua potable");
  const FUENTES = [
    ["Revistas uruguayas (búsqueda manual)", [
      ["rmu", "Revista Médica del Uruguay", "https://revista.rmu.org.uy", ojs("https://revista.rmu.org.uy/index.php/rmu")],
      ["anfamed", "Anales de la Facultad de Medicina (Udelar)", "https://revistas.udelar.edu.uy/OJS/index.php/anfamed", ojs("https://revistas.udelar.edu.uy/OJS/index.php/anfamed")],
      ["innotec", "INNOTEC (LATU)", "https://ojs.latu.org.uy/index.php/INNOTEC", ojs("https://ojs.latu.org.uy/index.php/INNOTEC")],
      ["agrociencia", "Agrociencia Uruguay", "https://agrocienciauruguay.uy", ojs("https://agrocienciauruguay.uy/index.php/agrociencia")],
      ["saludmilitar", "Salud Militar", "https://revistasaludmilitar.uy", google("revistasaludmilitar.uy")],
      ["enfucu", "Enfermería: Cuidados Humanizados (UCU)", "https://revistas.ucu.edu.uy", google("revistas.ucu.edu.uy")],
      ["veterinaria", "Veterinaria (Montevideo)", "https://www.revistasmvu.com.uy", google("revistasmvu.com.uy", "agua pozo (nitratos OR arsénico OR cianobacterias OR plaguicidas)")],
      ["latindex", "Latindex: catálogo de revistas uruguayas", "https://www.latindex.org", "https://www.latindex.org/latindex/bAvanzada"],
    ]],
    ["Repositorios (tesis e informes)", [
      ["riquim", "RIQUIM (Facultad de Química)", "https://riquim.fq.edu.uy", google("riquim.fq.edu.uy")],
      ["ainfo", "Ainfo (repositorio de INIA)", "http://www.ainfo.inia.uy", google("ainfo.inia.uy", "agua (plaguicidas OR agroquímicos OR nitratos OR cianobacterias)")],
      ["bvsenf", "BVS Enfermería Uruguay (tesis)", "https://www.bvsenf.org.uy", google("bvsenf.org.uy", "agua potable")],
      ["iecon", "IECON (FCEA): documentos de trabajo", "https://www.iecon.ccee.edu.uy", google("iecon.ccee.edu.uy", "crisis hídrica OR agua potable salud")],
    ]],
    ["Literatura gris (instituciones)", [
      ["ose", "OSE: informes de calidad de agua y monitoreo de cianobacterias", "https://www.ose.com.uy", google("ose.com.uy", "calidad del agua (cianobacterias OR informe OR monitoreo)")],
      ["msp", "MSP: alertas, protocolos e informes", "https://www.gub.uy/ministerio-salud-publica", google("gub.uy/ministerio-salud-publica", "agua (cianobacterias OR plaguicidas OR sodio OR plomo OR intoxicación)")],
      ["ambiente", "Ministerio de Ambiente (DINACEA): monitoreo de cuencas", "https://www.gub.uy/ministerio-ambiente", google("gub.uy/ministerio-ambiente", "(cianobacterias OR floraciones OR plaguicidas) agua")],
      ["ursea", "URSEA: regulación del agua potable", "https://www.gub.uy/unidad-reguladora-servicios-energia-agua", google("gub.uy/unidad-reguladora-servicios-energia-agua", "agua potable calidad")],
      ["ciat", "CIAT / Toxicología, Hospital de Clínicas", "https://www.toxicologia.hc.edu.uy", google("toxicologia.hc.edu.uy", "agua (plomo OR plaguicidas OR cianobacterias OR arsénico)")],
      ["limno", "Facultad de Ciencias: Sección Limnología", "http://limno.fcien.edu.uy", google("fcien.edu.uy", "cianobacterias agua")],
      ["im", "Intendencia de Montevideo (y Montevidata)", "https://montevideo.gub.uy", google("montevideo.gub.uy", "agua potable (crisis hídrica OR calidad OR cianobacterias)")],
      ["ops", "OPS/OMS Uruguay", "https://www.paho.org/es/uruguay", google("paho.org", "Uruguay agua potable (cianobacterias OR plaguicidas OR calidad)")],
      ["parlamento", "Parlamento: pedidos de informe y versiones taquigráficas", "https://parlamento.gub.uy", google("parlamento.gub.uy", "agua potable (cianobacterias OR agrotóxicos OR crisis hídrica)")],
    ]],
    ["Organismos del Estado, normativa e internacionales", [
      ["gubuy", "Todo el Estado (todos los sitios gub.uy)", "https://www.gub.uy", google("gub.uy")],
      ["mgap", "MGAP (DGSA): registro y control de plaguicidas", "https://www.gub.uy/ministerio-ganaderia-agricultura-pesca", google("gub.uy/ministerio-ganaderia-agricultura-pesca", "(plaguicidas OR agroquímicos OR fitosanitarios) agua")],
      ["dinagua", "DINAGUA (Ministerio de Ambiente): Dirección Nacional de Aguas", "https://www.gub.uy/ministerio-ambiente", google("gub.uy/ministerio-ambiente", "DINAGUA agua potable")],
      ["oan", "Observatorio Ambiental Nacional: datos de calidad de agua", "https://www.ambiente.gub.uy/oan", google("ambiente.gub.uy", "calidad de agua")],
      ["sinae", "SINAE: emergencias (crisis hídrica 2023)", "https://www.gub.uy/sistema-nacional-emergencias", google("gub.uy/sistema-nacional-emergencias", "agua potable OR crisis hídrica")],
      ["impo", "IMPO: normativa (decretos y reglamentos de agua potable)", "https://www.impo.com.uy", google("impo.com.uy", "agua potable")],
      ["unit", "UNIT: norma 833 de agua potable", "https://www.unit.org.uy", google("unit.org.uy", "833 agua potable")],
      ["canelones", "Intendencia de Canelones", "https://www.imcanelones.gub.uy", google("imcanelones.gub.uy", "agua potable")],
      ["maldonado", "Intendencia de Maldonado (Laguna del Sauce)", "https://www.maldonado.gub.uy", google("maldonado.gub.uy", "agua potable OR \"Laguna del Sauce\"")],
      ["inddhh", "INDDHH: informes sobre el derecho al agua", "https://www.gub.uy/institucion-nacional-derechos-humanos-uruguay", google("gub.uy/institucion-nacional-derechos-humanos-uruguay", "agua potable")],
      ["latu", "LATU: informes técnicos", "https://www.latu.org.uy", google("latu.org.uy", "agua potable")],
      ["iris", "OMS: repositorio IRIS", "https://iris.who.int", "https://iris.who.int/discover?query=" + encodeURIComponent("drinking water Uruguay")],
      ["cepal", "CEPAL: repositorio", "https://repositorio.cepal.org", google("repositorio.cepal.org", "agua potable Uruguay")],
      ["bid", "BID: publicaciones", "https://publications.iadb.org", google("publications.iadb.org", "agua potable Uruguay")],
    ]],
  ];
  const GRIS = new Set([...FUENTES[2][1], ...FUENTES[3][1]].map(x => x[0]));
  // Para el buscador: el link de Google limitado al sitio se rehace con los términos del grupo elegido
  function conTerminos(buscar, terminos) {
    if (!terminos) return buscar;
    let dom; try { dom = (new URL(buscar).searchParams.get("q") || "").match(/^site:(\S+)/) } catch (e) { dom = null }
    if (!dom || !/google\./.test(buscar)) return buscar;
    return google(dom[1], terminos + (/\.uy(\/|$)/.test(dom[1]) ? "" : " Uruguay"));
  }
  const leer = id => { try { return JSON.parse(PROT["man:" + id] || "null") } catch (e) { return null } };
  const extras = () => { try { return JSON.parse(PROT["man:extra"] || "[]") } catch (e) { return [] } };
  function filaBase([id, nombre, sitio, buscarFijo], terminos) {
    const v = leer(id), admin = clave && rol && rol.admin, buscar = conTerminos(buscarFijo, terminos);
    return `<div class="man" data-man="${esc(id)}">
      <div><b>${esc(nombre)}</b> ${v ? `<span class="uycheck ok" style="display:inline">✅ Revisada ${esc(fdate(v.fecha))}${v.n !== "" && v.n != null ? ` · ${esc(v.n)} encontrado${String(v.n) === "1" ? "" : "s"}` : ""}${v.quien ? " · " + esc(v.quien) : ""}</span>` : '<span class="meta">Sin revisar</span>'}</div>
      ${v && v.notas ? `<div class="meta">${esc(v.notas)}</div>` : ""}
      <div class="links"><a href="${esc(sitio)}" target="_blank" rel="noopener">Abrir sitio ↗</a><a href="${esc(buscar)}" target="_blank" rel="noopener">🔎 Buscar ahí ↗</a>
        ${admin ? `<a href="#" data-marcar="${esc(id)}">${v ? "Editar" : "Marcar revisada"}</a><a href="#" data-registrar-man="${esc(id)}">Registrar como búsqueda (PRISMA)</a>` : ""}</div>
      <div class="man-form" hidden></div>
    </div>`;
  }
  // Se dibuja en Búsquedas (todas las fuentes) y en Buscar (beta) (literatura gris y Estado, con los términos del grupo elegido)
  function renderManual() {
    renderLista($("#manual-lista"), {});
    const g = $("#auto-grupo");
    renderLista($("#auto-gris-lista"), { soloGris: true, terminos: g ? TERMINOS_GRUPO[g.value] : "" });
  }
  const TERMINOS_GRUPO = {
    canilla: '("agua potable" OR "agua de canilla" OR "agua de pozo" OR "calidad del agua") (cianobacterias OR plaguicidas OR agrotóxicos OR nitratos OR plomo OR arsénico OR trihalometanos OR sodio)',
    principal: '"agua potable" (cianobacterias OR microcistinas OR agrotóxicos OR plaguicidas OR glifosato)',
    secundario: '"agua potable" (trihalometanos OR sodio OR cloruros OR nitratos OR arsénico OR plomo OR microplásticos)',
  };
  function renderLista(el, { soloGris, terminos }) {
    if (!el) return;
    const fila = x => filaBase(x, terminos);
    const base = soloGris ? FUENTES.filter(([, l]) => l.some(x => GRIS.has(x[0]))) : FUENTES;
    const todas = base.map(([g, l]) => [g, l]).concat(!soloGris && extras().length ? [["Agregadas por ti", extras().map(x => [x.id, x.nombre, x.sitio, x.buscar || x.sitio])]] : []);
    const total = todas.reduce((n, [, l]) => n + l.length, 0), hechas = todas.reduce((n, [, l]) => n + l.filter(([id]) => leer(id)).length, 0);
    el.innerHTML = (soloGris ? `<p class="note">Los sitios del Estado y los organismos no dejan que otros programas busquen en ellos, así que no se pueden traer solos como las bases de arriba. Cada «🔎 Buscar ahí» abre la búsqueda <b>con los términos del grupo elegido arriba</b>; lo que sirva lo cargas con «+ Agregar a mano» en Referencias y marcas la fuente como revisada (se guarda junto con la lista de Búsquedas).</p>` : "") + `<p class="note">Revisadas: <b>${hechas} de ${total}</b>. «Buscar ahí» abre la búsqueda del sitio o de Google limitada a ese sitio. Lo que encuentres agrégalo con «+ Agregar a mano» en Referencias (pega el link o el título y toca «Completar»). Para que cuente en el diagrama PRISMA («Otros métodos»), usa «Registrar como búsqueda».</p>` +
      todas.map(([g, l]) => `<h3 class="cad-grupo">${esc(g)}</h3>${l.map(fila).join("")}`).join("") +
      (!soloGris && clave && rol && rol.admin ? `<div class="bar"><input class="grow" id="man-nombre" placeholder="Otra fuente (nombre)"><input class="grow" id="man-sitio" type="url" placeholder="https://…"><button type="button" class="btn ghost" id="man-add">+ Agregar fuente</button></div>` : "");
    const todasPlanas = todas.flatMap(([, l]) => l);
    el.querySelectorAll("[data-marcar]").forEach(a => a.onclick = e => {
      e.preventDefault();
      const id = a.dataset.marcar, v = leer(id) || {}, f = el.querySelector(`[data-man="${id}"] .man-form`);
      f.hidden = false;
      f.innerHTML = `<div class="grid2"><label>Fecha<input type="date" class="m-fecha" value="${esc(v.fecha || hoy())}"></label><label>¿Cuántos encontraste?<input type="number" min="0" class="m-n" value="${esc(v.n ?? "")}"></label></div>
        <label>Notas (qué buscaste, qué encontraste)<input class="m-notas" value="${esc(v.notas || "")}"></label>
        <div class="cad-btns"><button type="button" class="btn m-ok">Guardar</button>${v.fecha ? '<button type="button" class="btn ghost m-borrar">Marcar sin revisar</button>' : ""}</div>`;
      const guardarMan = async valor => {
        try { await api("guardarProtocolo", { ["man:" + id]: valor }); await cargar(true); toast("Guardado") }
        catch (err) { toast("No se pudo guardar: " + err.message, 6000) }
      };
      f.querySelector(".m-ok").onclick = () => guardarMan(JSON.stringify({ fecha: f.querySelector(".m-fecha").value || hoy(), n: f.querySelector(".m-n").value, notas: f.querySelector(".m-notas").value.trim(), quien: rol.revisor || "administración" }));
      const br = f.querySelector(".m-borrar"); if (br) br.onclick = () => guardarMan("");
    });
    el.querySelectorAll("[data-registrar-man]").forEach(a => a.onclick = e => {
      e.preventDefault();
      const [id, nombre, sitio, buscarFijo] = todasPlanas.find(x => x[0] === a.dataset.registrarMan), v = leer(id) || {}, buscar = conTerminos(buscarFijo, terminos);
      openB(null);
      const base = GRIS.has(id) ? "Literatura gris / informes (OSE, MSP, URSEA)" : "Otra";
      $("#b-base").value = base; $("#b-base").dispatchEvent(new Event("change"));
      $("#b-metodo").value = "otros"; if (typeof syncMetodo === "function") syncMetodo();
      $("#b-cadena").value = `Búsqueda manual en ${nombre} (${sitio}).${v.notas ? " " + v.notas : ""}`;
      $("#b-fecha").value = v.fecha || hoy(); $("#b-n").value = v.n || 0; $("#b-link").value = buscar;
      $("#b-campos").value = "Sitio web / búsqueda manual";
    });
    const add = $("#man-add");
    if (add) add.onclick = async () => {
      const nombre = $("#man-nombre").value.trim(), sitio = $("#man-sitio").value.trim();
      if (!nombre || !/^https?:\/\//.test(sitio)) { toast("Escribe el nombre y el link (https://…)."); return }
      const lista = extras(); lista.push({ id: "x" + Date.now().toString(36), nombre, sitio, buscar: google(new URL(sitio).hostname, "agua potable") });
      try { await api("guardarProtocolo", { "man:extra": JSON.stringify(lista) }); await cargar(true) } catch (e) { toast("No se pudo guardar: " + e.message, 6000) }
    };
  }
  window.renderManual = renderManual;
  renderManual();
  const grupoSel = $("#auto-grupo"); if (grupoSel) grupoSel.addEventListener("change", renderManual);
})();
