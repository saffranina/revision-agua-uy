// Diagrama de flujo PRISMA 2020, tabla de estrategias (PRISMA-S) y texto de métodos.
// Todo se calcula con las búsquedas (B), las referencias (R), el acuerdo entre revisores
// (ACU), el protocolo (PROT) y la extracción y el riesgo de sesgo.
(function () {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = n => Number(n || 0).toLocaleString("es-UY");
  const fecha = s => { if (!s) return ""; const d = new Date(String(s).slice(0, 10) + "T12:00:00"); return isNaN(d) ? s : d.toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" }) };

  // Las búsquedas de "otros métodos" van a la columna derecha del diagrama
  const OTROS_POR_DEFECTO = ["Colibri (UdelaR)", "Google Scholar", "Literatura gris / informes (OSE, MSP, URSEA)", "Otra"];
  const metodoDe = b => b ? (b.metodo || (OTROS_POR_DEFECTO.includes(b.base) ? "otros" : "bases")) : "otros";

  function conteos(B, R) {
    const busq = Object.fromEntries(B.map(b => [b.id, b]));
    const col = m => {
      const refs = R.filter(r => metodoDe(busq[r.busqueda]) === m);
      const k = e => refs.filter(r => r.estadoK === e).length;
      const fuentes = {};
      B.filter(b => metodoDe(b) === m).forEach(b => { fuentes[b.base] = (fuentes[b.base] || 0) + Number(b.n || 0) });
      const identificados = Object.values(fuentes).reduce((a, b) => a + b, 0);
      const motivos = {};
      refs.filter(r => r.estadoK === "extc").forEach(r => { const mo = r.motivo || "Sin motivo anotado"; motivos[mo] = (motivos[mo] || 0) + 1 });
      const cargados = refs.length, dup = k("dup");
      return {
        fuentes, identificados, cargados, dup, noCargados: Math.max(0, identificados - cargados),
        cribados: cargados - dup, pend: k("pend"), exta: k("exta"),
        buscados: k("ft") + k("nr") + k("inc") + k("extc"), nr: k("nr"),
        evaluados: k("ft") + k("inc") + k("extc"), enEvaluacion: k("ft"), extc: k("extc"), motivos, inc: k("inc"),
      };
    };
    return { bases: col("bases"), otros: col("otros"), inc: R.filter(r => r.estadoK === "inc").length };
  }

  /* ---------- Diagrama (SVG autónomo, listo para descargar) ---------- */
  function partir(texto, ancho) {
    const out = [];
    String(texto).split("\n").forEach(par => {
      // Las sublíneas (que empiezan con espacios) quedan con sangría
      const sangria = par.match(/^ */)[0].length ? "\u00a0\u00a0\u00a0" : "";
      let linea = "";
      par.trim().split(" ").forEach(p => {
        if ((linea + " " + p).trim().length > ancho - sangria.length) { if (linea) out.push(sangria + linea); linea = p } else linea = (linea + " " + p).trim();
      });
      out.push(sangria + linea);
    });
    return out;
  }
  function diagrama(B, R) {
    const c = conteos(B, R), L = c.bases, D = c.otros;
    const hayOtros = D.identificados > 0 || D.cargados > 0;
    const W = hayOtros ? 1040 : 640, LH = 15, PAD = 10;
    const cols = { lm: [44, 270], ls: [334, 270], rm: [640, 190], rs: [850, 180] };
    const fuentes = f => Object.entries(f).map(([k, v]) => `  ${k} (n = ${num(v)})`).join("\n");
    const motivos = m => Object.keys(m).length ? Object.entries(m).map(([k, v]) => `  ${k} (n = ${num(v)})`).join("\n") : "  (n = 0)";
    const filas = [
      { lm: `Registros identificados de bases de datos (n = ${num(L.identificados)}):\n${fuentes(L.fuentes) || "  (n = 0)"}`,
        ls: `Registros eliminados antes del cribado:\n  Duplicados (n = ${num(L.dup)})\n  Marcados como no elegibles por herramientas automáticas (n = 0)\n  Eliminados por otras razones o no cargados (n = ${num(L.noCargados)})`,
        rm: hayOtros ? `Registros identificados por otros métodos (n = ${num(D.identificados)}):\n${fuentes(D.fuentes) || "  (n = 0)"}` : null,
        rs: hayOtros && D.dup ? `Duplicados (n = ${num(D.dup)})` : null },
      { lm: `Registros cribados (n = ${num(L.cribados)})${L.pend ? `\n  de ellos, pendientes (n = ${num(L.pend)})` : ""}`, ls: `Registros excluidos (n = ${num(L.exta)})`, rm: null, rs: hayOtros && D.exta ? `Excluidos por título/resumen (n = ${num(D.exta)})` : null },
      { lm: `Publicaciones buscadas para su recuperación (n = ${num(L.buscados)})`, ls: `Publicaciones no recuperadas (n = ${num(L.nr)})`,
        rm: hayOtros ? `Publicaciones buscadas para su recuperación (n = ${num(D.buscados)})` : null, rs: hayOtros ? `Publicaciones no recuperadas (n = ${num(D.nr)})` : null },
      { lm: `Publicaciones evaluadas para decidir su elegibilidad (n = ${num(L.evaluados)})${L.enEvaluacion ? `\n  de ellas, en evaluación (n = ${num(L.enEvaluacion)})` : ""}`,
        ls: `Publicaciones excluidas (n = ${num(L.extc)}):\n${motivos(L.motivos)}`,
        rm: hayOtros ? `Publicaciones evaluadas para decidir su elegibilidad (n = ${num(D.evaluados)})` : null,
        rs: hayOtros ? `Publicaciones excluidas (n = ${num(D.extc)}):\n${motivos(D.motivos)}` : null },
      { lm: `Estudios incluidos en la revisión (n = ${num(c.inc)})\nPublicaciones de los estudios incluidos (n = ${num(c.inc)})`, ls: null, rm: null, rs: null },
    ];
    let svg = "", y = 70;
    const cajas = [];
    filas.forEach((f, i) => {
      const alto = Math.max(...["lm", "ls", "rm", "rs"].map(k => f[k] ? partir(f[k], Math.floor(cols[k][1] / 6.3)).length * LH + PAD * 2 : 0));
      ["lm", "ls", "rm", "rs"].forEach(k => {
        if (!f[k]) return;
        const [x, w] = cols[k], lineas = partir(f[k], Math.floor(w / 6.3));
        svg += `<rect x="${x}" y="${y}" width="${w}" height="${alto}" fill="#ffffff" stroke="#333333" stroke-width="1.2"/>`;
        svg += `<text x="${x + PAD}" y="${y + PAD + 11}" font-size="12" fill="#111111">${lineas.map((l, j) => `<tspan x="${x + PAD}" dy="${j ? LH : 0}">${esc(l)}</tspan>`).join("")}</text>`;
        cajas.push({ k, i, x, y, w, h: alto });
      });
      y += alto + 34;
    });
    const caja = (k, i) => cajas.find(b => b.k === k && b.i === i);
    const flecha = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333333" stroke-width="1.4" marker-end="url(#f)"/>`;
    // Flechas hacia abajo en la columna principal y hacia la derecha a las cajas de excluidos
    [0, 1, 2, 3].forEach(i => {
      const a = caja("lm", i), b = caja("lm", i + 1);
      if (a && b) svg += flecha(a.x + a.w / 2, a.y + a.h, b.x + b.w / 2, b.y - 2);
      const s = caja("ls", i); if (a && s) svg += flecha(a.x + a.w, a.y + a.h / 2, s.x - 2, a.y + a.h / 2);
      const rm = caja("rm", i), rs = caja("rs", i);
      if (rm && rs) svg += flecha(rm.x + rm.w, rm.y + rm.h / 2, rs.x - 2, rm.y + rm.h / 2);
    });
    if (hayOtros) {
      const r0 = caja("rm", 0), r2 = caja("rm", 2), r3 = caja("rm", 3), inc = caja("lm", 4);
      if (r0 && r2) svg += flecha(r0.x + r0.w / 2, r0.y + r0.h, r2.x + r2.w / 2, r2.y - 2);
      if (r2 && r3) svg += flecha(r2.x + r2.w / 2, r2.y + r2.h, r3.x + r3.w / 2, r3.y - 2);
      if (r3 && inc) svg += `<polyline points="${r3.x + r3.w / 2},${r3.y + r3.h} ${r3.x + r3.w / 2},${inc.y + inc.h / 2} ${inc.x + inc.w + 2},${inc.y + inc.h / 2}" fill="none" stroke="#333333" stroke-width="1.4" marker-end="url(#f)"/>`;
    }
    // Encabezados y etapas
    const enc = (x, w, t) => `<rect x="${x}" y="14" width="${w}" height="40" rx="6" fill="#fbefae" stroke="#3b2a5a"/><text x="${x + w / 2}" y="38" font-size="12.5" font-weight="bold" text-anchor="middle" fill="#111111">${esc(t)}</text>`;
    let cab = enc(44, 560, "Identificación de estudios a través de bases de datos y registros");
    if (hayOtros) cab += enc(640, 390, "Identificación de estudios a través de otros métodos");
    const etapa = (y1, y2, t) => `<rect x="6" y="${y1}" width="26" height="${y2 - y1}" rx="5" fill="#e3dafa" stroke="#3b2a5a"/><text transform="translate(23 ${(y1 + y2) / 2}) rotate(-90)" font-size="12.5" font-weight="bold" text-anchor="middle" fill="#111111">${t}</text>`;
    const r0 = caja("lm", 0), r1 = caja("lm", 1), r3 = caja("lm", 3), r4 = caja("lm", 4);
    const etapas = etapa(r0.y, r0.y + r0.h, "Identificación") + etapa(r1.y, r3.y + r3.h, "Cribado") + etapa(r4.y, r4.y + r4.h, "Incluidos");
    const H = y + 6;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif">
<defs><marker id="f" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#333333"/></marker></defs>
<rect width="${W}" height="${H}" fill="#ffffff"/>${cab}${etapas}${svg}</svg>`;
  }

  /* ---------- Tabla de estrategias de búsqueda (PRISMA-S) ---------- */
  function filasBusquedas(B) {
    return [...B].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).map((b, i) => ({
      n: i + 1, fuente: b.base, metodo: metodoDe(b) === "otros" ? "Otros métodos" : "Base de datos",
      fecha: b.fecha, cadena: b.cadena, filtros: b.filtros || "Ninguno", campos: b.campos || "", resultados: Number(b.n || 0), link: b.link || "",
    }));
  }
  function tablaHtml(B) {
    const f = filasBusquedas(B);
    if (!f.length) return `<div class="empty">Cuando registres búsquedas, aparecen acá con su estrategia completa.</div>`;
    return `<div class="tabla"><table><thead><tr><th>N.º</th><th>Fuente</th><th>Fecha</th><th>Estrategia de búsqueda</th><th>Filtros</th><th>Resultados</th></tr></thead><tbody>${f.map(r => `<tr><td>${r.n}</td><td>${esc(r.fuente)}<br><span class="meta">${r.metodo}</span></td><td>${esc(fecha(r.fecha))}</td><td><code>${esc(r.cadena)}</code>${r.campos ? `<br><span class="meta">Campos: ${esc(r.campos)}</span>` : ""}</td><td>${esc(r.filtros)}</td><td>${num(r.resultados)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function tablaWord(B) {
    const f = filasBusquedas(B);
    return `<html><head><meta charset="utf-8"><style>body{font-family:Arial;font-size:10pt}table{border-collapse:collapse}td,th{border:1px solid #000;padding:4px;vertical-align:top}th{background:#eee}</style></head><body>
<h3>Anexo. Estrategias de búsqueda</h3><table><tr><th>N.º</th><th>Fuente</th><th>Tipo</th><th>Fecha</th><th>Estrategia de búsqueda</th><th>Filtros</th><th>Resultados</th><th>Link</th></tr>
${f.map(r => `<tr><td>${r.n}</td><td>${esc(r.fuente)}</td><td>${r.metodo}</td><td>${esc(fecha(r.fecha))}</td><td>${esc(r.cadena)}${r.campos ? `<br>Campos: ${esc(r.campos)}` : ""}</td><td>${esc(r.filtros)}</td><td>${num(r.resultados)}</td><td>${esc(r.link)}</td></tr>`).join("")}
</table></body></html>`;
  }
  function tablaCsv(B) {
    const cel = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s };
    return "﻿" + [["N.º", "Fuente", "Tipo", "Fecha", "Estrategia", "Campos", "Filtros", "Resultados", "Link"],
      ...filasBusquedas(B).map(r => [r.n, r.fuente, r.metodo, r.fecha, r.cadena, r.campos, r.filtros, r.resultados, r.link])].map(f => f.map(cel).join(",")).join("\n");
  }

  /* ---------- Texto de métodos y resultados ---------- */
  // "1 registro", "3 registros"
  const pl = (n, uno, varios) => `${num(n)} ${n === 1 ? uno : varios}`;
  const lista = a => a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join(", ") + " y " + a[a.length - 1];
  const k2 = k => k.toFixed(2).replace(".", ",");
  function textoMetodos(B, R, ACU, PROT, EXT, SES) {
    const c = conteos(B, R), L = c.bases, D = c.otros;
    const bases = [...new Set(B.filter(b => metodoDe(b) === "bases").map(b => b.base))];
    const otros = [...new Set(B.filter(b => metodoDe(b) === "otros").map(b => b.base))];
    const fechas = B.filter(b => metodoDe(b) === "bases").map(b => b.fecha).filter(Boolean).sort();
    const p = [];
    if (PROT.prospero) p.push(`El protocolo de esta revisión fue registrado en PROSPERO (${PROT.prospero}).`);
    p.push("La revisión se reporta siguiendo la declaración PRISMA 2020 y su extensión para la búsqueda bibliográfica PRISMA-S.");
    if (bases.length) p.push(`Se realizaron búsquedas en ${lista(bases)}${fechas.length ? (fechas[0] === fechas[fechas.length - 1] ? ` el ${fecha(fechas[0])}` : ` entre el ${fecha(fechas[0])} y el ${fecha(fechas[fechas.length - 1])}`) : ""}. Las estrategias completas, con fecha, filtros y número de resultados de cada búsqueda, se presentan en el anexo.`);
    if (otros.length) p.push(`Además se buscó por otros métodos en ${lista(otros)}.`);
    p.push(`Los registros se gestionaron en una base de datos en línea propia, que asignó un código a cada registro y guardó automáticamente la fecha de cada decisión. Los duplicados se identificaron por DOI y por título normalizado.`);
    const a1 = ACU && ACU.fase1 && ACU.fase1.n ? ACU.fase1 : null, a2 = ACU && ACU.fase2 && ACU.fase2.n ? ACU.fase2 : null;
    if (a1 || a2) {
      p.push(`El cribado por título y resumen y la evaluación a texto completo fueron realizados de forma independiente y ciega por dos revisores.` +
        (a1 ? ` El acuerdo en el cribado por título y resumen fue del ${Math.round(a1.acuerdo * 100)} % (kappa de Cohen = ${k2(a1.kappa)}; ${num(a1.n)} registros).` : "") +
        (a2 ? ` En la evaluación a texto completo fue del ${Math.round(a2.acuerdo * 100)} % (kappa = ${k2(a2.kappa)}; ${num(a2.n)} publicaciones).` : "") +
        ` Los desacuerdos se resolvieron por consenso entre ambos revisores (${num((a1 ? a1.consenso || 0 : 0) + (a2 ? a2.consenso || 0 : 0))}) o, cuando no fue posible, por un tercer revisor (${num((a1 ? a1.tercero || 0 : 0) + (a2 ? a2.tercero || 0 : 0))}).`);
    } else p.push("Los registros se cribaron por título y resumen y luego se evaluaron a texto completo.");
    if (EXT.length) {
      const verif = EXT.filter(e => e.verificadoPor).length;
      p.push(`Los datos de los estudios incluidos se extrajeron con un formulario estandarizado (diseño, población, departamento, fuente de agua, exposición, desenlace en salud, medida de efecto y resultados); ${verif === EXT.length ? "todas las extracciones fueron verificadas" : `${num(verif)} de ${num(EXT.length)} extracciones fueron verificadas`} por un segundo revisor.`);
    }
    if (SES.length) p.push(`El riesgo de sesgo se evaluó con la herramienta ${lista([...new Set(SES.map(s => s.herramienta || "ROBINS-E"))])}.`);
    const res = [];
    const totalId = L.identificados + D.identificados;
    res.push(`Se identificaron ${pl(totalId, "registro", "registros")} (${num(L.identificados)} en bases de datos${D.identificados ? ` y ${num(D.identificados)} por otros métodos` : ""}). Tras eliminar ${pl(L.dup + D.dup, "duplicado", "duplicados")}, se cribaron ${pl(L.cribados, "registro", "registros")} por título y resumen y se ${L.exta === 1 ? "excluyó" : "excluyeron"} ${num(L.exta)}.`);
    const nrT = L.nr + D.nr;
    res.push(`Se buscaron ${pl(L.buscados + D.buscados, "publicación", "publicaciones")} a texto completo${nrT ? `, de las cuales ${nrT === 1 ? "1 no pudo recuperarse" : num(nrT) + " no pudieron recuperarse"}` : " y se recuperaron todas"}. Se ${L.evaluados + D.evaluados === 1 ? "evaluó" : "evaluaron"} ${num(L.evaluados + D.evaluados)} y se ${L.extc + D.extc === 1 ? "excluyó" : "excluyeron"} ${num(L.extc + D.extc)}` +
      (Object.keys({ ...L.motivos, ...D.motivos }).length ? ` (${Object.entries([L.motivos, D.motivos].reduce((m, x) => { Object.entries(x).forEach(([k, v]) => m[k] = (m[k] || 0) + v); return m }, {})).map(([k, v]) => `${k.toLowerCase()}: ${num(v)}`).join("; ")})` : "") + `.`);
    res.push(`Finalmente se ${c.inc === 1 ? "incluyó 1 estudio" : `incluyeron ${num(c.inc)} estudios`} (figura: diagrama de flujo PRISMA 2020).`);
    const pend = L.pend + D.pend + L.enEvaluacion + D.enEvaluacion;
    return { metodos: p.join(" "), resultados: res.join(" "), aviso: pend ? `Atención: todavía ${pend === 1 ? "hay 1 registro" : `hay ${num(pend)} registros`} sin decisión final; los números van a cambiar.` : "" };
  }

  window.Prisma = { diagrama, conteos, tablaHtml, tablaWord, tablaCsv, textoMetodos, metodoDe, OTROS_POR_DEFECTO };
})();
