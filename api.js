// Conexión con tu hoja de Google (Apps Script). Solo se activa si config.js tiene API_URL.
(function () {
  var C = window.CONFIG || {};
  if (!C.API_URL || String(C.API_URL).indexOf('http') !== 0) return;

  var KEY = 'hab_clave', cache = {}, subs = [], clave = null;
  function lsg(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lss(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }

  async function call(action, o) {
    o = o || {}; o.action = action; o.clave = clave;
    var r = await fetch(C.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(o) });
    var j = await r.json();
    if (!j.ok) { var e = new Error(j.error === 'clave' ? 'Clave incorrecta' : (j.error || 'Error del servidor')); e.code = j.error; throw e; }
    return j;
  }
  function emit() { subs.forEach(function (s) { try { s(); } catch (e) {} }); }
  function bucket(n) { return cache[n] = cache[n] || {}; }
  function newId(n) { return n.charAt(0) + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function docRef(n, id) {
    return {
      set: async function (d) { bucket(n)[id] = d; emit(); await call('set', { col: n, id: id, data: d }); },
      update: async function (p) { var m = bucket(n), cur = Object.assign({}, m[id] || {}, p); m[id] = cur; emit(); await call('set', { col: n, id: id, data: cur }); },
      delete: async function () { delete bucket(n)[id]; emit(); await call('delete', { col: n, id: id }); },
      onSnapshot: function (fn) { var s = function () { var m = bucket(n); fn({ exists: id in m, data: function () { return m[id]; } }); }; subs.push(s); s(); }
    };
  }
  function col(n) {
    return {
      add: async function (d) { var id = newId(n); bucket(n)[id] = d; emit(); await call('set', { col: n, id: id, data: d }); return { id: id }; },
      doc: function (id) { return docRef(n, id); },
      onSnapshot: function (fn) {
        var s = function () { var m = bucket(n); fn({ docs: Object.keys(m).map(function (id) { return { id: id, exists: true, data: function () { return m[id]; } }; }) }); };
        subs.push(s); s();
      }
    };
  }
  async function refresh() { var j = await call('list'); cache = j.data || {}; emit(); }

  function askKey(msg) {
    return new Promise(function (res) {
      var o = document.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:16px';
      o.innerHTML = '<form style="background:#121212;color:#fff;border-radius:16px;padding:18px;width:100%;max-width:340px;display:grid;gap:10px;font-family:inherit">' +
        '<div style="font-weight:700;font-size:18px">Mis hábitos</div>' +
        '<div style="color:#8e8e93;font-size:14px">' + (msg || 'Escribe tu clave. Se recuerda en este dispositivo.') + '</div>' +
        '<input type="password" autocomplete="current-password" placeholder="Clave" style="padding:12px;border:0;border-radius:10px;background:#242424;color:#fff;font:inherit">' +
        '<button style="border:0;border-radius:999px;padding:12px;background:#92e82a;color:#000;font-weight:600;font:inherit;font-weight:600">Entrar</button></form>';
      document.body.appendChild(o);
      var f = o.querySelector('form'), i = o.querySelector('input'); i.focus();
      f.onsubmit = function (e) { e.preventDefault(); if (!i.value) return; o.remove(); res(i.value); };
    });
  }

  window.HAB_API = {
    connect: async function () {
      clave = lsg(KEY); var msg = null;
      for (;;) {
        if (!clave) clave = await askKey(msg);
        try { await refresh(); lss(KEY, clave); break; }
        catch (e) { if (e.code === 'clave') { lss(KEY, null); clave = null; msg = 'Clave incorrecta. Inténtalo otra vez.'; continue; } throw e; }
      }
      setInterval(function () { if (!document.hidden) refresh().catch(function () {}); }, 60000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh().catch(function () {}); });
      return { collection: col, doc: function (p) { var a = p.split('/'); return docRef(a[0], a[1]); } };
    },
    // Enlace del calendario automático (suscripción iCloud / Google / Outlook)
    calUrl: async function () {
      if (!clave || !window.crypto || !crypto.subtle) return null;
      var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cal:' + clave));
      var hex = Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 24);
      return C.API_URL + '?cal=' + hex;
    },
    salir: function () { lss(KEY, null); location.reload(); }
  };
})();
