// Cadenas de búsqueda listas para copiar, en un desplegable de la pestaña Búsquedas.
// Son las mismas de docs/cadenas-de-busqueda.md: si cambias una, cámbiala en los dos lados.
(function () {
  const AGUA_PM = `("Drinking Water"[Mesh] OR "Water Supply"[Mesh] OR "Water Purification"[Mesh]
 OR "drinking water"[tiab] OR "tap water"[tiab] OR "potable water"[tiab]
 OR "water supply"[tiab] OR "public water"[tiab] OR "well water"[tiab]
 OR "agua potable"[tiab] OR "agua de consumo"[tiab] OR "agua de bebida"[tiab])`;
  const URU_PM = `("Uruguay"[Mesh] OR urugua*[tiab] OR urugua*[ad] OR "Montevideo"[tiab] OR "Montevideo"[ad]
 OR "Canelones"[tiab] OR "Paysandu"[tiab] OR "Tacuarembo"[tiab] OR "Treinta y Tres"[tiab]
 OR "Cerro Largo"[tiab] OR "Maldonado"[tiab] OR "Lavalleja"[tiab] OR "Soriano"[tiab]
 OR "Santa Lucia"[tiab] OR "Rio Negro"[tiab] OR "Laguna del Sauce"[tiab])`;
  const AGUA_BVS = `(mh:"Agua Potable" OR mh:"Abastecimiento de Agua" OR mh:"Purificación del Agua"
 OR tw:"agua potable" OR tw:"agua de consumo" OR tw:"agua de bebida" OR tw:"agua de canilla"
 OR tw:"abastecimiento de agua" OR tw:"agua de pozo" OR tw:"drinking water" OR tw:"água potável")`;
  const URU_BVS = `(mh:Uruguay OR tw:urugua* OR tw:Montevideo OR tw:Canelones OR tw:Paysandu
 OR tw:Tacuarembo OR tw:"Santa Lucia" OR tw:"Laguna del Sauce")`;
  const AGUA_LIBRE = `("drinking water" OR "tap water" OR "potable water" OR "water supply" OR "well water" OR "agua potable")`;
  const URU_LIBRE = `(urugua* OR montevideo OR canelones OR paysandu OR tacuarembo OR "santa lucia" OR "laguna del sauce")`;
  const SEC_LIBRE = `(trihalomethane* OR "disinfection by-product*" OR chloroform OR sodium OR chloride* OR salinity OR "water crisis"
 OR nitrate* OR nitrite* OR methemoglobinemia OR arsenic OR "lead" OR "heavy metal*" OR microplastic*)`;

  const EXP_PM = `("Cyanobacteria"[Mesh] OR "Microcystins"[Mesh] OR "Marine Toxins"[Mesh] OR "Harmful Algal Bloom"[Mesh]
 OR cyanobacteri*[tiab] OR cyanotoxin*[tiab] OR microcystin*[tiab] OR saxitoxin*[tiab]
 OR cylindrospermopsin*[tiab] OR anatoxin*[tiab] OR "algal bloom*"[tiab]
 OR "Pesticides"[Mesh] OR "Herbicides"[Mesh] OR "Insecticides"[Mesh] OR "Agrochemicals"[Mesh]
 OR pesticide*[tiab] OR herbicide*[tiab] OR agrochemical*[tiab] OR glyphosate[tiab]
 OR atrazine[tiab] OR chlorpyrifos[tiab] OR "2,4-D"[tiab] OR endosulfan[tiab] OR imidacloprid[tiab]
 OR plaguicida*[tiab] OR agrotoxico*[tiab] OR agroquimico*[tiab])`;
  const SEC_PM = `("Trihalomethanes"[Mesh] OR "Disinfection"[Mesh] OR trihalomethane*[tiab] OR "disinfection by-product*"[tiab]
 OR "disinfection byproduct*"[tiab] OR chloroform[tiab]
 OR "Sodium"[Mesh] OR "Chlorides"[Mesh] OR sodium[tiab] OR chloride*[tiab] OR salinity[tiab] OR "water crisis"[tiab]
 OR "Nitrates"[Mesh] OR nitrate*[tiab] OR nitrite*[tiab] OR "Methemoglobinemia"[Mesh]
 OR "Metals, Heavy"[Mesh] OR "Arsenic"[Mesh] OR "Lead"[Mesh] OR arsenic[tiab] OR "lead"[tiab] OR "heavy metal*"[tiab]
 OR "Microplastics"[Mesh] OR microplastic*[tiab])`;
  const EXP_BVS = `(mh:Cianobacterias OR mh:Microcistinas OR mh:"Floraciones de Algas Nocivas"
 OR tw:cianobacteria* OR tw:cianotoxina* OR tw:microcistina* OR tw:saxitoxina* OR tw:cyanobacteri*
 OR mh:Plaguicidas OR mh:Herbicidas OR mh:Agroquímicos
 OR tw:plaguicida* OR tw:agrotoxico* OR tw:agroquimico* OR tw:pesticida* OR tw:herbicida*
 OR tw:glifosato OR tw:atrazina OR tw:clorpirifos OR tw:agrotóxico*)`;
  const SEC_BVS = `(mh:Trihalometanos OR tw:trihalometano* OR tw:"subproductos de la desinfección" OR tw:sodio OR tw:cloruro*
 OR tw:salinidad OR tw:"crisis hídrica" OR mh:Nitratos OR tw:nitrato* OR tw:metahemoglobinemia
 OR mh:Arsénico OR mh:Plomo OR tw:arsénico OR tw:plomo OR tw:"metales pesados" OR tw:microplástico*)`;
  const EXP_LIBRE = `(cyanobacteri* OR cyanotoxin* OR microcystin* OR saxitoxin* OR cylindrospermopsin*
 OR "algal bloom*" OR pesticide* OR herbicide* OR agrochemical* OR glyphosate OR atrazine OR chlorpyrifos)`;
  // Foco: el agua que se bebe en el punto de consumo (canilla, pozo, hogar). Todos los contaminantes juntos.
  const CANILLA_PM = `("Drinking Water"[Mesh] OR "tap water"[tiab] OR "faucet water"[tiab] OR "household water"[tiab]
 OR "household drinking water"[tiab] OR "point-of-use"[tiab] OR "point of use"[tiab] OR "point-of-consumption"[tiab]
 OR "well water"[tiab] OR "private well*"[tiab] OR "domestic well*"[tiab] OR "piped water"[tiab] OR "municipal water"[tiab]
 OR "drinking water"[tiab] OR "agua de canilla"[tiab] OR "agua del grifo"[tiab] OR "agua de la red"[tiab]
 OR "agua de pozo"[tiab] OR "agua potable"[tiab] OR "agua de consumo"[tiab] OR "água da torneira"[tiab])`;
  const CANILLA_BVS = `(mh:"Agua Potable" OR tw:"agua de canilla" OR tw:"agua del grifo" OR tw:"agua de la red" OR tw:"agua de pozo"
 OR tw:"agua domiciliaria" OR tw:"agua de consumo" OR tw:"agua potable" OR tw:"agua de bebida" OR tw:aljibe*
 OR tw:"tap water" OR tw:"household water" OR tw:"point-of-use" OR tw:"well water" OR tw:"drinking water" OR tw:"água da torneira")`;
  const CANILLA_LIBRE = `("tap water" OR "faucet water" OR "household water" OR "household drinking water" OR "point-of-use" OR "point of use"
 OR "well water" OR "private well*" OR "piped water" OR "municipal water" OR "drinking water"
 OR "agua de canilla" OR "agua del grifo" OR "agua potable" OR "agua de pozo")`;
  const sinParentesis = b => b.trim().replace(/^\(/, "").replace(/\)$/, "");
  const TODO_PM = `(${sinParentesis(EXP_PM)}\n OR ${sinParentesis(SEC_PM)})`;
  const TODO_BVS = `(${sinParentesis(EXP_BVS)}\n OR ${sinParentesis(SEC_BVS)})`;
  const TODO_LIBRE = `(${sinParentesis(EXP_LIBRE)}\n OR ${sinParentesis(SEC_LIBRE)})`;
  const CANILLA_SCIELO = `("agua de canilla" OR "agua del grifo" OR "agua de la red" OR "agua de pozo" OR "agua potable" OR "agua de consumo"
 OR "tap water" OR "household water" OR "point-of-use" OR "well water" OR "drinking water" OR "água da torneira")
AND (cianobacteria* OR cianotoxina* OR microcistina* OR cyanobacteri* OR plaguicida* OR agrotoxico* OR agroquimico* OR pesticida*
 OR glifosato OR atrazina OR trihalometano* OR sodio OR cloruro* OR nitrato* OR arsénico OR plomo OR microplástico*)`;
  const una = s => s.replace(/\s+/g, " ").trim();
  const pubmed = s => "https://pubmed.ncbi.nlm.nih.gov/?term=" + encodeURIComponent(una(s));
  const bvs = s => "https://pesquisa.bvsalud.org/portal/?lang=es&q=" + encodeURIComponent(una(s));
  const scielo = s => "https://search.scielo.org/?lang=es&q=" + encodeURIComponent(una(s));
  const scholar = s => "https://scholar.google.com/scholar?q=" + encodeURIComponent(una(s));

  const GRUPOS = [
    { titulo: "Interés principal: cianobacterias y agrotóxicos", cadenas: [
      { base: "PubMed / MEDLINE", abrir: pubmed, nota: "MeSH + palabras en título/resumen. [ad] busca en la afiliación de los autores. En la página: pega el link de resultados y usa «Traer artículos de PubMed».",
        cadena: `${AGUA_PM}
AND
${EXP_PM}
AND
${URU_PM}` },
      { base: "BVS / LILACS", abrir: bvs, nota: "mh: son descriptores DeCS (el MeSH en español). Después filtra Base de datos: LILACS (anota también el total) y exporta en RIS.",
        cadena: `${AGUA_BVS}
AND
${EXP_BVS}
AND
${URU_BVS}` },
      { base: "SciELO", abrir: scielo, nota: "Todas las colecciones. Haz una segunda búsqueda en la colección SciELO Uruguay sin el último bloque. Exporta en RIS.",
        cadena: `("agua potable" OR "agua de consumo" OR "agua de bebida" OR "drinking water" OR "água potável")
AND (cianobacteria* OR cianotoxina* OR microcistina* OR cyanobacteri* OR plaguicida* OR agrotoxico*
 OR agroquimico* OR pesticida* OR glifosato OR atrazina)
AND (uruguay OR montevideo)` },
      { base: "Scopus (vía Timbó)", nota: "Entra por Timbó y pégala en Advanced search.",
        cadena: `TITLE-ABS-KEY${AGUA_LIBRE}
AND TITLE-ABS-KEY${EXP_LIBRE}
AND (TITLE-ABS-KEY${URU_LIBRE} OR AFFILCOUNTRY(uruguay))` },
      { base: "Web of Science (vía Timbó)", nota: "Entra por Timbó y pégala en Advanced Search.",
        cadena: `TS=${AGUA_LIBRE}
AND TS=(cyanobacteri* OR cyanotoxin* OR microcystin* OR saxitoxin* OR "algal bloom*"
 OR pesticide* OR herbicide* OR agrochemical* OR glyphosate OR atrazine OR chlorpyrifos)
AND (TS=${URU_LIBRE} OR CU=Uruguay)` },
      { base: "Google Scholar (complementaria)", abrir: scholar, nota: "Busca una línea por vez y revisa las primeras 200 o 300 entradas (anota cuántas).",
        cadena: `"agua potable" cianobacterias Uruguay salud
"agua potable" agrotóxicos OR plaguicidas Uruguay salud
"drinking water" cyanobacteria OR pesticides Uruguay health`, porLinea: true },
    ] },
    { titulo: "Interés secundario: trihalometanos, sodio y cloruros, nitratos, metales, microplásticos", cadenas: [
      { base: "PubMed / MEDLINE", abrir: pubmed, nota: "Regístrala como búsqueda aparte y anota en notas «interés secundario».",
        cadena: `${AGUA_PM}
AND
${SEC_PM}
AND
${URU_PM}` },
      { base: "BVS / LILACS", abrir: bvs, nota: "Filtra LILACS y exporta en RIS.",
        cadena: `${AGUA_BVS}
AND
${SEC_BVS}
AND
${URU_BVS}` },
      { base: "Scopus (vía Timbó)",
        cadena: `TITLE-ABS-KEY${AGUA_LIBRE}
AND TITLE-ABS-KEY${SEC_LIBRE}
AND (TITLE-ABS-KEY${URU_LIBRE} OR AFFILCOUNTRY(uruguay))` },
      { base: "Web of Science (vía Timbó)",
        cadena: `TS=${AGUA_LIBRE}
AND TS=${SEC_LIBRE}
AND (TS=${URU_LIBRE} OR CU=Uruguay)` },
    ] },
    { titulo: "Foco: agua de canilla (la que se bebe en el punto de consumo), todos los contaminantes", cadenas: [
      { base: "PubMed / MEDLINE", abrir: pubmed, nota: "Agua en el punto de consumo (canilla, hogar, pozo) con todos los contaminantes de interés, principal y secundario. Regístrala como búsqueda aparte (en notas: «foco agua de canilla»).",
        cadena: `${CANILLA_PM}\nAND\n${TODO_PM}\nAND\n${URU_PM}` },
      { base: "BVS / LILACS", abrir: bvs, nota: "Filtra LILACS y exporta en RIS.", cadena: `${CANILLA_BVS}\nAND\n${TODO_BVS}\nAND\n${URU_BVS}` },
      { base: "SciELO", abrir: scielo, nota: "Todas las colecciones (o la colección SciELO Uruguay sin el último bloque). Exporta en RIS.",
        cadena: `${CANILLA_SCIELO}\nAND (uruguay OR montevideo)` },
      { base: "Scopus (vía Timbó)", cadena: `TITLE-ABS-KEY${CANILLA_LIBRE}\nAND TITLE-ABS-KEY${TODO_LIBRE}\nAND (TITLE-ABS-KEY${URU_LIBRE} OR AFFILCOUNTRY(uruguay))` },
      { base: "Web of Science (vía Timbó)", cadena: `TS=${CANILLA_LIBRE}\nAND TS=${TODO_LIBRE}\nAND (TS=${URU_LIBRE} OR CU=Uruguay)` },
      { base: "Google Scholar (complementaria)", abrir: scholar, nota: "Una línea por vez; revisa las primeras 200 o 300 entradas.", porLinea: true,
        cadena: `"agua de canilla" OR "agua del grifo" Uruguay salud
"agua de pozo" Uruguay (nitratos OR plaguicidas OR arsénico) salud
"tap water" OR "household water" OR "point-of-use" Uruguay health` },
    ] },
  ];

  // Bloques para la búsqueda automática (buscador.js)
  window.Cadenas = {
    pubmed: { principal: `${AGUA_PM}\nAND\n${EXP_PM}\nAND\n${URU_PM}`, secundario: `${AGUA_PM}\nAND\n${SEC_PM}\nAND\n${URU_PM}`, canilla: `${CANILLA_PM}\nAND\n${TODO_PM}\nAND\n${URU_PM}` },
    bvs: { principal: `${AGUA_BVS}\nAND\n${EXP_BVS}\nAND\n${URU_BVS}`, secundario: `${AGUA_BVS}\nAND\n${SEC_BVS}\nAND\n${URU_BVS}`, canilla: `${CANILLA_BVS}\nAND\n${TODO_BVS}\nAND\n${URU_BVS}` },
    libre: { agua: AGUA_LIBRE, uruguay: URU_LIBRE, principal: EXP_LIBRE, secundario: SEC_LIBRE, aguaCanilla: CANILLA_LIBRE, canilla: TODO_LIBRE },
    scieloCanilla: CANILLA_SCIELO,
  };

  // Versión sin vocabulario controlado: quita los términos MeSH ([Mesh]) y DeCS (mh:) y deja solo el texto libre
  function sinVocab(c) {
    return c.replace(/"[^"]+"\[Mesh(?::NoExp)?\]\s*(OR\s*)?/g, "").replace(/\bmh:("[^"]+"|[^\s()]+)\s*(OR\s*)?/g, "")
      .replace(/\s+OR\s*\)/g, ")").replace(/\(\s*OR\s+/g, "(").replace(/\(\s*\n\s*/g, "(").replace(/[ \t]+\n/g, "\n");
  }
  const conVocab = c => /\[Mesh|\bmh:/.test(c);
  window.Cadenas.sinVocab = sinVocab;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const caja = document.getElementById("cadenas-box");
  if (!caja) return;
  let n = 0;
  caja.querySelector(".cad-cuerpo").innerHTML = GRUPOS.map(g => `<h3 class="cad-grupo">${esc(g.titulo)}</h3>` + g.cadenas.map(c => {
    const id = "cad-" + (n++);
    const abrir = c.abrir && !c.porLinea ? `<a class="btn ghost" href="${esc(c.abrir(c.cadena))}" target="_blank" rel="noopener">🔎 Abrir en ${esc(c.base.split(" ")[0])}</a>` : "";
    const lineas = c.porLinea ? `<div class="cad-lineas">${c.cadena.split("\n").map(l => `<a href="${esc(c.abrir(l))}" target="_blank" rel="noopener">🔎 ${esc(l)}</a>`).join("")}</div>` : "";
    // PubMed y BVS: la cadena con MeSH/DeCS y la misma sin ellos (solo texto libre)
    const vocab = conVocab(c.cadena), nombreVocab = /^PubMed/.test(c.base) ? "MeSH" : "DeCS";
    const sin = vocab ? sinVocab(c.cadena) : "", id2 = id + "-sin";
    const abrirSin = vocab && c.abrir ? `<a class="btn ghost" href="${esc(c.abrir(sin))}" target="_blank" rel="noopener">🔎 Abrir en ${esc(c.base.split(" ")[0])}</a>` : "";
    return `<details class="cad"><summary>${esc(c.base)}${vocab ? ` <span class="note">(con y sin ${nombreVocab})</span>` : ""}</summary>
      ${c.nota ? `<p class="note">${esc(c.nota)}</p>` : ""}
      ${vocab ? `<b class="cad-var">Con ${nombreVocab}</b>` : ""}
      <pre class="cad-pre" id="${id}">${esc(c.cadena)}</pre>
      <div class="cad-btns"><button type="button" class="btn ghost" data-cad="${id}">📋 Copiar</button>${abrir}</div>${lineas}
      ${vocab ? `<b class="cad-var">Sin ${nombreVocab} (solo texto libre en título y resumen)</b>
      <pre class="cad-pre" id="${id2}">${esc(sin)}</pre>
      <div class="cad-btns"><button type="button" class="btn ghost" data-cad="${id2}">📋 Copiar</button>${abrirSin}</div>` : ""}</details>`;
  }).join("")).join("");

  caja.addEventListener("click", async e => {
    const b = e.target.closest("[data-cad]");
    if (!b) return;
    const el = document.getElementById(b.dataset.cad);
    try { await navigator.clipboard.writeText(el.textContent); toast("Cadena copiada") }
    catch (err) { const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Cadena seleccionada: cópiala") }
  });
})();
