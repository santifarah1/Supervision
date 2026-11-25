/**
 * Copia diaria de la base de Licencias de la Supervisión Zona I a Google Drive.
 *
 * Se instala UNA vez, en la cuenta de Google dueña del proyecto de Firebase
 * (ver herramientas/copia-diaria/LEEME.md). Todas las noches lee todos los datos
 * y guarda un archivo copia-automatica-AAAA-MM-DD.json en la carpeta "Copias Licencias Supervisión"
 * de ese Drive. El archivo tiene el mismo formato que "Exportar copia" de la app,
 * así que se puede volver a cargar con Ajustes → Datos → Importar copia.
 */
const PROYECTO = 'licencias-supervision-zona-i'; // el ID del proyecto de Firebase
const CARPETA = 'Copias Licencias Supervisión';
const COPIAS_A_GUARDAR = 60; // las más viejas se mandan a la papelera
const COLECCIONES = ['agentes', 'licencias', 'notas', 'articulos', 'calendario'];
const API = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO + '/databases/(default)/documents/';

/** Ejecutar una vez a mano: deja programada la copia de todas las noches y hace la primera. */
function instalar() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'copiaDiaria'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('copiaDiaria').timeBased().everyDays(1).atHour(3).create();
  copiaDiaria();
}

/** La copia en sí (la llama el disparador todas las noches). */
function copiaDiaria() {
  if (!PROYECTO) throw new Error('Falta escribir el ID del proyecto de Firebase en PROYECTO, en la línea 10 de este archivo.');
  const estado = armarEstado_(leerDocumento_('datos/config/registros/general'), COLECCIONES.reduce(function (o, c) {
    o[c] = leerColeccion_('datos/' + c + '/registros');
    return o;
  }, {}));
  const carpeta = carpeta_();
  const fecha = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  const nombre = 'copia-automatica-' + fecha + '.json';
  const previa = carpeta.getFilesByName(nombre);
  while (previa.hasNext()) previa.next().setTrashed(true); // si se corre dos veces el mismo día, queda la última
  carpeta.createFile(nombre, JSON.stringify(estado, null, 1), 'application/json');
  limpiarViejas_(carpeta);
  console.log('Copia ' + nombre + ': ' + estado.agentes.length + ' agentes, ' + estado.licencias.length + ' licencias.');
}

/* ---------- Lectura de Firestore (con los permisos de la cuenta dueña del proyecto) ---------- */
function pedir_(url) {
  const r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (r.getResponseCode() === 404) return null;
  if (r.getResponseCode() !== 200) throw new Error('Firestore respondió ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
  return JSON.parse(r.getContentText());
}
function leerDocumento_(ruta) {
  const d = pedir_(API + ruta);
  return d ? deFirestore_({ mapValue: { fields: d.fields || {} } }) : null;
}
function leerColeccion_(ruta) {
  const docs = [];
  let token = '';
  do {
    const r = pedir_(API + ruta + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : '')) || {};
    (r.documents || []).forEach(function (d) { docs.push(deFirestore_({ mapValue: { fields: d.fields || {} } })); });
    token = r.nextPageToken || '';
  } while (token);
  return docs;
}

/* ---------- Conversión al formato de la app ---------- */
/** Pasa un valor de la API de Firestore a un valor común de JavaScript. */
function deFirestore_(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(deFirestore_);
  if ('mapValue' in v) {
    const o = {}, f = v.mapValue.fields || {};
    Object.keys(f).forEach(function (k) { o[k] = deFirestore_(f[k]); });
    return o;
  }
  return null;
}
/** Arma el mismo objeto que exporta la app ("Exportar copia"). */
function armarEstado_(general, colecciones) {
  general = general || {};
  const estado = {
    version: general.version || 1,
    meta: Object.assign({ institucion: 'Supervisión Secundaria Zona I Valle Inferior', semillaArticulos: 1 }, general.meta || {}, { modificado: new Date().toISOString(), copiaAutomatica: true }),
    config: Object.assign({ feriadosCuentanHabiles: false }, general.config || {}),
  };
  COLECCIONES.forEach(function (c) { estado[c] = colecciones[c] || []; });
  return estado;
}

/* ---------- Drive ---------- */
function carpeta_() {
  const it = DriveApp.getFoldersByName(CARPETA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA);
}
function limpiarViejas_(carpeta) {
  const archivos = [];
  const it = carpeta.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (/^(copia-automatica|licencias)-\d{4}-\d{2}-\d{2}\.json$/.test(f.getName())) archivos.push(f);
  }
  const fechaDe = function (f) { return f.getName().slice(-15, -5); };
  archivos.sort(function (a, b) { return fechaDe(a) < fechaDe(b) ? 1 : -1; });
  archivos.slice(COPIAS_A_GUARDAR).forEach(function (f) { f.setTrashed(true); });
}
