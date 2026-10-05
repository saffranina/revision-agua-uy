// Lee archivos exportados de las bases de datos y los convierte en referencias.
// Formatos: RIS (LILACS/BVS, Scopus, Web of Science, SciELO, Zotero, Mendeley),
// formato PubMed/MEDLINE (.txt o .nbib) y PubMed XML.
(function () {
  const limpio = s => String(s || "").replace(/\s+/g, " ").trim();
  const sinPunto = s => limpio(s).replace(/\.$/, "");

  function detectar(texto) {
    const t = texto.slice(0, 5000);
    if (/<PubmedArticle[\s>]/.test(t) || /<PubmedArticleSet/.test(t)) return "xml";
    if (/<rss[\s>]|<feed[\s>][^>]*Atom|<feed\s+xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/i.test(t) || (/<feed[\s>]/.test(t) && /<entry[\s>]/.test(texto))) return "feed";
    // XML de la BVS/LILACS (formato Solr: <doc><arr name="ti">…) u otro XML con campos ti/au/ab
    if (/^\s*</.test(t) && /<doc[\s>]/.test(texto) && /name="(ti|ti_[a-z]{2}|au|ab)"/.test(texto)) return "bvs";
    if (/^\s*</.test(t) && /(dc:title|<dim:|element="title"|<title[\s>])/.test(t)) return "dc";
    if (/^\s*</.test(t)) return "bvs";
    if (/^PMID- /m.test(t)) return "pubmed";
    if (/^TY  - /m.test(t)) return "ris";
    if (/^\s*@\w+\s*\{/m.test(t)) return "bibtex";
    if (/^[^\n]*(title|t[ií]tulo)[^\n]*[,;\t][^\n]*$/im.test(t.split("\n")[0] || "")) return "csv";
    return null;
  }

  function ris(texto) {
    const out = [];
    let r = null, ultima = null;
    texto.replace(/\r/g, "").split("\n").forEach(linea => {
      const m = linea.match(/^([A-Z][A-Z0-9])  -\s?(.*)$/);
      if (!m) { if (r && ultima && linea.trim()) r[ultima][r[ultima].length - 1] += " " + linea.trim(); return }
      const [, tag, val] = m;
      if (tag === "TY") { r = {}; ultima = null }
      if (!r) return;
      if (tag === "ER") { out.push(r); r = null; return }
      (r[tag] = r[tag] || []).push(val.trim()); ultima = tag;
    });
    return out.map(x => {
      const f = (...tags) => { for (const t of tags) if (x[t] && x[t][0]) return x[t][0]; return "" };
      const doi = f("DO").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
      const anio = (f("PY", "Y1", "DA").match(/\d{4}/) || [""])[0];
      return {
        titulo: sinPunto(f("TI", "T1", "CT")),
        autores: (x.AU || x.A1 || []).map(limpio).join("; "),
        anio, revista: limpio(f("JO", "JF", "T2", "JA", "J2")), doi,
        link: f("UR", "L2") || (doi ? "https://doi.org/" + doi : ""),
        resumen: limpio(f("AB", "N2")),
        afiliaciones: (x.AD || x.C1 || []).join(" | "),
        db: [f("DB"), f("DP")].join(" "),
      };
    });
  }

  // XML con Dublin Core (repositorios como Colibri/DSpace, OAI-PMH)
  // XML de la BVS (pesquisa.bvsalud.org → Exportar → XML) y, en general, cualquier XML con un registro por artículo
  function bvs(texto) {
    const doc = new DOMParser().parseFromString(texto, "text/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("formato");
    const todos = Array.from(doc.getElementsByTagName("*"));
    const nombre = e => (e.getAttribute("name") || e.localName || "").toLowerCase();
    const CAMPOS = {
      titulo: ["ti", "ti_es", "ti_en", "ti_pt", "title", "titulo", "article_title"],
      autores: ["au", "author", "authors", "autor", "autores", "creator"],
      resumen: ["ab", "ab_es", "ab_en", "ab_pt", "abstract", "resumen", "description"],
      anio: ["da", "year", "year_cluster", "py", "dp", "date", "publication_year", "ano", "anio"],
      revista: ["ta", "journal", "fo", "source", "revista", "jt"],
      doi: ["doi"],
      link: ["ur", "url", "link", "fulltext"],
      db: ["db"],
      id: ["id"],
    };
    const esCampo = (e, lista) => lista.includes(nombre(e));
    // Un registro: <doc> (Solr) o, si no hay, el padre de cada título
    let registros = todos.filter(e => e.localName === "doc");
    if (!registros.length) registros = [...new Set(todos.filter(e => esCampo(e, CAMPOS.titulo)).map(e => e.parentNode))];
    const valores = (r, lista) => {
      const out = [];
      Array.from(r.children).filter(h => esCampo(h, lista)).sort((a, b) => lista.indexOf(nombre(a)) - lista.indexOf(nombre(b))).forEach(h => {
        const hijos = Array.from(h.children);
        (hijos.length ? hijos : [h]).forEach(x => { const v = limpio(x.textContent); if (v) out.push(v) });
      });
      return out;
    };
    const refs = registros.map(r => {
      const doiTxt = valores(r, CAMPOS.doi).concat(valores(r, CAMPOS.link)).join(" ");
      const doi = (doiTxt.match(/10\.\d{4,9}\/[^\s"<>]+/) || [""])[0];
      const id = valores(r, CAMPOS.id)[0] || "";
      const link = valores(r, CAMPOS.link).find(u => /^https?:\/\//.test(u)) || (doi ? "https://doi.org/" + doi : id ? "https://pesquisa.bvsalud.org/portal/resource/es/" + encodeURIComponent(id) : "");
      return {
        titulo: sinPunto(valores(r, CAMPOS.titulo)[0]),
        autores: [...new Set(valores(r, CAMPOS.autores))].join("; "),
        anio: (valores(r, CAMPOS.anio).join(" ").match(/(?:^|\D)((?:19|20)\d{2})/) || ["", ""])[1],
        revista: valores(r, CAMPOS.revista)[0] || "",
        doi, link, resumen: valores(r, CAMPOS.resumen)[0] || "",
        db: valores(r, CAMPOS.db).join(" "), afiliaciones: "",
      };
    });
    const nf = (texto.match(/numFound="(\d+)"/) || [])[1];
    refs.total = nf ? Number(nf) : undefined;
    return refs;
  }

  function dc(texto) {
    const doc = new DOMParser().parseFromString(texto, "text/xml");
    const todos = Array.from(doc.getElementsByTagName("*"));
    const campo = (el, nombre) => {
      // <dc:title>…</dc:title> o <dim:field element="title">…</dim:field>
      const hijos = Array.from(el.getElementsByTagName("*"));
      return hijos.filter(h => h.localName === nombre || (h.localName === "field" && h.getAttribute("element") === nombre &&
        !(nombre === "description" && h.getAttribute("qualifier") && h.getAttribute("qualifier") !== "abstract")))
        .map(h => limpio(h.textContent)).filter(Boolean);
    };
    // Un registro = el elemento más chico que contiene un título
    const titulos = todos.filter(e => e.localName === "title" || (e.localName === "field" && e.getAttribute("element") === "title"));
    const registros = [...new Set(titulos.map(t => t.parentNode))];
    return registros.map(r => {
      const ids = campo(r, "identifier");
      const doi = (ids.join(" ").match(/10\.\d{4,9}\/[^\s"<>]+/) || [""])[0];
      const link = ids.find(i => /^https?:\/\//.test(i)) || "";
      return {
        titulo: sinPunto(campo(r, "title")[0]),
        autores: campo(r, "creator").concat(campo(r, "contributor")).join("; "),
        anio: ((campo(r, "date")[0] || "").match(/\d{4}/) || [""])[0],
        revista: campo(r, "publisher")[0] || campo(r, "source")[0] || "",
        doi, link: link || (doi ? "https://doi.org/" + doi : ""),
        resumen: campo(r, "description").concat(campo(r, "abstract")).join(" "),
        afiliaciones: "",
      };
    });
  }

  // Acentos al estilo LaTeX: {\'o} → ó, \~n → ñ, {\"u} → ü
  function latex(v) {
    const marca = { "'": "\u0301", "`": "\u0300", "^": "\u0302", "~": "\u0303", '"': "\u0308", "c": "\u0327" };
    return v.replace(/\\i(?![a-z])/g, "i")
      .replace(/\{?\\(['`^~"]|c\s)\s*\{?\s*([A-Za-z])\s*\}?\}?/g, (_, m, l) => (l + marca[m.trim()]).normalize("NFC"))
      .replace(/\\&/g, "&").replace(/[{}]/g, "");
  }

  // BibTeX: @article{clave, title = {…}, author = {A and B}, …}
  function bibtex(texto) {
    const out = [];
    const re = /@(\w+)\s*\{\s*[^,]*,/g; let m;
    const inicios = []; while ((m = re.exec(texto))) inicios.push(m.index);
    inicios.forEach((ini, i) => {
      const bloque = texto.slice(ini, inicios[i + 1] ?? texto.length);
      const campos = {};
      const rc = /(\w+)\s*=\s*/g; let c;
      while ((c = rc.exec(bloque))) {
        let j = rc.lastIndex, valor = "";
        if (bloque[j] === "{") { let prof = 0; for (; j < bloque.length; j++) { if (bloque[j] === "{") prof++; else if (bloque[j] === "}") { prof--; if (!prof) break } valor += bloque[j] } valor = valor.slice(1) }
        else if (bloque[j] === '"') { j++; while (j < bloque.length && bloque[j] !== '"') valor += bloque[j++] }
        else { while (j < bloque.length && !/[,}\n]/.test(bloque[j])) valor += bloque[j++] }
        campos[c[1].toLowerCase()] = limpio(latex(valor));
        rc.lastIndex = j + 1;
      }
      const doi = (campos.doi || "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
      out.push({
        titulo: sinPunto(campos.title), autores: (campos.author || "").split(/\s+and\s+/).map(limpio).filter(Boolean).join("; "),
        anio: ((campos.year || campos.date || "").match(/\d{4}/) || [""])[0], revista: campos.journal || campos.booktitle || campos.publisher || "",
        doi, link: campos.url || (doi ? "https://doi.org/" + doi : ""), resumen: campos.abstract || "", afiliaciones: campos.affiliation || "",
      });
    });
    return out;
  }

  // CSV con encabezados (separado por coma, punto y coma o tabulador)
  function csv(texto) {
    const primera = texto.split("\n")[0];
    const sep = [",", ";", "\t"].sort((a, b) => primera.split(b).length - primera.split(a).length)[0];
    const filas = []; let fila = [], celda = "", comillas = false;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (comillas) { if (ch === '"' && texto[i + 1] === '"') { celda += '"'; i++ } else if (ch === '"') comillas = false; else celda += ch }
      else if (ch === '"') comillas = true;
      else if (ch === sep) { fila.push(celda); celda = "" }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && texto[i + 1] === "\n") i++; fila.push(celda); filas.push(fila); fila = []; celda = "" }
      else celda += ch;
    }
    if (celda || fila.length) { fila.push(celda); filas.push(fila) }
    const cab = (filas.shift() || []).map(h => h.replace(/^\ufeff/, "").trim().toLowerCase());
    const col = (...pats) => cab.findIndex(h => pats.some(p => p.test(h)));
    const iT = col(/^t[ií]tulo$/, /^title$/, /article title/, /t[ií]tulo/, /title/), iA = col(/^autor(es)?$/, /^authors?$/, /autor/, /author/),
      iY = col(/^a[ñn]o$/, /^year$/, /publication year/, /a[ñn]o/, /year/, /^date$/, /fecha/), iJ = col(/revista/, /journal/, /source title/, /^source$/, /fuente/, /publica/),
      iD = col(/^doi$/, /doi/), iU = col(/^url$/, /^link$/, /url/, /link/, /enlace/), iR = col(/resumen/, /abstract/);
    const v = (f, i) => i >= 0 ? limpio(f[i]) : "";
    return filas.filter(f => f.some(x => x.trim())).map(f => {
      const doi = v(f, iD).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
      return { titulo: sinPunto(v(f, iT)), autores: v(f, iA), anio: (v(f, iY).match(/\d{4}/) || [""])[0], revista: v(f, iJ),
        doi, link: v(f, iU) || (doi ? "https://doi.org/" + doi : ""), resumen: v(f, iR), afiliaciones: "" };
    });
  }

  // Hilo de sindicación RSS 2.0 o Atom (también OpenSearch de DSpace/Colibri)
  function feed(texto) {
    const doc = new DOMParser().parseFromString(texto, "text/xml");
    const items = Array.from(doc.getElementsByTagName("*")).filter(e => e.localName === "item" || e.localName === "entry");
    const hijos = (el, ...nombres) => Array.from(el.children).filter(h => nombres.includes(h.localName));
    const txt = (el, ...nombres) => hijos(el, ...nombres).map(h => limpio(h.textContent)).filter(Boolean);
    return items.map(it => {
      const linkEl = hijos(it, "link")[0];
      const link = linkEl ? (linkEl.getAttribute("href") || limpio(linkEl.textContent)) : (txt(it, "guid", "id")[0] || "");
      const autores = txt(it, "creator", "contributor").concat(hijos(it, "author").map(a => {
        const n = Array.from(a.children).find(c => c.localName === "name"); return limpio(n ? n.textContent : a.textContent);
      })).filter(Boolean);
      const resumen = txt(it, "description", "summary", "abstract", "content").join(" ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const ids = txt(it, "identifier").concat([link]).join(" ");
      const doi = (ids.match(/10\.\d{4,9}\/[^\s"<>]+/) || [""])[0];
      return {
        titulo: sinPunto(txt(it, "title")[0]),
        autores: autores.join("; "),
        anio: ((txt(it, "date", "issued", "published", "pubDate", "updated")[0] || "").match(/\d{4}/) || [""])[0],
        revista: txt(it, "publisher", "source")[0] || "",
        doi, link, resumen, afiliaciones: "",
      };
    });
  }
  // OpenSearch dice cuántos resultados hay en total
  function totalFeed(texto) {
    const m = texto.match(/<(?:\w+:)?totalResults>(\d+)</);
    return m ? Number(m[1]) : null;
  }

  // Colibri (DSpace) arma un hilo Atom con los resultados de cualquier búsqueda
  function linkHiloColibri(link) {
    let u; try { u = new URL(link) } catch (e) { return "" }
    if (!/colibri\.udelar/.test(u.hostname)) return "";
    const q = u.searchParams.get("query") || u.searchParams.get("q");
    if (!q) return "";
    const base = /\/jspui\//.test(u.pathname) ? u.origin + "/jspui/open-search/" : u.origin + "/server/opensearch/search";
    const p = new URLSearchParams({ query: q, format: "atom", rpp: "100", start: "0" });
    const scope = u.searchParams.get("scope") || (u.pathname.match(/\/handle\/([^/]+\/[^/]+)/) || [])[1];
    if (scope) p.set("scope", scope);
    return base + "?" + p.toString();
  }

  // Trae un hilo o XML por medio del motor, siguiendo las páginas de OpenSearch
  async function traerHilo(url, pedir, progreso) {
    const refs = []; let total = null, pagina = 0, u = new URL(url);
    const paginado = u.searchParams.has("start") || u.searchParams.has("rpp");
    while (true) {
      progreso(refs.length ? `Trayendo… ${refs.length}${total ? " de " + total : ""}` : "Trayendo…");
      const r = await pedir(u.href);
      if (r.status >= 400) throw new Error(`el sitio respondió con error ${r.status}`);
      const formato = detectar(r.texto);
      if (!formato) throw new Error("lo que devolvió el link no es un hilo RSS/Atom ni un XML que reconozca");
      const nuevos = ({ feed, dc, xml, ris, pubmed })[formato](r.texto).filter(x => x.titulo);
      if (total == null) total = totalFeed(r.texto);
      refs.push(...nuevos);
      pagina++;
      const rpp = Number(u.searchParams.get("rpp")) || nuevos.length;
      if (!paginado || !nuevos.length || nuevos.length < rpp || (total != null && refs.length >= total) || refs.length >= 5000 || pagina > 60) break;
      u.searchParams.set("start", String(Number(u.searchParams.get("start") || 0) + rpp));
    }
    return { refs, total: total ?? refs.length, base: /colibri/.test(u.hostname) ? "Colibri (UdelaR)" : /scielo/.test(u.hostname) ? "SciELO" : "" };
  }

  // Adivina la base de datos a partir del archivo
  function baseDeArchivo(formato, refs) {
    if (formato === "pubmed" || formato === "xml") return "PubMed/MEDLINE";
    const db = refs.map(r => r.db || "").join(" ").toLowerCase();
    if (/scopus/.test(db)) return "Scopus";
    if (/web of science|wos|clarivate/.test(db)) return "Web of Science";
    if (/lilacs/.test(db)) return "LILACS";
    if (/scielo/.test(db)) return "SciELO";
    if (/medline|pubmed/.test(db)) return "PubMed/MEDLINE";
    if (/bvs|bireme/.test(db)) return "BVS (Biblioteca Virtual en Salud)";
    if (/embase/.test(db)) return "Embase";
    if (/cochrane/.test(db)) return "Cochrane Library";
    return "";
  }

  // Lee el link de la página de resultados: base, búsqueda y filtros
  function leerLink(texto) {
    let u;
    try { u = new URL(String(texto).trim()) } catch (e) { return null }
    const h = u.hostname.toLowerCase(), p = u.searchParams;
    const todos = k => p.getAll(k).filter(Boolean);
    const otros = excl => [...p.entries()].filter(([k, v]) => v && !excl.some(x => x instanceof RegExp ? x.test(k) : x === k))
      .map(([k, v]) => `${k}=${v}`);
    const ruido = ["page", "sort", "size", "rpp", "start", "etal", "format", "lang", "hl", "utm_source", "utm_medium", "utm_campaign", "from", "count", "output", "show", "page_size"];
    let base = "Otra", cadena = "", filtros = [];
    if (/pubmed\.ncbi/.test(h)) {
      base = "PubMed/MEDLINE"; cadena = p.get("term") || "";
      filtros = todos("filter");
    } else if (/bvsalud|lilacs/.test(h)) {
      cadena = p.get("q") || p.get("query") || "";
      filtros = [...todos("filter"), ...otros(["q", "query", "filter", "lang", "home_url", "home_text", ...ruido])];
      base = /lilacs/i.test(filtros.join(" ")) ? "LILACS" : "BVS (Biblioteca Virtual en Salud)";
    } else if (/scielo/.test(h)) {
      base = "SciELO"; cadena = p.get("q") || "";
      filtros = otros(["q", "lang", "where", ...ruido]);
    } else if (/colibri\.udelar/.test(h)) {
      base = "Colibri (UdelaR)"; cadena = p.get("query") || p.get("q") || "";
      // DSpace 6: filter_field_N / filter_type_N / filter_value_N
      const n = [...p.keys()].filter(k => /^filter_field_\d+$/.test(k)).map(k => k.split("_").pop());
      filtros = n.map(i => `${p.get("filter_field_" + i)} ${p.get("filter_type_" + i) || ""} ${p.get("filter_value_" + i) || ""}`.trim());
      // DSpace 7: f.campo=valor,operador
      filtros = filtros.concat([...p.entries()].filter(([k]) => /^f\./.test(k)).map(([k, v]) => `${k.slice(2)}: ${v}`));
      if (p.get("scope")) filtros.push("colección: " + p.get("scope"));
      if (/\/handle\//.test(u.pathname)) filtros.push("dentro de " + u.pathname.replace(/\/(simple-)?search.*$/, ""));
    } else if (/scholar\.google/.test(h)) {
      base = "Google Scholar"; cadena = p.get("q") || p.get("as_q") || "";
      if (p.get("as_ylo") || p.get("as_yhi")) filtros.push(`años ${p.get("as_ylo") || "…"}–${p.get("as_yhi") || "…"}`);
      if (p.get("lr")) filtros.push("idioma: " + p.get("lr"));
    } else if (/scopus/.test(h)) {
      base = "Scopus"; cadena = p.get("s") || "";
      filtros = otros(["s", "sid", "sot", "sdt", "origin", "src", "editSaveSearch", "txGid", "sessionSearchId", "st1", "st2", "sl", ...ruido]);
    } else if (/webofscience|webofknowledge/.test(h)) {
      base = "Web of Science";
    } else if (/timbo/.test(h)) {
      base = "Timbó"; cadena = p.get("q") || p.get("query") || p.get("lookfor") || "";
      filtros = otros(["q", "query", "lookfor", ...ruido]);
    } else {
      cadena = p.get("q") || p.get("query") || p.get("term") || p.get("search") || p.get("s") || "";
      filtros = otros(["q", "query", "term", "search", "s", ...ruido]);
    }
    // filter[db][]=LILACS → db: LILACS
    filtros = filtros.map(f => f.replace(/^filter\[([^\]]+)\](\[\])?=/, "$1: "));
    return { base, cadena, filtros: filtros.join("; "), link: u.href, sitio: h };
  }

  function pubmed(texto) {
    const out = [];
    texto.replace(/\r/g, "").split(/\n\s*\n(?=PMID- )/).forEach(bloque => {
      const x = {}; let ultima = null;
      bloque.split("\n").forEach(linea => {
        const m = linea.match(/^([A-Z]{2,4})\s*- (.*)$/);
        if (m) { (x[m[1]] = x[m[1]] || []).push(m[2]); ultima = m[1] }
        else if (ultima && /^\s{6}/.test(linea)) x[ultima][x[ultima].length - 1] += " " + linea.trim();
      });
      if (!x.PMID) return;
      const pmid = x.PMID[0].trim();
      const doi = ((x.LID || []).concat(x.AID || []).find(v => /\[doi\]/.test(v)) || "").replace(/\s*\[doi\]/, "").trim();
      out.push({
        titulo: sinPunto((x.TI || [""])[0]),
        autores: (x.AU || []).map(limpio).join(", "),
        anio: ((x.DP || [""])[0].match(/\d{4}/) || [""])[0],
        revista: limpio((x.JT || x.TA || [""])[0]),
        doi, link: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        resumen: limpio((x.AB || []).join(" ")),
        afiliaciones: (x.AD || []).join(" | "),
      });
    });
    return out;
  }

  function xml(texto) {
    const doc = new DOMParser().parseFromString(texto, "text/xml");
    return Array.from(doc.querySelectorAll("PubmedArticle")).map(a => {
      const q = s => { const n = a.querySelector(s); return n ? limpio(n.textContent) : "" };
      const pmid = q("MedlineCitation > PMID");
      const doi = (Array.from(a.querySelectorAll("ArticleId")).find(n => n.getAttribute("IdType") === "doi") || {}).textContent || "";
      return {
        titulo: sinPunto(q("ArticleTitle")),
        autores: Array.from(a.querySelectorAll("AuthorList > Author")).map(au => {
          const ln = au.querySelector("LastName"), ini = au.querySelector("Initials"), cn = au.querySelector("CollectiveName");
          return ln ? limpio(ln.textContent + " " + (ini ? ini.textContent : "")) : (cn ? limpio(cn.textContent) : "");
        }).filter(Boolean).join(", "),
        anio: (q("PubDate Year") || q("PubDate MedlineDate")).slice(0, 4),
        revista: q("Journal > Title"), doi: limpio(doi),
        link: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "",
        resumen: Array.from(a.querySelectorAll("Abstract > AbstractText")).map(n => {
          const l = n.getAttribute("Label"); return (l ? l + ": " : "") + limpio(n.textContent);
        }).join(" "),
        afiliaciones: Array.from(a.querySelectorAll("AffiliationInfo > Affiliation")).map(n => limpio(n.textContent)).join(" | "),
      };
    });
  }

  // Clave para detectar duplicados: DOI, o si no hay, el título sin tildes ni signos
  const claveTitulo = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const claveDoi = d => String(d || "").toLowerCase().trim();

  function leer(texto) {
    const formato = detectar(texto);
    if (!formato) throw new Error("formato");
    const lector = { ris, pubmed, xml, dc, feed, bibtex, csv, bvs }[formato];
    const todos = lector(texto), refs = todos.filter(r => r.titulo);
    if (formato === "bvs" && !refs.length) throw new Error("formato");
    return { formato, refs, base: baseDeArchivo(formato, refs) || (formato === "bvs" && /bvsalud|lilacs/i.test(texto) ? "LILACS" : ""), total: todos.total };
  }

  // Marca como duplicado lo que ya está en el registro o se repite dentro del archivo
  function marcarDuplicados(refs, existentes) {
    const vistos = new Map();
    existentes.forEach(e => {
      if (e.doi) vistos.set("d:" + claveDoi(e.doi), e.codigo);
      if (e.titulo) vistos.set("t:" + claveTitulo(e.titulo), e.codigo);
    });
    return refs.map((r, i) => {
      const kd = r.doi ? "d:" + claveDoi(r.doi) : null, kt = "t:" + claveTitulo(r.titulo);
      const previo = (kd && vistos.get(kd)) || vistos.get(kt);
      const ref = previo || `fila ${i + 1} de este archivo`;
      if (kd && !vistos.has(kd)) vistos.set(kd, ref);
      if (!vistos.has(kt)) vistos.set(kt, ref);
      return previo ? { ...r, duplicadoDe: previo } : r;
    });
  }

  // Traduce los filtros de la web de PubMed a la sintaxis de búsqueda
  function filtroPubmed(f) {
    let m;
    if ((m = f.match(/^years\.(\d{4})-(\d{4})$/))) return `("${m[1]}/01/01"[dp] : "${m[2]}/12/31"[dp])`;
    if ((m = f.match(/^lang\.(\w+)$/))) return `${m[1]}[la]`;
    if ((m = f.match(/^pubt\.(\w+)$/))) return `"${m[1].replace(/([a-z])([A-Z])/g, "$1 $2")}"[pt]`;
    if (f === "simsearch2.ffrft" || f === "ffrft") return "free full text[sb]";
    if (f === "simsearch1.fha" || f === "fha") return "hasabstract";
    if (f === "simsearch3.fft" || f === "fft") return "full text[sb]";
    if (f === "hum_ani.humans") return "humans[mh]";
    if (f === "hum_ani.animal") return "animals[mh]";
    return null;
  }

  async function traerPubmed(link, progreso) {
    const u = new URL(link), p = u.searchParams;
    const term = p.get("term");
    if (!term) throw new Error("el link no trae la búsqueda");
    const filtros = p.getAll("filter"), sinTraducir = [];
    const partes = [`(${term})`];
    filtros.forEach(f => { const t = filtroPubmed(f); t ? partes.push(t) : sinTraducir.push(f) });
    const consulta = partes.join(" AND ");
    const eu = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
    progreso("Buscando en PubMed…");
    const r = await fetch(`${eu}esearch.fcgi?db=pubmed&retmode=json&retmax=10000&term=${encodeURIComponent(consulta)}`);
    if (!r.ok) throw new Error("PubMed no respondió (" + r.status + ")");
    const j = await r.json();
    const ids = (j.esearchresult && j.esearchresult.idlist) || [], total = Number(j.esearchresult && j.esearchresult.count) || 0;
    if (!ids.length) return { refs: [], base: "PubMed/MEDLINE", total, aviso: "PubMed no devolvió resultados para esta búsqueda." };
    const refs = [];
    for (let i = 0; i < ids.length; i += 200) {
      progreso(`Trayendo ${Math.min(i + 200, ids.length)} de ${ids.length}…`);
      const x = await fetch(`${eu}efetch.fcgi?db=pubmed&retmode=xml&id=${ids.slice(i, i + 200).join(",")}`);
      if (!x.ok) throw new Error("PubMed cortó la descarga (" + x.status + ")");
      refs.push(...xml(await x.text()).filter(r => r.titulo));
      await new Promise(ok => setTimeout(ok, 400)); // PubMed pide no más de 3 pedidos por segundo
    }
    const avisos = [];
    if (sinTraducir.length) avisos.push(`No pude aplicar estos filtros de la web: ${sinTraducir.join(", ")}. Compara la cantidad con la que ves en PubMed.`);
    if (total > ids.length) avisos.push(`La búsqueda tiene ${total} resultados; solo se pueden traer 10.000 por vez.`);
    return { refs, base: "PubMed/MEDLINE", total, aviso: avisos.join(" ") };
  }

  /* ---------- Rastreo de citas (bola de nieve) con OpenAlex ---------- */
  const SEL = "id,doi,display_name,publication_year,authorships,primary_location,abstract_inverted_index";
  function deOpenAlex(w, direccion, desde) {
    const inv = w.abstract_inverted_index, pal = [];
    if (inv) Object.entries(inv).forEach(([p, pos]) => pos.forEach(i => { pal[i] = p }));
    const paises = new Set();
    (w.authorships || []).forEach(a => { (a.countries || []).forEach(c => paises.add(c)); (a.institutions || []).forEach(i => i.country_code && paises.add(i.country_code)) });
    const doi = w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//i, "") : "";
    return {
      titulo: sinPunto(w.display_name || ""), anio: w.publication_year ? String(w.publication_year) : "",
      autores: (w.authorships || []).map(a => a.author && a.author.display_name).filter(Boolean).map(n => { const p = n.split(" "); return p.length > 1 ? p[p.length - 1] + " " + p.slice(0, -1).map(x => x[0]).join("") : n }).join(", "),
      revista: (w.primary_location && w.primary_location.source && w.primary_location.source.display_name) || "",
      doi, link: (w.primary_location && w.primary_location.landing_page_url) || (doi ? "https://doi.org/" + doi : ""),
      resumen: pal.join(" ").trim(), paises: [...paises], afiliaciones: "",
      notas: `Rastreo de citas: ${direccion} ${desde}`, oaid: w.id,
    };
  }
  async function oa(url) { const r = await fetch(url); if (!r.ok) throw new Error("OpenAlex respondió " + r.status); return r.json() }
  async function rastreoCitas(incluidos, progreso) {
    const conDoi = incluidos.filter(r => r.doi);
    if (!conDoi.length) throw new Error("ninguno de los estudios incluidos tiene DOI cargado");
    const vistos = new Map(), base = "https://api.openalex.org/works";
    let hechos = 0;
    for (const r of conDoi) {
      progreso(`Estudio ${++hechos} de ${conDoi.length}…`);
      let w;
      try { w = await oa(`${base}/doi:${encodeURIComponent(r.doi)}?select=id,referenced_works`) } catch (e) { continue }
      const refs = w.referenced_works || [];
      for (let i = 0; i < refs.length; i += 50) {
        const ids = refs.slice(i, i + 50).map(u => u.split("/").pop()).join("|");
        const j = await oa(`${base}?filter=openalex_id:${ids}&per-page=50&select=${SEL}`);
        (j.results || []).forEach(x => { if (!vistos.has(x.id)) vistos.set(x.id, deOpenAlex(x, "referencia de", r.codigo)) });
      }
      const id = w.id.split("/").pop();
      const c = await oa(`${base}?filter=cites:${id}&per-page=200&select=${SEL}`);
      (c.results || []).forEach(x => { if (!vistos.has(x.id)) vistos.set(x.id, deOpenAlex(x, "cita a", r.codigo)) });
    }
    return { refs: [...vistos.values()].filter(x => x.titulo), base: "Otra", sinDoi: incluidos.length - conDoi.length, estudios: conDoi.length };
  }

  window.Importar = { rastreoCitas, leer, marcarDuplicados, leerLink, traerPubmed, traerHilo, linkHiloColibri, claveDoi, claveTitulo };
})();
