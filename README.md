# Mis hábitos

Página para seguir mis hábitos de ejercicio, estudio y juegos, con metas semanales, rachas, mapa de constancia, cronómetro y tareas del día que se pueden enviar a Google Calendar, Outlook o el Calendario del iPhone.

- **Página:** `index.html` + `api.js` + `config.js` (se publica gratis con GitHub Pages).
- **Datos:** una hoja de Google Sheets (pestañas `sesiones`, `tareas` y `config`).
- **Puente:** `apps-script/Code.gs` (Google Apps Script). Revisa la clave en el servidor.

## Puesta en marcha (una sola vez)

### A) Google (≈10 min)
1. Abre <https://sheets.new> y ponle de nombre **Mis hábitos**.
2. Menú **Extensiones → Apps Script**. Borra el código de ejemplo y pega todo el contenido de `apps-script/Code.gs`.
3. En la línea `const CLAVE = '...'` escribe tu clave. **No subas tu clave real a GitHub.**
4. **Implementar → Nueva implementación** → Tipo: **Aplicación web** · Ejecutar como: **Yo** · Quién tiene acceso: **Cualquier persona**.
5. Pulsa **Implementar** y acepta los permisos. Si sale "Google no ha verificado esta app": **Configuración avanzada → Ir a (nombre del proyecto)**. Es tu propio script.
6. Copia la **URL de la aplicación web** (termina en `/exec`). Al abrirla debe decir `"ok": true`.

### B) Publicar la página
1. En `config.js` pega la URL entre las comillas de `API_URL`.
2. En GitHub: **Settings → Pages → Deploy from a branch → `main` / root → Save**.
3. En 1–2 minutos queda en `https://bdquirozv.github.io/mis-habitos/`.
4. Al entrar pide la clave (se recuerda en cada dispositivo).

## Si cambias `Code.gs`
Pega el nuevo código, vuelve a poner tu clave y crea una **nueva versión**: Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar. La URL `/exec` no cambia.

## Calendario
En cada tarea, el botón 📅 abre Google Calendar u Outlook con el evento ya lleno, o descarga un archivo `.ics` que el iPhone abre en Calendario (con aviso 10 minutos antes).
