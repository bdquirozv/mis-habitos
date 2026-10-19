/**
 * Mis hábitos — servidor en Google Apps Script
 *
 * Guarda tus sesiones, tareas y metas en la hoja de cálculo donde pegas este código.
 * Cada colección es una pestaña: "sesiones", "tareas" y "config".
 * Todas las acciones piden la CLAVE (la que escribes al entrar a la página).
 */

// ⬇️ CAMBIA ESTO por tu clave (y no la subas a GitHub)
const CLAVE = 'cambia-esta-clave';

const COLECCIONES = ['sesiones', 'tareas', 'config'];
const ENCABEZADO = ['id', 'fecha', 'resumen', 'datos', 'actualizado'];

function doGet() {
  return salida_({ ok: true, mensaje: 'Mis hábitos: el servidor funciona' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var tiene = false;
  try {
    var req = JSON.parse(e.postData.contents);
    if (!claveOk_(req.clave)) return salida_({ ok: false, error: 'clave' });
    lock.waitLock(25000);
    tiene = true;
    switch (req.action) {
      case 'ping': return salida_({ ok: true });
      case 'list': return salida_({ ok: true, data: leerTodo_() });
      case 'set': guardar_(req.col, req.id, req.data); return salida_({ ok: true });
      case 'delete': borrar_(req.col, req.id); return salida_({ ok: true });
      default: return salida_({ ok: false, error: 'Acción desconocida' });
    }
  } catch (err) {
    return salida_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    if (tiene) lock.releaseLock();
  }
}

function salida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- clave (con bloqueo si adivinan muchas veces) ----------
function claveOk_(c) {
  if (CLAVE === 'cambia-esta-clave') throw new Error('Falta poner tu clave en Code.gs');
  var cache = CacheService.getScriptCache();
  var fallos = Number(cache.get('fallos') || 0);
  if (fallos >= 10) throw new Error('Demasiados intentos. Espera 10 minutos.');
  if (typeof c === 'string' && c === CLAVE) { if (fallos) cache.remove('fallos'); return true; }
  cache.put('fallos', String(fallos + 1), 600);
  Utilities.sleep(500);
  return false;
}

// ---------- hoja de cálculo ----------
function validar_(col, id) {
  if (COLECCIONES.indexOf(col) < 0) throw new Error('Colección no válida');
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(String(id || ''))) throw new Error('Id no válido');
}

function hoja_(col) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(col);
  if (!sh) {
    sh = ss.insertSheet(col);
    sh.getRange(1, 1, 1, ENCABEZADO.length).setValues([ENCABEZADO]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), 3).setNumberFormat('@');
  }
  return sh;
}

function resumen_(col, d) {
  if (col === 'sesiones') return [d.cat, d.act, (d.min || 0) + ' min'].join(' · ');
  if (col === 'tareas') return (d.done ? '✓ ' : '○ ') + (d.hora ? d.hora + ' ' : '') + (d.txt || '');
  return 'metas';
}

function leerTodo_() {
  var out = {};
  COLECCIONES.forEach(function (col) {
    var m = {}, sh = hoja_(col), n = sh.getLastRow();
    if (n >= 2) {
      sh.getRange(2, 1, n - 1, 4).getValues().forEach(function (r) {
        if (!r[0]) return;
        try { m[String(r[0])] = JSON.parse(r[3]); } catch (e) {}
      });
    }
    out[col] = m;
  });
  return out;
}

function fila_(sh, id) {
  var n = sh.getLastRow();
  if (n < 2) return 0;
  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function guardar_(col, id, data) {
  validar_(col, id);
  if (!data || typeof data !== 'object') throw new Error('Datos no válidos');
  var json = JSON.stringify(data);
  if (json.length > 20000) throw new Error('Registro demasiado grande');
  var sh = hoja_(col), f = fila_(sh, id);
  var fila = [String(id), String(data.date || ''), resumen_(col, data), json, new Date()];
  if (f) sh.getRange(f, 1, 1, fila.length).setValues([fila]);
  else sh.appendRow(fila);
}

function borrar_(col, id) {
  validar_(col, id);
  var sh = hoja_(col), f = fila_(sh, id);
  if (f) sh.deleteRow(f);
}
