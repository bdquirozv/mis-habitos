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

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.cal) {
    if (String(p.cal) !== tokenCal_()) return ContentService.createTextOutput('No autorizado');
    return ContentService.createTextOutput(calendario_()).setMimeType(ContentService.MimeType.ICAL);
  }
  return salida_({ ok: true, mensaje: 'Mis hábitos: el servidor funciona', calendario: true });
}

// ---------- calendario automático (iCloud / Google / Outlook se suscriben a este enlace) ----------
const ZONA = 'America/Lima';

function tokenCal_() {
  if (CLAVE === 'cambia-esta-clave') return '__sin_clave__';
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'cal:' + CLAVE, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('').slice(0, 24);
}

function icsTxt_(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function plegar_(linea) {
  var out = [], s = linea;
  while (s.length > 70) { out.push(s.slice(0, 70)); s = ' ' + s.slice(70); }
  out.push(s);
  return out.join('\r\n');
}

function rrule_(t) {
  var m = { diario: 'FREQ=DAILY', laborables: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', semanal: 'FREQ=WEEKLY', quincenal: 'FREQ=WEEKLY;INTERVAL=2', mensual: 'FREQ=MONTHLY', anual: 'FREQ=YEARLY' }[t.rep];
  if (!m) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t.fin || '')) m += ';UNTIL=' + t.fin.replace(/-/g, '') + 'T235959Z';
  return 'RRULE:' + m;
}

function calendario_() {
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mis habitos//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Mis hábitos', 'X-WR-TIMEZONE:' + ZONA, 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M',
    'BEGIN:VTIMEZONE', 'TZID:' + ZONA, 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0500', 'TZNAME:-05', 'END:STANDARD', 'END:VTIMEZONE'];
  var stamp = Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  var tareas = leerTodo_().tareas || {};
  Object.keys(tareas).forEach(function (id) {
    var t = tareas[id];
    if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t.date || '')) return;
    var y = +t.date.slice(0, 4), mo = +t.date.slice(5, 7), d = +t.date.slice(8, 10);
    var pre = (!t.rep && t.done ? '✓ ' : '') + (t.prio === 'urgente' ? '🔴 ' : t.prio === 'importante' ? '🟠 ' : '');
    L.push('BEGIN:VEVENT', 'UID:' + id + '@mis-habitos', 'DTSTAMP:' + stamp, plegar_('SUMMARY:' + icsTxt_(pre + (t.txt || 'Tarea'))));
    if (/^\d{2}:\d{2}$/.test(t.hora || '')) {
      var ini = new Date(Date.UTC(y, mo - 1, d, +t.hora.slice(0, 2), +t.hora.slice(3, 5)));
      var fin = new Date(ini.getTime() + (Number(t.dur) || 30) * 60000);
      L.push('DTSTART;TZID=' + ZONA + ':' + Utilities.formatDate(ini, 'UTC', "yyyyMMdd'T'HHmmss"),
             'DTEND;TZID=' + ZONA + ':' + Utilities.formatDate(fin, 'UTC', "yyyyMMdd'T'HHmmss"));
    } else {
      var sig = new Date(Date.UTC(y, mo - 1, d + 1));
      L.push('DTSTART;VALUE=DATE:' + t.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + Utilities.formatDate(sig, 'UTC', 'yyyyMMdd'));
    }
    var rr = rrule_(t);
    if (rr) L.push(rr);
    var tipos = { tarea: 'Tarea', trabajo: 'Trabajo', compras: 'Compras', ej: 'Ejercicio', es: 'Estudio', ju: 'Juegos' };
    var desc = [tipos[t.tipo || t.cat] || 'Tarea'];
    if (t.precio !== '' && t.precio != null && !isNaN(Number(t.precio))) desc.push((t.mon === 'USD' ? 'US$ ' : 'S/ ') + Number(t.precio).toFixed(2));
    if (t.nota) desc.push(t.nota);
    L.push(plegar_('DESCRIPTION:' + icsTxt_(desc.join(' · '))));
    if (t.aviso !== '' && t.aviso != null && !isNaN(Number(t.aviso))) {
      var n = Number(t.aviso);
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', plegar_('DESCRIPTION:' + icsTxt_(t.txt || 'Tarea')), 'TRIGGER:' + (n ? '-PT' + n + 'M' : 'PT0M'), 'END:VALARM');
    }
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
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
