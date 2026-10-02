// Lee archivos exportados de las bases de datos y los convierte en referencias.
// Formatos: RIS (LILACS/BVS, Scopus, Web of Science, SciELO, Zotero, Mendeley),
// formato PubMed/MEDLINE (.txt o .nbib) y PubMed XML.
(function () {
  const limpio = s => String(s || "").replace(/\s+/g, " ").trim();
  const sinPunto = s => limpio(s).replace(/\.$/, "");

  function detectar(texto) {
    const t = texto.slice(0, 5000);
    if (/<PubmedArticle[\s>]/.test(t) || /<PubmedArticleSet/.test(t)) return "xml";
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
      };
    });
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
    const refs = (formato === "ris" ? ris(texto) : formato === "pubmed" ? pubmed(texto) : xml(texto)).filter(r => r.titulo);
    return { formato, refs };
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

  window.Importar = { leer, marcarDuplicados };
})();
