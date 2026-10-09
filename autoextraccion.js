// Extracción de datos automática: busca el artículo (resumen en OpenAlex/Crossref/PubMed y, si es de acceso
// abierto, el texto completo en Europe PMC) y llena los campos vacíos del formulario para revisarlos y editarlos.
// No usa inteligencia artificial: reconoce patrones (diseño, n, años, departamentos, contaminantes, biomarcadores…).
(function () {
  if (!document.getElementById("dlg-e")) return;
  const EPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/";
  const limpio = t => String(t || "").replace(/\s+/g, " ").trim();
  const sinTilde = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const oraciones = t => limpio(t).split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ(¿])/).filter(o => o.length > 25);
  const corta = (t, n = 700) => t.length > n ? t.slice(0, n).replace(/\s\S*$/, "") + "…" : t;
  const unicos = l => [...new Set(l.filter(Boolean))];

  /* ---------- Traer el texto ---------- */
  async function getJson(url) { const r = await fetch(url); if (!r.ok) throw new Error(String(r.status)); return r.json() }
  async function traerTextos(r) {
    const out = { titulo: r.titulo || "", resumen: r.resumen || "", metodos: "", resultados: "", financiamiento: "", conflictos: "", fuentes: [] };
    if (out.resumen) out.fuentes.push("resumen guardado");
    // Resumen: si falta, se busca por DOI
    if (!out.resumen && r.doi && window.Autocompletar) {
      try { const d = await Autocompletar.buscar(r.doi); if (d.resumen) { out.resumen = d.resumen; out.fuentes.push("resumen de " + d.fuentes.join(", ")) } } catch (e) { }
    }
    // Europe PMC: datos del artículo, financiamiento declarado y, si está en PMC, el texto completo
    let rec = null;
    try {
      const q = r.doi ? `DOI:"${Importar.claveDoi(r.doi)}"` : `TITLE:"${limpio(r.titulo).slice(0, 200).replace(/"/g, "")}"`;
      const j = await getJson(EPMC + "search?" + new URLSearchParams({ query: q, format: "json", resultType: "core", pageSize: "1" }));
      rec = ((j.resultList || {}).result || [])[0] || null;
    } catch (e) { }
    if (rec) {
      if (!out.resumen && rec.abstractText) { out.resumen = limpio(rec.abstractText.replace(/<[^>]+>/g, " ")); out.fuentes.push("resumen de Europe PMC") }
      const grants = ((rec.grantsList || {}).grant || []).map(g => [g.agency, g.grantId].filter(Boolean).join(" ")).filter(Boolean);
      if (grants.length) out.financiamiento = "Financiamiento: " + unicos(grants).join("; ") + ".";
      if (rec.pmcid) {
        try {
          const x = await fetch(EPMC + rec.pmcid + "/fullTextXML");
          if (x.ok) {
            const doc = new DOMParser().parseFromString(await x.text(), "text/xml");
            const secs = [...doc.querySelectorAll("body sec")];
            const deTitulo = re => secs.filter(s => re.test((s.querySelector(":scope > title") || {}).textContent || "")).map(s => s.textContent).join(" ");
            out.metodos = limpio(deTitulo(/method|material|study (design|population|area)|participant|population|sampl|m[eé]todo/i));
            out.resultados = limpio(deTitulo(/^\s*\d*\.?\s*result|resultado/i));
            const fondos = [...doc.querySelectorAll("funding-group, ack")].map(n => limpio(n.textContent)).join(" ");
            if (fondos) out.financiamiento = [out.financiamiento, corta(oraciones(fondos).filter(o => /fund|grant|support|financ|beca|apoyo/i.test(o)).slice(0, 2).join(" "), 400)].filter(Boolean).join(" ");
            const conflicto = [...doc.querySelectorAll('fn[fn-type="conflict"], fn[fn-type="COI-statement"]')].map(n => n.textContent).join(" ") + " " + deTitulo(/competing|conflict|conflicto/i);
            out.conflictos = corta(oraciones(conflicto).slice(0, 1).join(" "), 300);
            if (out.metodos || out.resultados) out.fuentes.push(`texto completo de Europe PMC (${rec.pmcid})`);
          }
        } catch (e) { }
      }
    }
    return out;
  }

  /* ---------- Reconocer los datos ---------- */
  const DISENOS = [
    [/randomi[sz]ed|ensayo (cl[ií]nico )?aleatori/, "Ensayo controlado aleatorizado"],
    [/case[- ]control|casos y controles/, "Casos y controles"],
    [/prospective cohort|cohorte prospectiva/, "Cohorte prospectiva"], [/retrospective cohort|cohorte retrospectiva/, "Cohorte retrospectiva"],
    [/\bcohort\b|\bcohorte\b/, "Cohorte"], [/cross[- ]sectional|transversal/, "Transversal"],
    [/ecological|ecol[oó]gic/, "Ecológico"], [/time[- ]series|series? temporal/, "Series temporales"],
    [/case report|case series|reporte de caso|serie de casos/, "Reporte o serie de casos"],
    [/systematic review|revisi[oó]n sistem/, "Revisión sistemática"], [/risk assessment|evaluaci[oó]n de riesgo/, "Evaluación de riesgo"],
  ];
  const SUSTANCIAS = [
    [/ars[eé]nic/, "arsénico", "Metales pesados"], [/\blead\b|\bplomo\b|plomb/, "plomo", "Metales pesados"], [/cadmi/, "cadmio", "Metales pesados"],
    [/mercur/, "mercurio", "Metales pesados"], [/chrom|cromo/, "cromo", "Metales pesados"], [/fluor/, "flúor", ""],
    [/microcyst|microcist/, "microcistinas", "Cianotoxinas"], [/cyanotox|cianotox/, "cianotoxinas", "Cianotoxinas"], [/cyanobacteri|cianobacteri/, "cianobacterias", "Cianotoxinas"],
    [/saxitox/, "saxitoxinas", "Cianotoxinas"], [/cylindrospermops|cilindrospermops/, "cilindrospermopsina", "Cianotoxinas"],
    [/glyphosat|glifosat/, "glifosato", "Agrotóxicos"], [/\bampa\b/, "AMPA", "Agrotóxicos"], [/atrazin/, "atrazina", "Agrotóxicos"], [/chlorpyrif|clorpirif/, "clorpirifos", "Agrotóxicos"],
    [/pesticid|plaguicid|agrot[oó]xic|herbicid|insecticid|agrochemic|agroqu[ií]mic/, "plaguicidas", "Agrotóxicos"],
    [/trihalomet|\bthms?\b|chloroform|cloroformo|disinfection by-?product|subproductos de la desinfec/, "trihalometanos", "Trihalometanos"],
    [/\bsodium\b|\bsodio\b/, "sodio", "Sodio y cloruros"], [/chloride|clorur/, "cloruros", "Sodio y cloruros"],
    [/nitrat/, "nitratos", "Nitratos"], [/nitrit/, "nitritos", "Nitratos"], [/micropl[aá]stic|nanopl[aá]stic/, "microplásticos", "Microplásticos"],
  ];
  const DESENLACES = [
    [/urin|orina/, "Biomarcadores de exposición"], [/\bblood\b|sangre|plombemia|serum|suero/, "Biomarcadores de exposición"], [/biomark|biomarcador|hair|cabello|pelo/, "Biomarcadores de exposición"],
    [/liver|hepat|h[ií]gado/, "Hepático"], [/diarrh|gastro|vomit|v[oó]mit/, "Gastrointestinal"],
    [/neuro|cogniti|intellig|\biq\b|executive function|funciones ejecutivas|behavio|conducta|achievement|rendimiento escolar/, "Neurológico"],
    [/cancer|c[aá]ncer|tumor|neoplas/, "Cáncer"], [/pregnan|embaraz|birth weight|peso al nacer|preterm|prematur|congenital|cong[eé]nit/, "Reproductivo y desarrollo"],
    [/kidney|renal|ri[ñn][oó]n/, "Renal"], [/hypertens|hipertens|blood pressure|presi[oó]n arterial|cardiovasc/, "Cardiovascular / presión arterial"],
    [/poisoning|intoxicac/, "Intoxicación aguda"],
  ];

  function reconocer(t) {
    const resumen = t.resumen, todo = [t.titulo, t.resumen, t.metodos].join(" ");
    const n = sinTilde(todo), nr = sinTilde([t.titulo, t.resumen].join(" "));
    const f = {}, cat = { exp: [], des: [] }, deps = [];
    // Diseño: primero lo que dice el resumen
    f.diseno = (DISENOS.find(([re]) => re.test(nr)) || DISENOS.find(([re]) => re.test(n)) || [])[1] || "";
    // Tamaño de muestra
    const ns = unicos([...(resumen + " " + t.metodos).matchAll(/\b(?:n\s*=\s*(\d[\d.,]*)|(\d[\d.,]*)\s+(children|schoolchildren|participants|subjects|individuals|households|women|men|adults|infants|newborns|patients|samples|wells|ni[ñn]os|ni[ñn]as|escolares|participantes|personas|hogares|mujeres|adultos|pacientes|muestras|pozos))/gi)]
      .map(m => m[1] ? `n = ${m[1]}` : `${m[2]} ${m[3]}`)).slice(0, 3);
    f.n = ns.join("; ");
    // Período: un rango de años cerca de palabras de tiempo, o el primer rango que aparezca
    const per = (resumen + " " + t.metodos).match(/(?:between|from|during|in|enrolled|recruited|entre|durante|desde|en el per[ií]odo)\s+((?:19|20)\d{2})\s*(?:-|–|—|to|and|y|a|al|hasta)\s*((?:19|20)\d{2})/i)
      || (resumen + " " + t.metodos).match(/\b((?:19|20)\d{2})\s*(?:-|–|—)\s*((?:19|20)\d{2})\b/);
    f.periodo = per ? `${per[1]}–${per[2]}` : "";
    // Población: quiénes y edades
    const quien = [[/schoolchild|school children|escolares/, "escolares"], [/\bchildren\b|ni[ñn]os|ni[ñn]as/, "niñas y niños"], [/infant|lactante|newborn|reci[eé]n nacid/, "lactantes / recién nacidos"],
      [/pregnan|embarazad/, "embarazadas"], [/adolescen/, "adolescentes"], [/\badults?\b|adultos/, "adultos"], [/elderly|older adults|adultos mayores/, "adultos mayores"], [/workers|trabajador/, "trabajadores"],
[/general population|poblaci[oó]n general/, "población general"]].filter(([re]) => re.test(nr)).map(x => x[1]);
    const edad = (resumen + " " + t.metodos).match(/(?:aged|ages?|edad(?:es)? de|de)\s*(\d{1,2})\s*(?:-|–|to|a|y)\s*(\d{1,2})\s*(?:years|a[ñn]os|y\b)/i);
    // Departamentos de Uruguay mencionados
    if (typeof TEJAS !== "undefined") TEJAS.forEach(([d]) => { if (new RegExp("\\b" + sinTilde(d) + "\\b").test(n)) deps.push(d) });
    if (!deps.length && /urugua/.test(n)) deps.push("Todo el país");
    if (quien.includes("escolares")) quien.splice(quien.indexOf("niñas y niños"), quien.includes("niñas y niños") ? 1 : 0);
    f.poblacion = unicos([quien.slice(0, 2).join(", "), edad ? `de ${edad[1]} a ${edad[2]} años` : "", deps.length && deps[0] !== "Todo el país" ? deps.join(", ") : /urugua/.test(n) ? "Uruguay" : ""]).join(", ");
    f.poblacion = f.poblacion ? f.poblacion[0].toUpperCase() + f.poblacion.slice(1) : "";
    // Fuente de agua
    f.fuente = unicos([[/tap water|faucet|household (drinking )?water|home water|canilla|grifo|agua del hogar/, "Agua de la canilla (hogar)"], [/\bwells?\b|pozo|groundwater|agua subterr/, "Pozo / agua subterránea"],
      [/\bose\b|public (water )?supply|piped|municipal water|red p[uú]blica|abastecimiento p[uú]blico|water treatment plant|planta potabilizadora/, "Red pública (OSE)"],
      [/cistern|aljibe/, "Aljibe"], [/bottled|embotellada/, "Agua embotellada"]].filter(([re]) => re.test(n)).map(x => x[1])).join("; ");
    // Contaminantes y categorías
    const sus = SUSTANCIAS.filter(([re]) => re.test(n));
    f.contaminante = unicos(sus.map(x => x[1])).join(", ");
    cat.exp = unicos(sus.map(x => x[2]));
    // Desenlace: biomarcadores (sustancia + matriz) y efectos en salud
    cat.des = unicos(DESENLACES.filter(([re]) => re.test(nr)).map(x => x[1]));
    // Biomarcadores: cada sustancia con la muestra que aparece cerca («arsenic … in urine», «blood lead»)
    const SUS_BIO = { "ars[eé]nic\\w*": "arsénico", "lead|plomo": "plomo", "cadmi\\w*": "cadmio", "mercur\\w*": "mercurio", "glyphosate|glifosato": "glifosato", "ampa": "AMPA", "pesticid\\w*|plaguicid\\w*": "plaguicidas", "microcystin\\w*|microcistin\\w*": "microcistinas" };
    const MAT = "(urin\\w*|orina|blood|sangre|serum|suero|hair|cabello)";
    const nomMat = m => /urin|orina/.test(m) ? "en orina" : /blood|sangre/.test(m) ? "en sangre" : /serum|suero/.test(m) ? "en suero" : "en cabello";
    const pares = [];
    Object.entries(SUS_BIO).forEach(([re, nom]) => {
      const a = new RegExp("\\b(?:" + re + ")\\b\\W+(?:\\w+\\W+){0,6}?" + MAT, "i").exec(nr), b = new RegExp(MAT + "\\s+(?:" + re + ")\\b", "i").exec(nr);
      const m = a ? a[1] : b ? b[1] : null; if (m) pares.push(`${nom} ${nomMat(m)}`);
    });
    f.desenlace = unicos([...pares, ...cat.des.filter(d => d !== "Biomarcadores de exposición")]).join("; ");
    // Cómo se midió: oraciones del resumen y los métodos
    const ors = oraciones([t.resumen, t.metodos].join(" "));
    const medido = /measur|determin|analy[sz]|quantif|collected|sampled|assessed|recall|questionnaire|medi[dó]|determin[oó]|analiz|recolect|cuestionario|recordatorio/i;
    f.medicionExp = corta(ors.filter(o => medido.test(o) && /water|agua/i.test(o)).slice(0, 2).join(" "), 500);
    f.medicionDes = corta(ors.filter(o => medido.test(o) && /urin|blood|serum|hair|biomark|diagnos|record|test|score|orina|sangre|cabello|diagn[oó]stic|registro|escala/i.test(o)).filter(o => !f.medicionExp.includes(o)).slice(0, 2).join(" "), 500);
    // Medida de efecto
    f.efecto = unicos([[/odds ratio|\bor\b\s*[=:(]|razon de odds/, "OR"], [/relative risk|risk ratio|\brr\b\s*[=:(]|riesgo relativo/, "RR"], [/hazard ratio|\bhr\b\s*[=:(]/, "HR"],
      [/regression|regresi[oó]n|β|\bbeta\b|coefficient|coeficiente/, "Coeficiente de regresión"], [/correlat|spearman|pearson|correlaci/, "Correlación"],
      [/prevalence|prevalencia/, "Prevalencia"], [/mean difference|diferencia de medias/, "Diferencia de medias"], [/exceed|guideline|above the (who|limit)|por encima del l[ií]mite|supera/, "Porcentaje sobre el límite"]]
      .filter(([re]) => re.test(sinTilde(t.resumen + " " + t.resultados))).map(x => x[1])).join(", ");
    // Resultados: oraciones de resultados y conclusión del resumen
    const orsR = oraciones(t.resumen);
    const clave = /contribut|suggest|indicat|not a major|sugier|indica|associat|correlat|significant|no (significant )?(association|relationship|difference)|not associated|exceed|higher|lower|increase|decrease|median|mean|conclu|found|showed|revealed|asoci|significativ|mayor|menor|mediana|media|super|conclu|encontr|mostr/i;
    // Los resultados y la conclusión suelen estar en la segunda mitad del resumen
    const segunda = orsR.slice(Math.floor(orsR.length / 2));
    f.resultados = corta(segunda.filter(o => clave.test(o)).slice(-3).join(" ") || segunda.slice(-2).join(" "), 700);
    // Ajuste por confusores
    f.confusores = corta(oraciones([t.metodos, t.resultados, t.resumen].join(" ")).filter(o => /adjust|controll?(ed|ing) for|covariat|confound|ajust|covariab|confus/i.test(o)).slice(0, 2).join(" "), 400);
    // Financiamiento y conflictos
    f.financiamiento = corta([t.financiamiento, t.conflictos].filter(Boolean).join(" "), 500);
    return { f, cat, deps };
  }

  /* ---------- Llenar el formulario ---------- */
  async function completar() {
    const btn = $("#e-auto"), res = $("#e-auto-res");
    const r = R.find(x => x.codigo === extActual); if (!r) return;
    btn.disabled = true; btn.textContent = "Buscando el artículo…"; res.hidden = true;
    try {
      const t = await traerTextos(r);
      if (!t.resumen && !t.metodos) { res.hidden = false; res.innerHTML = `<span class="uycheck warn">No encontré el resumen ni el texto completo de este artículo (sin DOI o no está en las bases abiertas). Completa los campos a mano.</span>`; return }
      btn.textContent = "Leyendo…";
      const { f, cat, deps } = reconocer(t);
      const llenos = [], vacios = [];
      CAMPOS_EXT.forEach(([k, l]) => {
        if (k === "notas") return;
        const el = $("#e-" + k); if (!el) return;
        if (el.value.trim()) return;
        if (f[k]) { el.value = f[k]; el.classList.add("auto-ext"); el.addEventListener("input", () => el.classList.remove("auto-ext"), { once: true }); llenos.push(l) } else vacios.push(l);
      });
      const marcar = (id, valores) => valores.forEach(v => { const i = [...$(id).querySelectorAll("input")].find(x => x.value === v); if (i && !i.checked) i.checked = true });
      marcar("#e-expcat", cat.exp); marcar("#e-descat", cat.des); marcar("#e-deps", deps);
      const nota = `Autocompletado el ${new Date().toLocaleDateString("es-UY")} desde: ${t.fuentes.join("; ")}. Revisar todos los campos.`;
      const notas = $("#e-notas"); if (notas && !notas.value.includes("Autocompletado")) notas.value = [notas.value.trim(), nota].filter(Boolean).join("\n");
      res.hidden = false;
      res.innerHTML = `<span>✨ Completé <b>${llenos.length}</b> campo${llenos.length === 1 ? "" : "s"} (en amarillo) desde: ${esc(t.fuentes.join("; "))}.${cat.exp.length || cat.des.length || deps.length ? " También marqué categorías y departamentos." : ""}</span>
        ${vacios.length ? `<span class="meta">No encontré: ${esc(vacios.join(", "))}.${t.metodos ? "" : " No hay texto completo abierto: esos datos suelen estar en el PDF."}</span>` : ""}
        <span class="uycheck warn">Es un reconocimiento automático de patrones, no una lectura: <b>revisa y corrige cada campo</b> antes de guardar.</span>`;
    } catch (e) { res.hidden = false; res.innerHTML = `<span class="uycheck warn">No se pudo completar: ${esc(e.message)}</span>` }
    finally { btn.disabled = false; btn.textContent = "✨ Completar automáticamente" }
  }
  $("#e-auto").onclick = completar;
  // Al abrir otra extracción se limpia el aviso
  $("#dlg-e").addEventListener("close", () => { $("#e-auto-res").hidden = true });
})();
