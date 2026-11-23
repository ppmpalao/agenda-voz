/* Conexión con Google Calendar (OAuth 2.0 con Google Identity Services + API oficial).
 * No hay servidor ni secretos: solo el ID de cliente público de config.js.
 */
(function (root) {
  "use strict";

  const API = "https://www.googleapis.com/calendar/v3";
  const TAREAS = "https://tasks.googleapis.com/tasks/v1";
  const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/tasks";
  const cfg = () => (root.CONFIG || {});
  const TZ = () => cfg().ZONA || "Europe/Madrid";

  const LS = {
    get(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
    del(k) { try { root.localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
  };

  // Si cambian los permisos, se descarta la sesión guardada para pedir los nuevos
  if (LS.get("ag_scope") !== SCOPES) { LS.del("ag_token"); LS.del("ag_exp"); LS.del("ag_conectado"); LS.set("ag_scope", SCOPES); }
  let token = LS.get("ag_token") || null;
  let expira = Number(LS.get("ag_exp") || 0);

  function error(codigo, mensaje) { const e = new Error(mensaje); e.codigo = codigo; return e; }

  const configurado = () => !!cfg().CLIENT_ID && cfg().CLIENT_ID.indexOf("PENDIENTE") !== 0;
  const sesionValida = () => !!token && Date.now() < expira - 60000;
  const habiaConectado = () => LS.get("ag_conectado") === "1";

  // Debe llamarse directamente desde un toque del usuario (el navegador bloquea ventanas si no).
  // ---------- Inicio de sesión ----------
  // Con servidor (WORKER_URL en config.js): se guarda una "llave de renovación" y la app se reconecta sola.
  // Sin servidor: sesión de 1 hora con el método sencillo de Google (hace falta tocar para reconectar).
  const urlServidor = () => String(cfg().WORKER_URL || "").replace(/\/$/, "");
  const gisListo = () => !!(root.google && root.google.accounts && root.google.accounts.oauth2);
  const sinRenovacion = () => LS.get("ag_sinrefresh") === "1";

  function esperarGIS() {
    return new Promise((resolve, reject) => {
      if (gisListo()) { resolve(); return; }
      let n = 0;
      const t = setInterval(() => {
        if (gisListo()) { clearInterval(t); resolve(); }
        else if (++n > 80) { clearInterval(t); reject(error("GIS", "No se ha podido cargar el inicio de sesión de Google. Comprueba tu conexión a internet.")); }
      }, 100);
    });
  }

  function guardarToken(r) {
    token = r.access_token;
    expira = Date.now() + Number(r.expires_in || 3600) * 1000;
    LS.set("ag_token", token); LS.set("ag_exp", String(expira)); LS.set("ag_conectado", "1");
  }

  async function pedirServidor(ruta, cuerpo) {
    let r;
    try { r = await fetch(urlServidor() + ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) }); }
    catch (e) { throw error("RED", "Sin conexión con el servidor de la app. Comprueba tu internet."); }
    let d = {};
    try { d = await r.json(); } catch (e) { /* sin cuerpo */ }
    if (!r.ok) throw error(d.error === "invalid_grant" ? "CADUCADA" : "SERVIDOR", d.error_description || d.error || "El servidor de la app ha respondido con un error " + r.status + ".");
    return d;
  }

  async function renovar() {
    try {
      guardarToken(await pedirServidor("/renovar", { refresh_token: LS.get("ag_refresh") }));
      return token;
    } catch (e) {
      if (e.codigo === "CADUCADA") { LS.del("ag_refresh"); throw error("CADUCADA", "La conexión con Google ha caducado. Pulsa de nuevo para reconectar."); }
      throw e;
    }
  }

  // Ventana de Google (solo desde un toque del usuario). Devuelve un código que el servidor canjea.
  async function entrarConCodigo(op) {
    await esperarGIS();
    return new Promise((resolve, reject) => {
      const cliente = root.google.accounts.oauth2.initCodeClient({
        client_id: cfg().CLIENT_ID,
        scope: SCOPES,
        ux_mode: "popup",
        select_account: !!op.cambiarCuenta,
        hint: op.cambiarCuenta ? undefined : (LS.get("ag_email") || undefined),
        callback: async (r) => {
          if (r.error || !r.code) { reject(error("AUTH", "Google no ha autorizado el acceso (" + (r.error || "sin código") + ").")); return; }
          try {
            const d = await pedirServidor("/canjear", { code: r.code });
            guardarToken(d);
            if (d.refresh_token) { LS.set("ag_refresh", d.refresh_token); LS.del("ag_sinrefresh"); }
            else { LS.del("ag_refresh"); LS.set("ag_sinrefresh", "1"); }
            resolve(token);
          } catch (e) { reject(e); }
        },
        error_callback: (e) => reject(error("AUTH", e && e.type === "popup_closed" ? "Has cerrado la ventana de Google antes de terminar." : "No se pudo iniciar sesión con Google."))
      });
      cliente.requestCode();
    });
  }

  // op.silencioso: intenta renovar sin ventanas (al abrir la app). op.cambiarCuenta: muestra el selector de cuentas.
  // Debe llamarse directamente desde un toque del usuario cuando haga falta la ventana de Google.
  function asegurarToken(op) {
    op = op || {};
    if (!configurado()) return Promise.reject(error("CONFIG", "Falta configurar el ID de cliente de Google (archivo config.js)."));
    if (!op.cambiarCuenta && sesionValida()) return Promise.resolve(token);

    if (urlServidor()) {
      if (!op.cambiarCuenta && LS.get("ag_refresh")) return renovar();
      if (op.silencioso) return Promise.reject(error("INTERACCION", "Hace falta un toque para reconectar."));
      return entrarConCodigo(op);
    }

    const lanzar = (resolve, reject) => {
      const cliente = root.google.accounts.oauth2.initTokenClient({
        client_id: cfg().CLIENT_ID,
        scope: SCOPES,
        hint: op.cambiarCuenta ? undefined : (LS.get("ag_email") || undefined),
        callback: (r) => {
          if (r.error) { reject(error("AUTH", "Google no ha autorizado el acceso (" + r.error + ").")); return; }
          guardarToken(r);
          resolve(token);
        },
        error_callback: (e) => reject(error("AUTH", e && e.type === "popup_closed" ? "Has cerrado la ventana de Google antes de terminar." : "No se pudo iniciar sesión con Google."))
      });
      cliente.requestAccessToken({ prompt: op.cambiarCuenta ? "select_account" : (op.silencioso ? "none" : "") });
    };
    return new Promise((resolve, reject) => {
      if (gisListo()) { lanzar(resolve, reject); return; }
      esperarGIS().then(() => lanzar(resolve, reject), reject);
    });
  }

  function cerrarSesion() {
    token = null; expira = 0;
    LS.del("ag_token"); LS.del("ag_exp"); LS.del("ag_conectado"); LS.del("ag_refresh");
  }

  async function llamar(ruta, opciones, base) {
    let r;
    try {
      r = await fetch((base || API) + ruta, Object.assign({}, opciones, {
        headers: Object.assign({ Authorization: "Bearer " + token, "Content-Type": "application/json" }, (opciones && opciones.headers) || {})
      }));
    } catch (e) {
      throw error("RED", "Sin conexión con Google. Comprueba tu internet e inténtalo de nuevo.");
    }
    if (r.ok) return r.status === 204 ? null : r.json();
    let detalle = {};
    try { detalle = await r.json(); } catch (e) { /* sin cuerpo */ }
    const msg = (detalle.error && detalle.error.message) || "";
    const motivo = (detalle.error && detalle.error.errors && detalle.error.errors[0] && detalle.error.errors[0].reason) || "";
    if (r.status === 401) { token = null; expira = 0; LS.del("ag_token"); throw error("SESION", "La sesión de Google ha caducado. Vuelve a pulsar el botón."); }
    if (r.status === 403 && /accessNotConfigured|SERVICE_DISABLED/i.test(motivo + msg)) throw error("API", base === TAREAS ? "La API de Google Tasks no está activada en tu proyecto de Google Cloud (Biblioteca → Google Tasks API → Habilitar)." : "La API de Google Calendar no está activada en tu proyecto de Google Cloud.");
    if (r.status === 403 && /insufficient|scope/i.test(motivo + msg)) { token = null; expira = 0; LS.del("ag_token"); throw error("PERMISO", "Falta el permiso de Tareas. Pulsa «Conectar con Google Calendar» y acepta todos los permisos."); }
    if (r.status === 403) throw error("PERMISO", "Google ha denegado el permiso (" + (msg || motivo) + ").");
    if (r.status === 404) throw error("NOEXISTE", "No se encuentra el calendario o el evento.");
    if (r.status === 409) throw error("DUPLICADO", "Este evento ya estaba guardado.");
    throw error("HTTP", "Google ha respondido con un error " + r.status + (msg ? ": " + msg : "") + ".");
  }

  async function listarCalendarios() {
    const d = await llamar("/users/me/calendarList?minAccessRole=writer&maxResults=100");
    return (d.items || []).map((c) => ({ id: c.id, nombre: c.summaryOverride || c.summary, principal: !!c.primary }));
  }

  // ---------- construcción del evento ----------
  const pad = (n) => String(n).padStart(2, "0");
  function sumarMinutos(fecha, hora, min) {
    const [y, m, d] = fecha.split("-").map(Number);
    const [h, mi] = hora.split(":").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d, h, mi) + min * 60000);
    return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate()) + "T" + pad(t.getUTCHours()) + ":" + pad(t.getUTCMinutes()) + ":00";
  }
  function sumarDias(fecha, n) {
    const [y, m, d] = fecha.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate());
  }

  // ev: { titulo, fecha:'YYYY-MM-DD', hora:'HH:MM'|'' , duracion:min, aviso:min|-1, recurrencia:'RRULE:...'|null }
  function construirEvento(ev, id) {
    const cuerpo = {
      summary: ev.titulo,
      reminders: { useDefault: false, overrides: ev.aviso >= 0 ? [{ method: "popup", minutes: ev.aviso }] : [] }
    };
    if (id) cuerpo.id = id;
    if (!ev.hora) {
      cuerpo.start = { date: ev.fecha };
      cuerpo.end = { date: sumarDias(ev.fecha, 1) };
    } else {
      cuerpo.start = { dateTime: ev.fecha + "T" + ev.hora + ":00", timeZone: TZ() };
      cuerpo.end = { dateTime: sumarMinutos(ev.fecha, ev.hora, ev.duracion), timeZone: TZ() };
    }
    if (ev.recurrencia) cuerpo.recurrence = [ev.recurrencia];
    return cuerpo;
  }

  function nuevoId() {
    const b = new Uint8Array(13);
    (root.crypto || require("crypto").webcrypto).getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(""); // 26 caracteres hex (válidos para Google)
  }

  // Busca un evento con el mismo título a la misma hora/día (evita duplicados accidentales)
  async function buscarDuplicado(calId, ev) {
    const desde = sumarDias(ev.fecha, -1) + "T00:00:00Z";
    const hasta = sumarDias(ev.fecha, 2) + "T00:00:00Z";
    const d = await llamar("/calendars/" + encodeURIComponent(calId) + "/events?singleEvents=true&maxResults=50&q=" + encodeURIComponent(ev.titulo) +
      "&timeMin=" + encodeURIComponent(desde) + "&timeMax=" + encodeURIComponent(hasta));
    const t = ev.titulo.trim().toLowerCase();
    return (d.items || []).find((e) => {
      if (e.status === "cancelled" || (e.summary || "").trim().toLowerCase() !== t) return false;
      if (!ev.hora) return e.start && e.start.date === ev.fecha;
      return e.start && e.start.dateTime && e.start.dateTime.indexOf(ev.fecha + "T" + ev.hora) === 0;
    }) || null;
  }

  async function crearEvento(calId, ev, id) {
    const ruta = "/calendars/" + encodeURIComponent(calId) + "/events";
    try {
      return await llamar(ruta, { method: "POST", body: JSON.stringify(construirEvento(ev, id)) });
    } catch (e) {
      if (e.codigo === "DUPLICADO") return llamar(ruta + "/" + id); // reintento con el mismo id: ya se había creado
      throw e;
    }
  }

  // Comprueba que el evento existe de verdad en Google y devuelve sus datos
  async function verificar(calId, id, titulo) {
    const e = await llamar("/calendars/" + encodeURIComponent(calId) + "/events/" + id);
    if (!e || e.status === "cancelled" || (e.summary || "") !== titulo) throw error("VERIF", "Google no confirma que el evento se haya guardado correctamente.");
    return e;
  }

  async function proximas(calId, max) {
    const d = await llamar("/calendars/" + encodeURIComponent(calId) + "/events?singleEvents=true&orderBy=startTime&maxResults=" + (max || 15) +
      "&timeMin=" + encodeURIComponent(new Date().toISOString()));
    return d.items || [];
  }

  // ---------- Google Tasks (solo guarda el día, no la hora) ----------
  const ruta = "/lists/@default/tasks";
  async function buscarTareaDuplicada(ev) {
    const d = await llamar(ruta + "?showCompleted=false&maxResults=100", {}, TAREAS);
    const t = ev.titulo.trim().toLowerCase();
    return (d.items || []).find((x) => (x.title || "").trim().toLowerCase() === t && x.due && x.due.indexOf(ev.fecha) === 0) || null;
  }
  async function crearTarea(ev) {
    return llamar(ruta, { method: "POST", body: JSON.stringify({ title: ev.titulo, due: ev.fecha + "T00:00:00.000Z" }) }, TAREAS);
  }
  async function verificarTarea(id, titulo) {
    const t = await llamar(ruta + "/" + id, {}, TAREAS);
    if (!t || t.deleted || (t.title || "") !== titulo) throw error("VERIF", "Google no confirma que la tarea se haya guardado correctamente.");
    return t;
  }
  async function tareasPendientes(max) {
    const d = await llamar(ruta + "?showCompleted=false&maxResults=" + (max || 20), {}, TAREAS);
    return (d.items || []).filter((x) => x.title).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  }

  const recordarCuenta = (email) => LS.set("ag_email", email);
  const cuentaGuardada = () => LS.get("ag_email");

  const API_PUBLICA = {
    recordarCuenta, cuentaGuardada, sinRenovacion,
    buscarTareaDuplicada, crearTarea, verificarTarea, tareasPendientes,
    configurado, sesionValida, habiaConectado, asegurarToken, cerrarSesion,
    listarCalendarios, construirEvento, nuevoId, buscarDuplicado, crearEvento, verificar, proximas
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API_PUBLICA;
  else root.Calendario = API_PUBLICA;
})(typeof window !== "undefined" ? window : globalThis);
