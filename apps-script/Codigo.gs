/**
 * Registro de la revisión sistemática: agua potable y salud en Uruguay.
 *
 * Este código va DENTRO de la planilla de Google Sheets
 * (Extensiones → Apps Script) y hace de "motor" de la página web:
 *  - guarda búsquedas y referencias en la planilla,
 *  - registra solas las fechas y el historial de cada cambio de estado,
 *  - guarda los PDF en Drive con un nombre automático.
 *
 * Lo único que tienes que cambiar son las CLAVES de abajo.
 */

// Clave de administración: registrar búsquedas, importar, editar y borrar.
const CLAVE = 'cambia-esta-clave';

// Claves de cada revisor para el cribado doble ciego. Cada revisor entra
// con la suya y no ve las decisiones del otro. El Revisor 3 desempata.
// Si dejas una vacía (''), ese revisor queda desactivado.
// Puedes usar para el Revisor 1 la misma clave que la de administración.
const REVISORES = {
  'Revisor 1': '',
  'Revisor 2': '',
  'Revisor 3': '',
};

// Planilla donde se guardan los datos.
const PLANILLA = '1vYzfLeBfaEk6mMVLodGAxhOadvLE8UeEpc02mqaDPsE';

// Carpeta de Drive donde se guardan los PDF ("2 - PDFs ordenados").
const CARPETA_PDFS = '17g4e9xXyF5fdgXgBNzjjNy9WmBICtEdW';

// Si es true, cualquiera con el link del PDF lo puede abrir.
// Déjalo en false si los PDF tienen derechos de autor.
const PDFS_PUBLICOS = false;

const ZONA = 'America/Montevideo';

const ESTADOS = {
  pend: 'Pendiente de cribado',
  dup: 'Duplicado',
  exta: 'Excluida por título/resumen',
  ft: 'A texto completo',
  extc: 'Excluida a texto completo',
  inc: 'Incluida',
  nr: 'Texto completo no recuperado',
};

// Columnas de cada hoja: [clave interna, encabezado visible]
const HOJAS = {
  Busquedas: [
    ['id', 'ID'], ['base', 'Base de datos'], ['fecha', 'Fecha de búsqueda'],
    ['cadena', 'Cadena de búsqueda'], ['filtros', 'Filtros'], ['campos', 'Campos buscados'],
    ['n', 'Resultados'], ['notas', 'Notas'],
    ['creado', 'Registrada el'], ['actualizado', 'Última edición'], ['link', 'Link de resultados'],
    ['metodo', 'Método (bases / otros)'],
  ],
  Referencias: [
    ['codigo', 'Código'], ['titulo', 'Título'], ['autores', 'Autores'], ['anio', 'Año'],
    ['revista', 'Revista / fuente'], ['doi', 'DOI'], ['link', 'Link de la fuente'],
    ['resumen', 'Resumen'], ['busqueda', 'ID búsqueda'], ['base', 'Base de datos'],
    ['fechaBusqueda', 'Fecha de búsqueda'], ['estado', 'Estado'], ['motivo', 'Motivo de exclusión'],
    ['tema', 'Exposición / contaminante'], ['uruguay', 'Uruguay (chequeo automático)'], ['creado', 'Registrada el'],
    ['fechaCribado', 'Cribada el'], ['fechaEstado', 'Estado actual desde'],
    ['pdf', 'PDF en Drive'], ['pdfNombre', 'Nombre del PDF'], ['pdfFecha', 'PDF guardado el'],
    ['notas', 'Notas'], ['actualizado', 'Última edición'],
  ],
  Historial: [
    ['fecha', 'Fecha y hora'], ['codigo', 'Código'], ['accion', 'Acción'], ['detalle', 'Detalle'],
  ],
  // Decisiones de cada revisor (privadas: la página pública no las muestra)
  // Protocolo: pregunta PECO, criterios, PROSPERO y palabras para resaltar
  Protocolo: [['clave', 'Campo'], ['valor', 'Valor']],
  // Extracción de datos de cada estudio incluido
  Extraccion: [
    ['codigo', 'Código'], ['diseno', 'Diseño del estudio'], ['poblacion', 'Población'], ['n', 'Tamaño de muestra'],
    ['departamento', 'Departamento(s)'], ['periodo', 'Período del estudio'], ['fuente', 'Fuente de agua'],
    ['contaminante', 'Exposición / contaminante'], ['medicionExp', 'Medición de la exposición'],
    ['desenlace', 'Desenlace en salud'], ['medicionDes', 'Medición del desenlace'], ['efecto', 'Medida de efecto'],
    ['resultados', 'Resultados principales'], ['confusores', 'Ajuste por confusores'], ['financiamiento', 'Financiamiento / conflictos'],
    ['notas', 'Notas'], ['extraidoPor', 'Extraído por'], ['fecha', 'Fecha de extracción'],
    ['verificadoPor', 'Verificado por'], ['fechaVerif', 'Fecha de verificación'],
  ],
  // Riesgo de sesgo (ROBINS-E: 7 dominios + juicio global)
  Sesgo: [
    ['codigo', 'Código'], ['herramienta', 'Herramienta'],
    ['d1', 'D1 Confusión'], ['j1', 'D1 Justificación'], ['d2', 'D2 Medición de la exposición'], ['j2', 'D2 Justificación'],
    ['d3', 'D3 Selección de participantes'], ['j3', 'D3 Justificación'], ['d4', 'D4 Intervenciones posteriores a la exposición'], ['j4', 'D4 Justificación'],
    ['d5', 'D5 Datos faltantes'], ['j5', 'D5 Justificación'], ['d6', 'D6 Medición del desenlace'], ['j6', 'D6 Justificación'],
    ['d7', 'D7 Selección del resultado reportado'], ['j7', 'D7 Justificación'], ['global', 'Riesgo global'], ['jg', 'Justificación global'],
    ['evaluador', 'Evaluado por'], ['fecha', 'Fecha'],
  ],
  Decisiones: [
    ['fecha', 'Fecha y hora'], ['codigo', 'Código'], ['fase', 'Fase'], ['revisor', 'Revisor'],
    ['decision', 'Decisión'], ['motivo', 'Motivo'], ['metodo', 'Cómo se resolvió'],
  ],
};
const PRIVADAS = ['Decisiones'];

