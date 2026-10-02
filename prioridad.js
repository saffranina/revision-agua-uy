// Cribado inteligente: estima qué tan probable es que cada artículo pendiente se incluya,
// para cribar primero los más prometedores (la idea de ASReview, sin servidores ni pagos).
//
// Cómo funciona:
//  - Con pocas decisiones todavía, usa las palabras del protocolo (verde suma, rojo resta)
//    y el chequeo de Uruguay.
//  - Cuando ya hay al menos 5 artículos que pasaron y 5 excluidos, además entrena un
//    clasificador bayesiano ingenuo con las palabras del título y el resumen de esos
//    artículos, y combina las dos cosas.
// No decide nada: solo ordena. Todos los artículos se siguen cribando.
(function () {
  const VACIAS = new Set(("a al algo ante como con contra cual de del desde donde el ella en entre era es esta este esto fue han hay la las lo los mas mas no o para pero por que se sin sobre su sus tambien un una uno y ya " +
    "about after also an and are as at be been between but by can for from had has have in into is it its may more not of on or our than that the their these this to was were which with").split(" "));
  const tokens = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .split(/[^a-z0-9]+/).filter(w => w.length > 2 && !VACIAS.has(w) && !/^\d+$/.test(w));
  const texto = r => [r.titulo, r.titulo, r.resumen, r.revista].join(" "); // el título cuenta doble

  const POS = new Set(["ft", "nr", "inc"]), NEG = new Set(["exta", "extc"]);

  // Puntaje por palabras del protocolo: lleva a un número entre 0 y 1
  function puntajePalabras(r, incluir, excluir, secundarias) {
    const t = " " + String(texto(r)).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() + " ";
    const cuenta = lista => lista.reduce((n, w) => n + (t.includes(" " + w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()) ? 1 : 0), 0);
    let s = cuenta(incluir) * 1 + cuenta(secundarias) * .5 - cuenta(excluir) * 1.5;
    if (r.uruguay) s += /^No se detect/.test(r.uruguay) ? -2 : 2;
    return 1 / (1 + Math.exp(-(s - 2) / 2));
  }

  function entrenar(R) {
    const pos = R.filter(r => POS.has(r.estadoK)), neg = R.filter(r => NEG.has(r.estadoK));
    if (pos.length < 5 || neg.length < 5) return { listo: false, pos: pos.length, neg: neg.length };
    const cuentas = { p: new Map(), n: new Map() }, tot = { p: 0, n: 0 };
    const sumar = (rs, c) => rs.forEach(r => new Set(tokens(texto(r))).forEach(w => { cuentas[c].set(w, (cuentas[c].get(w) || 0) + 1); tot[c]++ }));
    sumar(pos, "p"); sumar(neg, "n");
    const vocab = new Set([...cuentas.p.keys(), ...cuentas.n.keys()]).size;
    return { listo: true, cuentas, tot, vocab, prior: Math.log(pos.length / neg.length), pos: pos.length, neg: neg.length };
  }
  function probModelo(m, r) {
    let lo = m.prior;
    new Set(tokens(texto(r))).forEach(w => {
      const p = ((m.cuentas.p.get(w) || 0) + 1) / (m.tot.p + m.vocab), n = ((m.cuentas.n.get(w) || 0) + 1) / (m.tot.n + m.vocab);
      lo += Math.log(p / n);
    });
    return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, lo / 4))));
  }

  // Devuelve un Map codigo → probabilidad (0 a 1) para los artículos de la lista
  function puntuar(R, lista, palabras) {
    const m = entrenar(R);
    const out = new Map();
    lista.forEach(r => {
      const pp = puntajePalabras(r, palabras.incluir, palabras.excluir, palabras.secundarias);
      out.set(r.codigo, m.listo ? .65 * probModelo(m, r) + .35 * pp : pp);
    });
    return { puntajes: out, modelo: m };
  }

  window.Prioridad = { puntuar };
})();
