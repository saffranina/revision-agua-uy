// Autocompletar una referencia a partir de un DOI, PMID, ISBN, link o título.
// Fuentes (todas gratuitas y abiertas): OpenAlex, Crossref, PubMed, Google Books y Open Library.
(function () {
  const quitarTags = s => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // Reconoce lo que pegó la persona: DOI, PMID, PMCID o un link que los contenga
  function reconocer(texto) {
    const t = decodeURIComponent(String(texto || "").trim());
    const doi = t.match(/10\.\d{4,9}\/[^\s"<>?#]+/);
    if (doi) return { doi: doi[0].replace(/[.,;)\]]+$/, "").replace(/\/(full|abstract|pdf|epdf|html)$/i, "") };
    const pmc = t.match(/PMC\d+/i);
    if (pmc) return { pmcid: pmc[0].toUpperCase() };
    // Libros: link de Google Books u Open Library, o un ISBN (10 o 13 dígitos, con o sin guiones)
    const gb = t.match(/books\.google\.[a-z.]+\/books(?:\/edition\/[^/]+\/|\?(?:[^#]*&)?id=)([\w-]{8,})/i);
    if (gb) return { gbid: gb[1] };
    const ol = t.match(/openlibrary\.org\/isbn\/([\dXx-]+)/i);
    const isbnTxt = ol ? ol[1] : (t.match(/(?:ISBN(?:-1[03])?[:\s]*)?((?:97[89][-\s]?)?\d[\d\s-]{7,15}[\dXx])/i) || [])[1];
    if (isbnTxt) { const n = isbnTxt.replace(/[-\s]/g, "").toUpperCase(); if (isbnValido(n)) return { isbn: n } }
    const pm = t.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i) || t.match(/^(\d{4,9})$/);
    if (pm) return { pmid: pm[1] };
    // Un título (al menos tres palabras y no es un link): se busca por título
    if (!/^https?:\/\//i.test(t) && t.split(/\s+/).length >= 3) return { titulo: t };
    return null;
  }
  function isbnValido(n) {
    if (/^\d{9}[\dX]$/.test(n)) return [...n].reduce((s, c, i) => s + (10 - i) * (c === "X" ? 10 : +c), 0) % 11 === 0;
    if (/^97[89]\d{10}$/.test(n)) return [...n].reduce((s, c, i) => s + (i % 2 ? 3 : 1) * +c, 0) % 10 === 0;
    return false;
  }

  async function getJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  // OpenAlex guarda el resumen como índice invertido: lo rearmamos
  function resumenOpenAlex(inv) {
    if (!inv) return "";
    const pal = [];
    for (const [w, pos] of Object.entries(inv)) pos.forEach(p => { pal[p] = w });
    return pal.join(" ").trim();
  }

  function autorCorto(apellido, nombres) {
    const ini = String(nombres || "").split(/[\s.-]+/).filter(Boolean).map(n => n[0].toUpperCase()).join("");
    return [apellido, ini].filter(Boolean).join(" ");
  }
  function autorDesdeNombreCompleto(n) {
    const p = String(n || "").trim().split(/\s+/);
    if (p.length < 2) return n;
    return autorCorto(p[p.length - 1], p.slice(0, -1).join(" "));
  }

  async function openAlex(id) {
    const clave = id.openalex ? id.openalex : id.doi ? "doi:" + id.doi : id.pmid ? "pmid:" + id.pmid : "pmcid:" + id.pmcid;
    const w = await getJson("https://api.openalex.org/works/" + encodeURIComponent(clave));
    const paises = new Set();
    (w.authorships || []).forEach(a => {
      (a.countries || []).forEach(c => paises.add(c));
      (a.institutions || []).forEach(i => i.country_code && paises.add(i.country_code));
    });
    const instUy = [...new Set((w.authorships || []).flatMap(a => (a.institutions || []).filter(i => i.country_code === "UY").map(i => i.display_name)))];
    const oa = w.best_oa_location || w.open_access || {};
    return {
      titulo: w.display_name || w.title || "",
      autores: (w.authorships || []).map(a => autorDesdeNombreCompleto(a.author && a.author.display_name)).filter(Boolean).join(", "),
      anio: w.publication_year || "",
      revista: (w.primary_location && w.primary_location.source && w.primary_location.source.display_name) || "",
      doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//i, "") : (id.doi || ""),
      link: (w.primary_location && w.primary_location.landing_page_url) || w.doi || "",
      resumen: resumenOpenAlex(w.abstract_inverted_index),
      pmid: w.ids && w.ids.pmid ? String(w.ids.pmid).replace(/\D/g, "") : (id.pmid || ""),
      pdfAbierto: oa.pdf_url || "",
      linkAbierto: oa.landing_page_url || oa.oa_url || "",
      paises: [...paises],
      instUy,
    };
  }

  async function crossref(doi) {
    const j = await getJson("https://api.crossref.org/works/" + encodeURIComponent(doi));
    const m = j.message || {};
    const fecha = (m.issued || m["published-print"] || m["published-online"] || {})["date-parts"];
    return {
      titulo: quitarTags((m.title || [])[0]),
      autores: (m.author || []).map(a => a.family ? autorCorto(a.family, a.given) : a.name).filter(Boolean).join(", "),
      anio: fecha && fecha[0] && fecha[0][0] ? fecha[0][0] : "",
      revista: quitarTags((m["container-title"] || [])[0]),
      doi: m.DOI || doi,
      link: m.URL || "",
      resumen: quitarTags(m.abstract).replace(/^(Abstract|Resumen|Resumo)\s*/i, ""),
      afiliaciones: (m.author || []).flatMap(a => (a.affiliation || []).map(x => x.name)).join(" | "),
    };
  }

  async function pubmed(pmid) {
    const r = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`);
    if (!r.ok) throw new Error(String(r.status));
    const x = new DOMParser().parseFromString(await r.text(), "text/xml");
    const txt = sel => Array.from(x.querySelectorAll(sel)).map(n => n.textContent.trim()).filter(Boolean);
    const resumen = Array.from(x.querySelectorAll("Abstract AbstractText")).map(n => {
      const l = n.getAttribute("Label"); return (l ? l + ": " : "") + n.textContent.trim();
    }).join("\n\n");
    const autores = Array.from(x.querySelectorAll("AuthorList Author")).map(a => {
      const ln = a.querySelector("LastName"), ini = a.querySelector("Initials"), cn = a.querySelector("CollectiveName");
      return ln ? [ln.textContent, ini ? ini.textContent : ""].join(" ").trim() : (cn ? cn.textContent : "");
    }).filter(Boolean).join(", ");
    const doi = (Array.from(x.querySelectorAll("ArticleId")).find(n => n.getAttribute("IdType") === "doi") || {}).textContent || "";
    return {
      titulo: txt("ArticleTitle")[0] || "",
      autores,
      anio: txt("PubDate Year")[0] || (txt("PubDate MedlineDate")[0] || "").slice(0, 4),
      revista: txt("Journal Title")[0] || "",
      doi,
      link: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      resumen,
      afiliaciones: txt("AffiliationInfo Affiliation").join(" | "),
    };
  }

  // Une los resultados: para cada campo usa la primera fuente que lo tenga
  function unir(...fuentes) {
    const out = {};
    for (const f of fuentes.filter(Boolean)) for (const [k, v] of Object.entries(f)) if (out[k] == null || out[k] === "" || (Array.isArray(out[k]) && !out[k].length)) out[k] = v;
    return out;
  }

  /* ---------- Libros: Google Books y Open Library ---------- */
  async function libro(id) {
    const [gb, ol] = await Promise.all([
      (id.gbid ? getJson("https://www.googleapis.com/books/v1/volumes/" + encodeURIComponent(id.gbid))
        : getJson("https://www.googleapis.com/books/v1/volumes?q=" + encodeURIComponent("isbn:" + id.isbn)).then(j => (j.items || [])[0])).catch(() => null),
      id.isbn ? getJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${id.isbn}&format=json&jscmd=data`).then(j => j["ISBN:" + id.isbn]).catch(() => null) : null,
    ]);
    const v = gb && gb.volumeInfo;
    const isbnGb = v && ((v.industryIdentifiers || []).find(x => x.type === "ISBN_13") || (v.industryIdentifiers || [])[0] || {}).identifier;
    const deGb = v ? {
      titulo: [v.title, v.subtitle].filter(Boolean).join(": "), autores: (v.authors || []).map(autorDesdeNombreCompleto).join(", "),
      anio: (String(v.publishedDate || "").match(/\d{4}/) || [""])[0], editorial: v.publisher || "", resumen: quitarTags(v.description),
      link: v.infoLink || v.canonicalVolumeLink || "", paginas: v.pageCount || "", isbn: isbnGb || id.isbn || "",
    } : null;
    const deOl = ol ? {
      titulo: [ol.title, ol.subtitle].filter(Boolean).join(": "), autores: (ol.authors || []).map(a => autorDesdeNombreCompleto(a.name)).join(", "),
      anio: (String(ol.publish_date || "").match(/\d{4}/) || [""])[0], editorial: ((ol.publishers || [])[0] || {}).name || "",
      lugar: ((ol.publish_places || [])[0] || {}).name || "", link: ol.url || "", paginas: ol.number_of_pages || "", isbn: id.isbn || "",
    } : null;
    if (!deGb && !deOl) throw new Error("no-encontrado");
    const d = unir(deGb, deOl);
    d.revista = "Libro · " + [d.editorial, d.lugar].filter(Boolean).join(", ");
    d.notas = [d.isbn ? "ISBN " + d.isbn : "", d.paginas ? d.paginas + " p." : ""].filter(Boolean).join(" · ");
    d.doi = ""; d.fuentes = [deGb && "Google Books", deOl && "Open Library"].filter(Boolean); d.libro = true;
    return d;
  }

  // Búsqueda por título: artículos, informes y libros (OpenAlex) o libros (Google Books)
  const palabrasT = t => new Set(String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(w => w.length > 2));
  const parecido = (a, b) => { const A = palabrasT(a), B = palabrasT(b); let c = 0; A.forEach(w => { if (B.has(w)) c++ }); return c / Math.max(1, A.size + B.size - c) };
  async function porTitulo(t) {
    const [oa, gb] = await Promise.all([
      getJson("https://api.openalex.org/works?per-page=5&search=" + encodeURIComponent(t)).then(j => j.results || []).catch(() => []),
      getJson("https://www.googleapis.com/books/v1/volumes?maxResults=5&q=" + encodeURIComponent("intitle:" + t)).then(j => j.items || []).catch(() => []),
    ]);
    const mejorOa = oa.map(w => ({ w, s: parecido(t, w.display_name) })).sort((a, b) => b.s - a.s)[0];
    const mejorGb = gb.map(g => ({ g, s: parecido(t, [g.volumeInfo.title, g.volumeInfo.subtitle].filter(Boolean).join(" ")) })).sort((a, b) => b.s - a.s)[0];
    let d;
    if (mejorOa && mejorOa.s >= 0.6 && (!mejorGb || mejorOa.s >= mejorGb.s)) {
      const doi = mejorOa.w.doi ? mejorOa.w.doi.replace(/^https?:\/\/doi\.org\//i, "") : "";
      d = doi ? await buscar(doi) : { ...(await openAlex({ openalex: mejorOa.w.id.split("/").pop() })), fuentes: ["OpenAlex"] };
    } else if (mejorGb && mejorGb.s >= 0.6) d = await libro({ gbid: mejorGb.g.id });
    else throw new Error("no-encontrado");
    d.porTitulo = true;
    return d;
  }

  async function buscar(texto) {
    const id = reconocer(texto);
    if (!id) throw new Error("sin-id");
    if (id.isbn || id.gbid) return libro(id);
    if (id.titulo) return porTitulo(id.titulo);
    const oa = await openAlex(id).catch(() => null);
    const doi = id.doi || (oa && oa.doi);
    const pmid = id.pmid || (oa && oa.pmid);
    const [cr, pm] = await Promise.all([
      doi ? crossref(doi).catch(() => null) : null,
      pmid ? pubmed(pmid).catch(() => null) : null,
    ]);
    if (!oa && !cr && !pm) throw new Error("no-encontrado");
    // Autores: Crossref y PubMed traen apellido separado, mejor que OpenAlex
    const d = unir({ autores: (cr && cr.autores) || (pm && pm.autores) || "" }, cr, pm, oa);
    // Resumen: el más largo suele ser el completo
    d.resumen = [pm, cr, oa].map(f => (f && f.resumen) || "").sort((a, b) => b.length - a.length)[0];
    d.fuentes = [oa && "OpenAlex", cr && "Crossref", pm && "PubMed"].filter(Boolean);
    return d;
  }

  // ¿Es de Uruguay? Afiliaciones de los autores + menciones en título o resumen
  function chequeoUruguay(d) {
    const afUy = (d.paises || []).includes("UY") || /urugua|montevideo/i.test(d.afiliaciones || "");
    const texto = [d.titulo, d.resumen].join(" ");
    const menciona = /urugua|montevideo|canelones|paysand|tacuaremb|treinta y tres|cerro largo|maldonado|lavalleja|soriano/i.test(texto);
    return { afUy, menciona, inst: d.instUy || [] };
  }

  window.Autocompletar = { reconocer, buscar, chequeoUruguay };
})();