// Fase 1 = título y resumen; fase 2 = texto completo
const FASE_ESTADO = { 1: 'pend', 2: 'ft' };
// "Quizás" en la fase 1 pasa a texto completo (ante la duda se incluye) pero queda registrado como Quizás
const RESULTADO = { 1: { si: 'ft', quiza: 'ft', no: 'exta', dup: 'dup' }, 2: { si: 'inc', no: 'extc', nr: 'nr' } };
const DECISION_TXT = { si: 'Sí', quiza: 'Quizás', no: 'Excluir', dup: 'Duplicado', nr: 'Texto completo no conseguido' };
// Para comparar a los revisores, Quizás cuenta como Sí
const norm_ = (d) => (d === 'quiza' ? 'si' : d);

/* ---------- Entrada web ---------- */

function doGet() {
  return json_({ ok: true, ...leerTodo_(), acuerdo: acuerdo_() });
}

// Quién es el que entra según la clave
function rol_(clave) {
  const valida = (c) => c && !/^cambia/.test(c);
  const admin = valida(CLAVE) && clave === CLAVE;
  const revisor = Object.keys(REVISORES).find((k) => valida(REVISORES[k]) && REVISORES[k] === clave) || '';
  return { admin, revisor };
}

function doPost(e) {
  let pedido;
  try {
    pedido = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Pedido inválido.' });
  }
  const rol = rol_(pedido.clave);
  if (!rol.admin && !rol.revisor) return json_({ ok: false, error: 'Clave incorrecta.' });
  const soloAdmin = ['guardarBusqueda', 'borrarBusqueda', 'borrarReferencia', 'importarReferencias'];
  if (soloAdmin.includes(pedido.accion) && !rol.admin) return json_({ ok: false, error: 'Esto lo hace solo quien administra.' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = pedido.datos || {};
    switch (pedido.accion) {
      case 'probarClave': return json_({ ok: true, rol });
      case 'decidir': return json_({ ok: true, ...decidir_(rol, d) });
      case 'misDecisiones': return json_({ ok: true, ...misDecisiones_(rol) });
      case 'conflictos': return json_({ ok: true, conflictos: conflictos_() });
      case 'resolver': return json_({ ok: true, ...resolver_(rol, d) });
      case 'guardarProtocolo':
        if (!rol.admin) throw new Error('El protocolo lo edita quien administra.');
        guardarProtocolo_(d); return json_({ ok: true });
      case 'guardarExtraccion': return json_({ ok: true, ...guardarExtraccion_(rol, d) });
      case 'verificarExtraccion': return json_({ ok: true, ...verificarExtraccion_(rol, d) });
      case 'guardarSesgo': return json_({ ok: true, ...guardarSesgo_(rol, d) });
      case 'guardarBusqueda': return json_({ ok: true, id: guardarBusqueda_(d) });
      case 'borrarBusqueda': borrarFila_('Busquedas', 'id', d.id); return json_({ ok: true });
      case 'guardarReferencia': return json_({ ok: true, ...guardarReferencia_(d, rol) });
      case 'importarReferencias': return json_({ ok: true, ...importarReferencias_(d) });
      case 'traerUrl': return json_({ ok: true, ...traerUrl_(d.url) });
      case 'borrarReferencia':
        borrarFila_('Referencias', 'codigo', d.codigo);
        historial_(d.codigo, 'Eliminada', '');
        return json_({ ok: true });
      default: return json_({ ok: false, error: 'Acción desconocida.' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Búsquedas ---------- */

function guardarBusqueda_(d) {
  const hoja = hoja_('Busquedas');
  const ahora = ahora_();
  const fila = d.id ? buscarFila_(hoja, 'id', d.id) : -1;
  const previo = fila > 0 ? leerFila_(hoja, fila) : {};
  const reg = {
    id: d.id || 'B' + Utilities.getUuid().slice(0, 8),
    base: d.base, fecha: d.fecha, cadena: d.cadena, filtros: d.filtros, campos: d.campos,
    n: Number(d.n) || 0, notas: d.notas, link: d.link || '', metodo: d.metodo === 'otros' ? 'otros' : 'bases',
    creado: previo.creado || ahora, actualizado: ahora,
  };
  escribirFila_(hoja, fila, reg);
  return reg.id;
}

/* ---------- Referencias ---------- */

function guardarReferencia_(d, rol) {
  const hoja = hoja_('Referencias');
  const ahora = ahora_();
  const fila = d.codigo ? buscarFila_(hoja, 'codigo', d.codigo) : -1;
  const previo = fila > 0 ? leerFila_(hoja, fila) : {};
  const nueva = fila < 0;
  const codigo = previo.codigo || siguienteCodigo_(hoja);
  // Los revisores no cambian el estado a mano: eso sale del cribado doble ciego
  if (rol && !rol.admin) d.estado = nueva ? 'pend' : estadoKey_(previo.estado);
  const estado = ESTADOS[d.estado] ? d.estado : 'pend';
  const estadoTxt = ESTADOS[estado];
  const cambioEstado = nueva || previo.estado !== estadoTxt;

  // Datos de la búsqueda asociada (fecha y base) se copian solos
  let base = '', fechaBusqueda = '';
  if (d.busqueda) {
    const hb = hoja_('Busquedas');
    const fb = buscarFila_(hb, 'id', d.busqueda);
    if (fb > 0) {
      const b = leerFila_(hb, fb);
      base = b.base; fechaBusqueda = b.fecha;
    }
  }

  const reg = {
    codigo, titulo: d.titulo, autores: d.autores, anio: d.anio || '', revista: d.revista,
    doi: d.doi, link: d.link, resumen: d.resumen, busqueda: d.busqueda || '',
    base, fechaBusqueda, estado: estadoTxt, motivo: d.motivo, tema: d.tema,
    uruguay: d.uruguay || previo.uruguay || '',
    creado: previo.creado || ahora,
    fechaCribado: previo.fechaCribado || (estado !== 'pend' ? ahora : ''),
    fechaEstado: cambioEstado ? ahora : previo.fechaEstado,
    pdf: d.quitarPdf ? '' : (d.pdfLink || previo.pdf || ''),
    pdfNombre: d.quitarPdf ? '' : (d.pdfLink && d.pdfLink !== previo.pdf ? '' : previo.pdfNombre || ''),
    pdfFecha: d.quitarPdf ? '' : (d.pdfLink && d.pdfLink !== previo.pdf ? ahora : previo.pdfFecha || ''),
    notas: d.notas, actualizado: ahora,
  };

  // PDF: subido desde la página, o bajado solo desde un link de acceso abierto
  let bytes = null, aviso = '';
  if (d.pdfBase64) bytes = Utilities.base64Decode(d.pdfBase64);
  else if (d.pdfUrl) {
    try {
      const r = UrlFetchApp.fetch(d.pdfUrl, { muteHttpExceptions: true, followRedirects: true });
      const b = r.getContent();
      // Solo se acepta si de verdad es un PDF (empieza con %PDF)
      if (r.getResponseCode() === 200 && b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) bytes = b;
      else aviso = 'Referencia guardada, pero la revista no dejó bajar el PDF automáticamente. Bájalo desde el link y súbelo con «Subir PDF».';
    } catch (err) {
      aviso = 'Referencia guardada, pero no se pudo bajar el PDF automáticamente. Bájalo desde el link y súbelo con «Subir PDF».';
    }
  }
  if (bytes) {
    const nombre = nombrePdf_(reg);
    const blob = Utilities.newBlob(bytes, 'application/pdf', nombre);
    const archivo = DriveApp.getFolderById(CARPETA_PDFS).createFile(blob);
    if (PDFS_PUBLICOS) archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    reg.pdf = archivo.getUrl();
    reg.pdfNombre = nombre;
    reg.pdfFecha = ahora;
    historial_(codigo, 'PDF guardado', nombre);
  }

  escribirFila_(hoja, fila, reg);
  if (nueva) historial_(codigo, 'Registrada', estadoTxt);
  else if (cambioEstado) historial_(codigo, 'Cambio de estado', previo.estado + ' → ' + estadoTxt);
  return { codigo, aviso };
}

// Importa muchas referencias de una vez (desde un archivo RIS, PubMed o XML).
// Escribe todas las filas juntas para que sea rápido.
function importarReferencias_(d) {
  const hoja = hoja_('Referencias');
  const ahora = ahora_();
  let base = '', fechaBusqueda = '';
  if (d.busqueda) {
    const hb = hoja_('Busquedas');
    const fb = buscarFila_(hb, 'id', d.busqueda);
    if (fb > 0) { const b = leerFila_(hb, fb); base = b.base; fechaBusqueda = b.fecha; }
  }
  let n = parseInt(siguienteCodigo_(hoja).slice(1), 10);
  const cols = HOJAS.Referencias;
  const filas = [], hist = [], codigos = [];
  (d.referencias || []).forEach((r) => {
    const codigo = 'R' + String(n++).padStart(3, '0');
    const estado = ESTADOS[r.estado] ? r.estado : 'pend';
    const reg = {
      codigo, titulo: r.titulo, autores: r.autores, anio: r.anio || '', revista: r.revista,
      doi: r.doi, link: r.link, resumen: r.resumen, busqueda: d.busqueda || '', base, fechaBusqueda,
      estado: ESTADOS[estado], motivo: r.motivo || '', tema: '', uruguay: r.uruguay || '',
      creado: ahora, fechaCribado: estado !== 'pend' ? ahora : '', fechaEstado: ahora,
      pdf: '', pdfNombre: '', pdfFecha: '', notas: r.notas || '', actualizado: ahora,
    };
    filas.push(cols.map(([k]) => (reg[k] === undefined || reg[k] === null ? '' : String(reg[k]))));
    hist.push([ahora, codigo, 'Importada', (d.archivo || 'archivo') + ' · ' + ESTADOS[estado]]);
    codigos.push(codigo);
  });
  if (filas.length) {
    hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, cols.length).setNumberFormat('@').setValues(filas);
    const hh = hoja_('Historial');
    hh.getRange(hh.getLastRow() + 1, 1, hist.length, 4).setNumberFormat('@').setValues(hist);
  }
  return { codigos };
}

// Baja un hilo RSS/Atom o un XML de otro sitio (los navegadores no dejan
// que la página lo haga directamente). Solo con la clave de edición.
function traerUrl_(url) {
  if (!/^https?:\/\//i.test(String(url || ''))) throw new Error('Link inválido.');
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml, */*' } });
  const texto = r.getContentText();
  if (texto.length > 8 * 1024 * 1024) throw new Error('La respuesta es demasiado grande.');
  return { status: r.getResponseCode(), texto };
}

/* ---------- Cribado doble ciego ---------- */

function estadoKey_(texto) {
  return Object.keys(ESTADOS).find((k) => ESTADOS[k] === texto) || 'pend';
}

function decisiones_() {
  const hoja = hoja_('Decisiones');
  const filas = hoja.getLastRow() - 1;
  if (filas < 1) return [];
  return hoja.getRange(2, 1, filas, HOJAS.Decisiones.length).getDisplayValues()
    .map((v, i) => ({ ...objeto_('Decisiones', v), fila: i + 2 }));
}

// Un revisor decide sobre un artículo (decision vacía = deshacer)
function decidir_(rol, d) {
  if (!rol.revisor || rol.revisor === 'Revisor 3') throw new Error('Solo el Revisor 1 y el Revisor 2 criban.');
  const fase = String(d.fase) === '2' ? 2 : 1;
  const hr = hoja_('Referencias');
  const fr = buscarFila_(hr, 'codigo', d.codigo);
  if (fr < 0) throw new Error('No existe la referencia ' + d.codigo + '.');
  const ref = leerFila_(hr, fr);
  if (estadoKey_(ref.estado) !== FASE_ESTADO[fase]) throw new Error(d.codigo + ' ya no está en esta fase (se decidió por acuerdo o lo cambió administración).');
  const hoja = hoja_('Decisiones');
  const mia = decisiones_().find((x) => x.codigo === d.codigo && x.fase === String(fase) && x.revisor === rol.revisor);
  if (!d.decision) {
    if (mia) hoja.deleteRow(mia.fila);
    return { codigo: d.codigo };
  }
  if (!RESULTADO[fase][d.decision]) throw new Error('Decisión inválida.');
  escribirFila_(hoja, mia ? mia.fila : -1, {
    fecha: ahora_(), codigo: d.codigo, fase: String(fase), revisor: rol.revisor,
    decision: d.decision, motivo: d.motivo || '', metodo: '',
  });
  return { codigo: d.codigo, ...evaluar_(d.codigo, fase) };
}

// Si los dos revisores ya decidieron y coinciden, se aplica solo
function evaluar_(codigo, fase) {
  const ds = decisiones_().filter((x) => x.codigo === codigo && x.fase === String(fase));
  if (ds.some((x) => x.revisor === 'Resolución')) return {};
  const r1 = ds.find((x) => x.revisor === 'Revisor 1'), r2 = ds.find((x) => x.revisor === 'Revisor 2');
  if (!r1 || !r2) return { estado: 'esperando' };
  if (norm_(r1.decision) !== norm_(r2.decision)) return { estado: 'conflicto' };
  const motivo = [...new Set([r1.motivo, r2.motivo].filter(Boolean))].join(' / ');
  const quiza = r1.decision === 'quiza' || r2.decision === 'quiza' ? ', con Quizás' : '';
  aplicarEstado_(codigo, RESULTADO[fase][norm_(r1.decision)], motivo, 'acuerdo Revisor 1 y Revisor 2' + quiza);
  return { estado: 'acuerdo' };
}

function aplicarEstado_(codigo, nuevo, motivo, como) {
  const hoja = hoja_('Referencias');
  const fila = buscarFila_(hoja, 'codigo', codigo);
  if (fila < 0) return;
  const r = leerFila_(hoja, fila), ahora = ahora_();
  const antes = r.estado;
  r.estado = ESTADOS[nuevo];
  r.motivo = nuevo === 'exta' || nuevo === 'extc' ? motivo : r.motivo;
  r.fechaCribado = r.fechaCribado || ahora;
  r.fechaEstado = ahora;
  r.actualizado = ahora;
  escribirFila_(hoja, fila, r);
  historial_(codigo, 'Cambio de estado', antes + ' → ' + r.estado + ' (' + como + ')');
}

// Lo que decidió este revisor y cuánto avanzó el otro (sin mostrar sus decisiones)
function misDecisiones_(rol) {
  const ds = decisiones_();
  const otro = rol.revisor === 'Revisor 1' ? 'Revisor 2' : rol.revisor === 'Revisor 2' ? 'Revisor 1' : '';
  return {
    rol,
    mias: ds.filter((x) => x.revisor === rol.revisor).map(({ codigo, fase, decision, motivo }) => ({ codigo, fase, decision, motivo })),
    otro: { revisor: otro, fase1: ds.filter((x) => x.revisor === otro && x.fase === '1').length, fase2: ds.filter((x) => x.revisor === otro && x.fase === '2').length },
  };
}

// Desacuerdos: solo se muestran cuando los dos ya decidieron
function conflictos_() {
  const ds = decisiones_(), refs = {};
  hojaObjetos_('Referencias').forEach((r) => { refs[r.codigo] = estadoKey_(r.estado); });
  const grupos = {};
  ds.forEach((x) => { (grupos[x.codigo + '|' + x.fase] = grupos[x.codigo + '|' + x.fase] || []).push(x); });
  return Object.values(grupos).map((g) => {
    const r1 = g.find((x) => x.revisor === 'Revisor 1'), r2 = g.find((x) => x.revisor === 'Revisor 2');
    if (!r1 || !r2 || norm_(r1.decision) === norm_(r2.decision) || g.some((x) => x.revisor === 'Resolución')) return null;
    if (refs[r1.codigo] !== FASE_ESTADO[r1.fase]) return null;
    const v = (x) => ({ decision: x.decision, texto: DECISION_TXT[x.decision], motivo: x.motivo });
    return { codigo: r1.codigo, fase: Number(r1.fase), r1: v(r1), r2: v(r2) };
  }).filter(Boolean);
}

function resolver_(rol, d) {
  const fase = String(d.fase) === '2' ? 2 : 1;
  if (!RESULTADO[fase][d.decision]) throw new Error('Decisión inválida.');
  const metodo = d.metodo === 'tercero' ? 'Decisión del Revisor 3' : 'Consenso entre Revisor 1 y Revisor 2';
  if (d.metodo === 'tercero' && rol.revisor !== 'Revisor 3' && !rol.admin) throw new Error('Esta opción la usa el Revisor 3.');
  if (!conflictos_().some((c) => c.codigo === d.codigo && c.fase === fase)) throw new Error('Ese conflicto ya no está pendiente.');
  escribirFila_(hoja_('Decisiones'), -1, {
    fecha: ahora_(), codigo: d.codigo, fase: String(fase), revisor: 'Resolución',
    decision: d.decision, motivo: d.motivo || '', metodo: metodo + ' (registró: ' + (rol.revisor || 'administración') + ')',
  });
  aplicarEstado_(d.codigo, RESULTADO[fase][d.decision], d.motivo || '', metodo);
  return { codigo: d.codigo };
}

// Acuerdo entre revisores (kappa de Cohen) por fase: solo números, sin decisiones individuales
function acuerdo_() {
  const ds = decisiones_(), out = {};
  [1, 2].forEach((fase) => {
    const por = {};
    ds.filter((x) => x.fase === String(fase)).forEach((x) => { (por[x.codigo] = por[x.codigo] || {})[x.revisor] = norm_(x.decision); });
    const pares = Object.values(por).filter((p) => p['Revisor 1'] && p['Revisor 2']).map((p) => [p['Revisor 1'], p['Revisor 2']]);
    const n = pares.length;
    if (!n) { out['fase' + fase] = { n: 0 }; return; }
    const iguales = pares.filter(([a, b]) => a === b).length;
    const cats = [...new Set(pares.flat())];
    const pe = cats.reduce((s, c) => s + (pares.filter(([a]) => a === c).length / n) * (pares.filter(([, b]) => b === c).length / n), 0);
    const po = iguales / n;
    const res = ds.filter((x) => x.fase === String(fase) && x.revisor === 'Resolución');
    out['fase' + fase] = {
      n, acuerdo: po, kappa: pe === 1 ? 1 : (po - pe) / (1 - pe), conflictos: n - iguales,
      consenso: res.filter((x) => /^Consenso/.test(x.metodo)).length, tercero: res.filter((x) => /Revisor 3/.test(x.metodo)).length,
    };
  });
  return out;
}

/* ---------- Protocolo, extracción y riesgo de sesgo ---------- */

function guardarProtocolo_(d) {
  const hoja = hoja_('Protocolo');
  Object.keys(d).forEach((k) => {
    const fila = buscarFila_(hoja, 'clave', k);
    escribirFila_(hoja, fila, { clave: k, valor: d[k] == null ? '' : String(d[k]) });
  });
  historial_('', 'Protocolo actualizado', Object.keys(d).join(', '));
}

function quien_(rol) { return rol.revisor || 'administración'; }

function guardarExtraccion_(rol, d) {
  const hoja = hoja_('Extraccion');
  const fila = buscarFila_(hoja, 'codigo', d.codigo);
  const previo = fila > 0 ? leerFila_(hoja, fila) : {};
  const reg = { ...previo };
  HOJAS.Extraccion.forEach(([k]) => { if (d[k] !== undefined && !['extraidoPor', 'fecha', 'verificadoPor', 'fechaVerif'].includes(k)) reg[k] = d[k]; });
  reg.codigo = d.codigo; reg.extraidoPor = quien_(rol); reg.fecha = ahora_();
  // Si cambian los datos, la verificación anterior deja de valer
  reg.verificadoPor = ''; reg.fechaVerif = '';
  escribirFila_(hoja, fila, reg);
  historial_(d.codigo, 'Extracción de datos', 'por ' + reg.extraidoPor);
  return { codigo: d.codigo };
}

function verificarExtraccion_(rol, d) {
  const hoja = hoja_('Extraccion');
  const fila = buscarFila_(hoja, 'codigo', d.codigo);
  if (fila < 0) throw new Error('Todavía no hay datos extraídos de ' + d.codigo + '.');
  const reg = leerFila_(hoja, fila);
  if (reg.extraidoPor === quien_(rol)) throw new Error('La verificación la hace otra persona, no quien extrajo los datos.');
  reg.verificadoPor = quien_(rol); reg.fechaVerif = ahora_();
  escribirFila_(hoja, fila, reg);
  historial_(d.codigo, 'Extracción verificada', 'por ' + reg.verificadoPor);
  return { codigo: d.codigo };
}

function guardarSesgo_(rol, d) {
  const hoja = hoja_('Sesgo');
  const fila = buscarFila_(hoja, 'codigo', d.codigo);
  const reg = { codigo: d.codigo };
  HOJAS.Sesgo.forEach(([k]) => { if (d[k] !== undefined) reg[k] = d[k]; });
  reg.codigo = d.codigo; reg.herramienta = d.herramienta || 'ROBINS-E'; reg.evaluador = quien_(rol); reg.fecha = ahora_();
  escribirFila_(hoja, fila, reg);
  historial_(d.codigo, 'Riesgo de sesgo', (reg.global || 'sin juicio global') + ' · por ' + reg.evaluador);
  return { codigo: d.codigo };
}

function hojaObjetos_(nombre) {
  const hoja = hoja_(nombre);
  const filas = hoja.getLastRow() - 1;
  return filas > 0 ? hoja.getRange(2, 1, filas, HOJAS[nombre].length).getDisplayValues().map((v) => objeto_(nombre, v)) : [];
}

function siguienteCodigo_(hoja) {
  const filas = hoja.getLastRow() - 1;
  let max = 0;
  if (filas > 0) {
    hoja.getRange(2, 1, filas, 1).getValues().forEach(([c]) => {
      const n = parseInt(String(c).slice(1), 10);
      if (n > max) max = n;
    });
  }
  return 'R' + String(max + 1).padStart(3, '0');
}

// R004_Gonzalez_2019_Nitratos-agua-consumo-rural-Uruguay.pdf
function nombrePdf_(r) {
  const limpio = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ').trim();
  const apellido = limpio(String(r.autores || '').split(/[,;]/)[0]).split(/\s+/)[0] || 'SinAutor';
  const titulo = limpio(r.titulo).split(/\s+/).filter((w) => w.length > 2).slice(0, 5).join('-') || 'SinTitulo';
  return `${r.codigo}_${apellido}_${r.anio || 'sf'}_${titulo}.pdf`;
}

/* ---------- Planilla ---------- */

function leerTodo_() {
  const out = {};
  Object.keys(HOJAS).filter((n) => !PRIVADAS.includes(n)).forEach((nombre) => {
    const hoja = hoja_(nombre);
    const filas = hoja.getLastRow() - 1;
    out[nombre.toLowerCase()] = filas > 0
      ? hoja.getRange(2, 1, filas, HOJAS[nombre].length).getDisplayValues()
        .map((v) => objeto_(nombre, v))
      : [];
  });
  return out;
}

function hoja_(nombre) {
  const ss = SpreadsheetApp.openById(PLANILLA);
  let hoja = ss.getSheetByName(nombre);
  const cols = HOJAS[nombre];
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    hoja.getRange(1, 1, 1, cols.length).setValues([cols.map((c) => c[1])])
      .setFontWeight('bold').setBackground('#e1eef2');
    hoja.setFrozenRows(1);
    // Todo como texto para que Sheets no cambie fechas ni códigos
    hoja.getRange(2, 1, hoja.getMaxRows() - 1, cols.length).setNumberFormat('@');
  } else if (hoja.getLastColumn() < cols.length) {
    // Columnas nuevas agregadas en una actualización: se suman al final
    const desde = hoja.getLastColumn() + 1;
    hoja.getRange(1, desde, 1, cols.length - desde + 1).setValues([cols.slice(desde - 1).map((c) => c[1])])
      .setFontWeight('bold').setBackground('#e1eef2');
    hoja.getRange(2, desde, hoja.getMaxRows() - 1, cols.length - desde + 1).setNumberFormat('@');
  }
  return hoja;
}

function objeto_(nombre, valores) {
  const o = {};
  HOJAS[nombre].forEach(([k], i) => { o[k] = valores[i]; });
  return o;
}

function buscarFila_(hoja, campo, valor) {
  const col = HOJAS[hoja.getName()].findIndex(([k]) => k === campo) + 1;
  const filas = hoja.getLastRow() - 1;
  if (!valor || filas < 1) return -1;
  const vals = hoja.getRange(2, col, filas, 1).getDisplayValues();
  for (let i = 0; i < vals.length; i++) if (vals[i][0] === String(valor)) return i + 2;
  return -1;
}

function leerFila_(hoja, fila) {
  const cols = HOJAS[hoja.getName()];
  return objeto_(hoja.getName(), hoja.getRange(fila, 1, 1, cols.length).getDisplayValues()[0]);
}

function escribirFila_(hoja, fila, reg) {
  const cols = HOJAS[hoja.getName()];
  const valores = [cols.map(([k]) => (reg[k] === undefined || reg[k] === null ? '' : String(reg[k])))];
  const destino = fila > 0 ? fila : hoja.getLastRow() + 1;
  hoja.getRange(destino, 1, 1, cols.length).setNumberFormat('@').setValues(valores);
}

function borrarFila_(nombre, campo, valor) {
  const hoja = hoja_(nombre);
  const fila = buscarFila_(hoja, campo, valor);
  if (fila > 0) hoja.deleteRow(fila);
}

function historial_(codigo, accion, detalle) {
  escribirFila_(hoja_('Historial'), -1, { fecha: ahora_(), codigo, accion, detalle });
}

function ahora_() {
  return Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Ejecuta esta función una vez desde el editor para crear las hojas y dar permisos. */
function prepararPlanilla() {
  Object.keys(HOJAS).forEach(hoja_);
  const sobrante = SpreadsheetApp.openById(PLANILLA).getSheetByName('Hoja 1') || SpreadsheetApp.openById(PLANILLA).getSheetByName('Sheet1');
  if (sobrante && SpreadsheetApp.openById(PLANILLA).getSheets().length > 1) SpreadsheetApp.openById(PLANILLA).deleteSheet(sobrante);
  DriveApp.getFolderById(CARPETA_PDFS).getName();
}
