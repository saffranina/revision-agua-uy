/**
 * Registro de la revisión sistemática: agua potable y salud en Uruguay.
 *
 * Este código va DENTRO de la planilla de Google Sheets
 * (Extensiones → Apps Script) y hace de "motor" de la página web:
 *  - guarda búsquedas y referencias en la planilla,
 *  - registra solas las fechas y el historial de cada cambio de estado,
 *  - guarda los PDF en Drive con un nombre automático.
 *
 * Lo único que tienes que cambiar es la CLAVE de abajo.
 */

// Clave para poder editar desde la página. Cámbiala por una tuya.
const CLAVE = 'cambia-esta-clave';

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
};

// Columnas de cada hoja: [clave interna, encabezado visible]
const HOJAS = {
  Busquedas: [
    ['id', 'ID'], ['base', 'Base de datos'], ['fecha', 'Fecha de búsqueda'],
    ['cadena', 'Cadena de búsqueda'], ['filtros', 'Filtros'], ['campos', 'Campos buscados'],
    ['n', 'Resultados'], ['notas', 'Notas'],
    ['creado', 'Registrada el'], ['actualizado', 'Última edición'],
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
};

/* ---------- Entrada web ---------- */

function doGet() {
  return json_({ ok: true, ...leerTodo_() });
}

function doPost(e) {
  let pedido;
  try {
    pedido = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Pedido inválido.' });
  }
  if (pedido.clave !== CLAVE) return json_({ ok: false, error: 'Clave incorrecta.' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = pedido.datos || {};
    switch (pedido.accion) {
      case 'probarClave': return json_({ ok: true });
      case 'guardarBusqueda': return json_({ ok: true, id: guardarBusqueda_(d) });
      case 'borrarBusqueda': borrarFila_('Busquedas', 'id', d.id); return json_({ ok: true });
      case 'guardarReferencia': return json_({ ok: true, ...guardarReferencia_(d) });
      case 'importarReferencias': return json_({ ok: true, ...importarReferencias_(d) });
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
    n: Number(d.n) || 0, notas: d.notas,
    creado: previo.creado || ahora, actualizado: ahora,
  };
  escribirFila_(hoja, fila, reg);
  return reg.id;
}

/* ---------- Referencias ---------- */

function guardarReferencia_(d) {
  const hoja = hoja_('Referencias');
  const ahora = ahora_();
  const fila = d.codigo ? buscarFila_(hoja, 'codigo', d.codigo) : -1;
  const previo = fila > 0 ? leerFila_(hoja, fila) : {};
  const nueva = fila < 0;
  const codigo = previo.codigo || siguienteCodigo_(hoja);
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
  Object.keys(HOJAS).forEach((nombre) => {
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
