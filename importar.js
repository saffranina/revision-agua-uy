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
    if (/^\s*</.test(t) && /(dc:title|<dim:|element="title"|<title[\s>])/.test(t)) return "dc";
    if (/^PMID- /m.test(t)) return "pubmed";
    if (/^TY  - /m.test(t)) return "ris";
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
    const lector = { ris, pubmed, xml, dc, feed }[formato];
    const refs = lector(texto).filter(r => r.titulo);
    return { formato, refs, base: baseDeArchivo(formato, refs) };
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

  window.Importar = { leer, marcarDuplicados, leerLink, traerPubmed, traerHilo, linkHiloColibri };
})();
