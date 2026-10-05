// Búsqueda automática (beta): corre las cadenas del protocolo en las bases que tienen una API abierta
// y deja registrar cada una como búsqueda, con sus artículos, igual que si se hubiera hecho a mano.
(function () {
  const caja = document.getElementById("v-auto");
  if (!caja || !window.Cadenas) return;
  const una = s => String(s || "").replace(/\s+/g, " ").trim();
  const MAX = 2000; // tope de artículos por base y por búsqueda

  // OpenAlex no acepta comodines (*): se quitan y se dejan las palabras completas
  const sinComodin = s => s.replace(/(\w+)\*/g, (m, w) => ({ cyanobacteri: "cyanobacteria", urugua: "uruguay" }[w.toLowerCase()] || w + "s"));

  // Cadena de cada base para el grupo elegido (principal o secundario)
  function cadena(base, grupo) {
    const C = window.Cadenas, L = C.libre, exp = L[grupo];
    if (base === "pubmed") return C.pubmed[grupo];
    if (base === "bvs") return C.bvs[grupo];
    if (base === "epmc") return `${L.agua}\nAND ${exp}\nAND (${L.uruguay.slice(1, -1)} OR AFF:"Uruguay")`;
    if (base === "openalex") return sinComodin(`${L.agua}\nAND ${exp}\nAND ${L.uruguay}`);
    // Colección SciELO Uruguay: no hace falta el bloque de Uruguay
    if (base === "scielo") return grupo === "principal"
      ? `("agua potable" OR "agua de consumo" OR "agua de bebida" OR "agua corriente" OR "drinking water" OR "tap water" OR "água potável")
AND (cianobacteria* OR cianotoxina* OR microcistina* OR cyanobacteri* OR microcystin* OR plaguicida* OR agrotoxico* OR agrotóxico*
 OR agroquimico* OR agroquímico* OR pesticida* OR pesticide* OR herbicida* OR glifosato OR glyphosate OR atrazina OR atrazine)`
      : `("agua potable" OR "agua de consumo" OR "agua de bebida" OR "agua corriente" OR "drinking water" OR "tap water" OR "água potável")
AND (trihalometano* OR trihalomethane* OR cloroformo OR sodio OR sodium OR cloruro* OR chloride* OR salinidad OR "crisis hídrica"
 OR nitrato* OR nitrate* OR arsénico OR arsenic OR plomo OR "metales pesados" OR "heavy metals" OR microplástico* OR microplastic*)`;
    if (base === "colibri") return grupo === "principal"
      ? "agua AND (cianobacterias OR cianotoxinas OR microcistinas OR agrotóxicos OR plaguicidas OR agroquímicos OR glifosato OR atrazina)"
      : "agua AND (trihalometanos OR cloroformo OR sodio OR cloruros OR nitratos OR arsénico OR plomo OR \"metales pesados\" OR microplásticos)";
  }

  const BASES_AUTO = [
    { id: "pubmed", nombre: "PubMed/MEDLINE", nota: "MEDLINE y PubMed, con MeSH.", motor: false,
      web: c => "https://pubmed.ncbi.nlm.nih.gov/?term=" + encodeURIComponent(una(c)) },
    { id: "bvs", nombre: "LILACS", nota: "BVS filtrada a LILACS, con DeCS. La trae el motor.", motor: true,
      web: c => "https://pesquisa.bvsalud.org/portal/?lang=es&q=" + encodeURIComponent(una(c)) + "&filter%5Bdb%5D%5B%5D=LILACS" },
    { id: "epmc", nombre: "Europe PMC", nota: "Incluye MEDLINE, PMC, preprints y tesis. Se superpone con PubMed: los repetidos se marcan solos.", motor: false,
      web: c => "https://europepmc.org/search?query=" + encodeURIComponent(una(c)) },
    { id: "openalex", nombre: "OpenAlex", nota: "Índice abierto muy amplio (reemplaza en parte a Scopus y Google Scholar). Busca en título y resumen.", motor: false,
      web: c => "https://openalex.org/works?filter=" + encodeURIComponent("title_and_abstract.search:" + una(c).replace(/,/g, " ")) },
    { id: "scielo", nombre: "SciELO", nota: "Colección SciELO Uruguay (revistas uruguayas en acceso abierto). La trae el motor.", motor: true,
      web: c => "https://search.scielo.org/?lang=es&q=" + encodeURIComponent(una(c)) + "&filter%5Bin%5D%5B%5D=ury" },
    { id: "colibri", nombre: "Colibri (UdelaR)", nota: "Repositorio de la Universidad de la República (tesis e informes). La trae el motor.", motor: true,
      web: c => "https://www.colibri.udelar.edu.uy/jspui/simple-search?query=" + encodeURIComponent(c) },
  ];

  /* ---------- Cada base ---------- */
  async function traer(base, c, avance) {
    if (base === "pubmed") return Importar.traerPubmed(BASES_AUTO.find(x => x.id === "pubmed").web(c), avance);
    if (base === "bvs") {
      const u = new URL(BASES_AUTO.find(x => x.id === "bvs").web(c)); u.searchParams.set("output", "xml"); u.searchParams.set("count", "1000"); u.searchParams.set("from", "1");
      avance("Buscando en la BVS…");
      const r = await api("traerUrl", { url: u.href });
      let leido;
      try { leido = Importar.leer(r.texto || "") }
      catch (e) {
        const muestra = String(r.texto || "").replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
        throw new Error(`la BVS no devolvió el XML esperado (código ${r.status}${muestra ? ": «" + muestra + "»" : ", respuesta vacía"}). Usa «Ver en la web», exporta en XML o RIS y adjúntalo en + Nueva búsqueda`);
      }
      return { refs: leido.refs, total: leido.total ?? leido.refs.length };
    }
    if (base === "epmc") return europePmc(c, avance);
    if (base === "openalex") return openAlex(c, avance);
    if (base === "scielo") {
      const b = BASES_AUTO.find(x => x.id === "scielo");
      const u = new URL(b.web(c)); u.searchParams.set("output", "xml"); u.searchParams.set("count", "1000"); u.searchParams.set("from", "1");
      avance("Buscando en SciELO Uruguay…");
      const r = await api("traerUrl", { url: u.href });
      let leido;
      try { leido = Importar.leer(r.texto || "") }
      catch (e) {
        const muestra = String(r.texto || "").replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
        throw new Error(`SciELO no devolvió el XML esperado (código ${r.status}${muestra ? ": «" + muestra + "»" : ", respuesta vacía"}). Usa «Ver en la web», exporta en RIS y adjúntalo en + Nueva búsqueda`);
      }
      // El enlace del artículo en scielo.edu.uy sale del identificador (S1688-…-ury)
      leido.refs.forEach(x => { if (!x.doi && x.id && /pesquisa\.bvsalud/.test(x.link || "")) x.link = "https://www.scielo.edu.uy/scielo.php?script=sci_arttext&pid=" + x.id.replace(/-[a-z]{3}$/, "") });
      return { refs: leido.refs, total: leido.total ?? leido.refs.length };
    }
    if (base === "colibri") {
      const hilo = Importar.linkHiloColibri(BASES_AUTO.find(x => x.id === "colibri").web(c));
      const leido = await Importar.traerHilo(hilo, u => api("traerUrl", { url: u }), avance);
      return { refs: leido.refs, total: leido.total ?? leido.refs.length };
    }
  }

  async function europePmc(c, avance) {
    const refs = []; let cursor = "*", total = 0;
    while (refs.length < MAX) {
      avance(refs.length ? `Trayendo… ${refs.length} de ${total}` : "Buscando en Europe PMC…");
      const r = await fetch("https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + new URLSearchParams({ query: una(c), format: "json", resultType: "core", pageSize: "1000", cursorMark: cursor }));
      if (!r.ok) throw new Error("Europe PMC respondió con error " + r.status);
      const j = await r.json(); total = j.hitCount || 0;
      const lista = (j.resultList && j.resultList.result) || [];
      lista.forEach(x => refs.push({
        titulo: una(x.title).replace(/\.$/, ""), autores: x.authorString || "", anio: x.pubYear || "",
        revista: (x.journalInfo && x.journalInfo.journal && x.journalInfo.journal.title) || x.bookOrReportDetails && x.bookOrReportDetails.publisher || "",
        doi: x.doi || "", link: x.doi ? "https://doi.org/" + x.doi : `https://europepmc.org/article/${x.source}/${x.id}`,
        resumen: una(String(x.abstractText || "").replace(/<[^>]+>/g, " ")),
        afiliaciones: x.affiliation || ((x.authorList && x.authorList.author) || []).map(a => (a.authorAffiliationDetailsList && a.authorAffiliationDetailsList.authorAffiliation || []).map(f => f.affiliation).join(" ")).join(" | "),
      }));
      if (!lista.length || refs.length >= total || !j.nextCursorMark || j.nextCursorMark === cursor) break;
      cursor = j.nextCursorMark;
    }
    return { refs: refs.filter(r => r.titulo), total };
  }

  async function openAlex(c, avance) {
    const refs = []; let cursor = "*", total = 0;
    while (refs.length < MAX && cursor) {
      avance(refs.length ? `Trayendo… ${refs.length} de ${total}` : "Buscando en OpenAlex…");
      // Solo en título y resumen: «search» también mira el texto completo y trae miles de artículos que apenas mencionan el tema
      const r = await fetch("https://api.openalex.org/works?" + new URLSearchParams({ filter: "title_and_abstract.search:" + una(c).replace(/,/g, " "), "per-page": "200", cursor,
        select: "id,doi,display_name,publication_year,authorships,primary_location,abstract_inverted_index" }));
      if (!r.ok) throw new Error("OpenAlex respondió con error " + r.status);
      const j = await r.json(); total = (j.meta && j.meta.count) || 0;
      (j.results || []).forEach(w => {
        const pal = []; Object.entries(w.abstract_inverted_index || {}).forEach(([p, pos]) => pos.forEach(i => { pal[i] = p }));
        const paises = new Set(); (w.authorships || []).forEach(a => (a.countries || []).forEach(x => paises.add(x)));
        const doi = w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//i, "") : "";
        refs.push({
          titulo: una(w.display_name).replace(/\.$/, ""), anio: w.publication_year ? String(w.publication_year) : "",
          autores: (w.authorships || []).map(a => a.author && a.author.display_name).filter(Boolean).join("; "),
          revista: (w.primary_location && w.primary_location.source && w.primary_location.source.display_name) || "",
          doi, link: doi ? "https://doi.org/" + doi : w.id, resumen: pal.filter(Boolean).join(" "), paises: [...paises],
          afiliaciones: (w.authorships || []).flatMap(a => a.raw_affiliation_strings || []).join(" | "),
        });
      });
      cursor = (j.meta && j.meta.next_cursor) || "";
      if (!(j.results || []).length) break;
    }
    return { refs: refs.filter(r => r.titulo), total };
  }

  /* ---------- Pantalla ---------- */
  const res = {}; // resultados por base
  const fila = b => `<div class="auto-base" id="auto-${b.id}">
      <label class="auto-chk"><input type="checkbox" value="${b.id}" checked> <b>${esc(b.nombre)}</b>${b.motor ? ' <span class="note">(necesita entrar con clave)</span>' : ""}</label>
      <p class="note">${esc(b.nota)}</p>
      <div class="auto-estado"></div>
    </div>`;
  caja.querySelector("#auto-bases").innerHTML = BASES_AUTO.map(fila).join("");

  function pintar(b) {
    const el = caja.querySelector(`#auto-${b.id} .auto-estado`), x = res[b.id];
    if (!x) { el.innerHTML = ""; return }
    if (x.cargando) { el.innerHTML = `<span class="note">⏳ ${esc(x.cargando)}</span>`; return }
    if (x.error) { el.innerHTML = `<span class="uycheck warn">No se pudo: ${esc(x.error)}</span>`; return }
    if (x.registrada) { el.innerHTML = `<span class="uycheck ok">✅ Registrada: ${x.registrada}</span> <a href="${esc(x.web)}" target="_blank" rel="noopener">Ver en la web ↗</a>`; return }
    const marcados = Importar.marcarDuplicados(x.refs, R).map(r => ({ ...r, esUy: (c => c.afUy || c.menciona)(Autocompletar.chequeoUruguay(r)) }));
    const dups = marcados.filter(r => r.duplicadoDe).length, uy = marcados.filter(r => r.esUy).length;
    x.marcados = marcados;
    el.innerHTML = `<div class="auto-num"><b>${x.total}</b> resultado${x.total === 1 ? "" : "s"}${x.refs.length < x.total ? ` (se trajeron ${x.refs.length})` : ""} · ${marcados.length - dups} nuevos · ${dups} ya registrados o repetidos · 🇺🇾 ${uy} relacionados con Uruguay</div>
      ${x.aviso ? `<span class="uycheck warn">${esc(x.aviso)}</span>` : ""}
      ${x.refs.length < x.total ? `<span class="uycheck warn">${x.total > MAX ? `Hay más de ${MAX}: la cadena es muy amplia para esta base.` : `La base entregó ${x.refs.length} de ${x.total}.`} Para tenerlos todos, exporta el archivo desde la web y adjúntalo en esta búsqueda (Búsquedas → abrirla).</span>` : ""}
      <details class="auto-cad"><summary class="note">Ver la cadena usada</summary><pre class="cad-pre">${esc(x.cadena)}</pre></details>
      <div class="cad-btns"><a class="btn ghost" href="${esc(x.web)}" target="_blank" rel="noopener">Ver en la web ↗</a>
      ${x.total ? `<button type="button" class="btn edit-only" data-registrar="${b.id}">Registrar búsqueda y cargar ${marcados.length} artículo${marcados.length === 1 ? "" : "s"}</button>` : `<button type="button" class="btn ghost edit-only" data-registrar="${b.id}">Registrar búsqueda (sin resultados)</button>`}
      ${uy && uy < marcados.length ? `<label class="note"><input type="checkbox" data-solouy="${b.id}"> Cargar solo los ${uy} relacionados con Uruguay</label>` : ""}</div>`;
  }

  async function buscar() {
    const grupo = caja.querySelector("#auto-grupo").value;
    const elegidas = BASES_AUTO.filter(b => caja.querySelector(`#auto-${b.id} input[type=checkbox]`).checked);
    if (!elegidas.length) { toast("Elige al menos una base."); return }
    if (elegidas.some(b => b.motor) && !clave) toast("La BVS y Colibri las trae el motor: entra con tu clave para incluirlas.", 6000);
    const btn = caja.querySelector("#auto-go"); btn.disabled = true;
    await Promise.all(elegidas.map(async b => {
      const c = cadena(b.id, grupo);
      if (b.motor && !clave) { res[b.id] = { error: "hay que entrar con clave" }; pintar(b); return }
      res[b.id] = { cargando: "Buscando…" }; pintar(b);
      try {
        const x = await traer(b.id, c, t => { res[b.id] = { cargando: t }; pintar(b) });
        res[b.id] = { refs: x.refs.slice(0, MAX), total: x.total || x.refs.length, cadena: c, web: b.web(c), grupo, aviso: x.aviso };
      } catch (e) { res[b.id] = { error: e.message === "Acción desconocida." ? "falta actualizar el motor" : e.message } }
      pintar(b);
    }));
    btn.disabled = false;
    caja.querySelector("#auto-todas").hidden = !clave || !BASES_AUTO.some(b => res[b.id] && res[b.id].refs && !res[b.id].registrada);
  }

  // Registra la búsqueda y carga sus artículos, como «+ Nueva búsqueda»
  async function registrar(id) {
    const b = BASES_AUTO.find(x => x.id === id), x = res[id];
    if (!x || !x.refs || x.registrada) return;
    const soloUy = caja.querySelector(`[data-solouy="${id}"]`)?.checked;
    const marcados = Importar.marcarDuplicados(x.refs, R).map(r => { const c = Autocompletar.chequeoUruguay(r); return { ...r, uruguay: textoUy(c), esUy: c.afUy || c.menciona } })
      .filter(r => !soloUy || r.esUy);
    res[id] = { ...x, cargando: "Registrando la búsqueda…" }; pintar(b);
    try {
      const hoy = new Date().toLocaleDateString("sv");
      x.idBusqueda = x.idBusqueda || "B" + Math.random().toString(16).slice(2, 10);
      const j = await api("guardarBusqueda", { id: x.idBusqueda, base: b.nombre, fecha: hoy, cadena: x.cadena.trim(), filtros: id === "bvs" ? "Base de datos: LILACS" : id === "scielo" ? "Colección: SciELO Uruguay" : "",
        n: x.total, campos: "", link: x.web, metodo: Prisma.OTROS_POR_DEFECTO.includes(b.nombre) ? "otros" : "bases",
        notas: `Búsqueda automática (beta) desde la página, interés ${x.grupo}.` + (soloUy ? " Se cargaron solo los relacionados con Uruguay." : "") + (x.refs.length < x.total ? ` Se trajeron ${x.refs.length} de ${x.total}.` : "") });
      const lista = marcados.map(r => ({ titulo: r.titulo, autores: r.autores, anio: r.anio, revista: r.revista, doi: r.doi, link: r.link, resumen: r.resumen,
        uruguay: r.uruguay, estado: r.duplicadoDe ? "dup" : "pend", notas: r.duplicadoDe ? "Duplicado de " + r.duplicadoDe : "" }));
      for (let i = 0; i < lista.length; i += 50) {
        res[id] = { ...x, cargando: `Cargando artículos… ${i} de ${lista.length}` }; pintar(b);
        await api("importarReferencias", { busqueda: j.id, archivo: b.nombre + " (búsqueda automática)", referencias: lista.slice(i, i + 50) });
      }
      res[id] = { ...x, registrada: `${lista.length} artículo${lista.length === 1 ? "" : "s"} en Referencias` };
      await cargar(true);
    } catch (e) { res[id] = { ...x, error: "no se pudo registrar: " + e.message } }
    pintar(b);
    // Lo recién cargado cuenta como duplicado para las demás bases
    BASES_AUTO.filter(o => o.id !== id && res[o.id] && res[o.id].refs && !res[o.id].registrada && !res[o.id].cargando).forEach(pintar);
  }

  caja.querySelector("#auto-go").onclick = buscar;
  caja.querySelector("#auto-todas").onclick = async e => {
    e.target.disabled = true;
    for (const b of BASES_AUTO) if (res[b.id] && res[b.id].refs && !res[b.id].registrada) await registrar(b.id);
    e.target.disabled = false; e.target.hidden = true;
  };
  caja.addEventListener("click", e => { const r = e.target.closest("[data-registrar]"); if (r) { r.disabled = true; registrar(r.dataset.registrar) } });
})();
