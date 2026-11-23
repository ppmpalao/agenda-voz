globalThis.CONFIG = { CLIENT_ID: "x.apps.googleusercontent.com", ZONA: "Europe/Madrid", WORKER_URL: "https://w.workers.dev/" };
const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const gis = []; let refrescoValido = true;
globalThis.google = { accounts: { oauth2: { initCodeClient: (o) => ({ requestCode: () => { gis.push({ select: o.select_account, hint: o.hint }); o.callback({ code: "COD" }); } }) } } };
const llamadas = [];
globalThis.fetch = async (url, o) => { llamadas.push(url); const b = JSON.parse(o.body); const r = (s, d) => ({ ok: s < 300, status: s, json: async () => d });
  if (url.endsWith("/canjear")) return r(200, { access_token: "A1", expires_in: 3600, refresh_token: "R1" });
  if (url.endsWith("/renovar")) return refrescoValido ? r(200, { access_token: "A2", expires_in: 3600 }) : r(400, { error: "invalid_grant" });
  return r(404, {}); };
const C = require("../calendario.js");
const ahoraReal = Date.now; let salto = 0; Date.now = () => ahoraReal() + salto;
const ok = (c, m) => { console.log(c ? "ok  -" : "FALLA:", m); if (!c) process.exitCode = 1; };
(async () => {
  ok((await C.asegurarToken()) === "A1" && store.ag_refresh === "R1", "primer acceso: guarda la llave de renovación");
  salto = 2 * 3600 * 1000; store.ag_email = "palao@gmail.com";           // pasan 2 horas: la sesión caduca
  const antes = gis.length;
  ok((await C.asegurarToken({ silencioso: true })) === "A2" && gis.length === antes, "reconecta sola, sin abrir ventana de Google");
  ok(llamadas[llamadas.length - 1].endsWith("/renovar"), "usa el servidor para renovar");
  await C.asegurarToken({ cambiarCuenta: true });
  ok(gis[gis.length - 1].select === true && gis[gis.length - 1].hint === undefined, "cambiar de cuenta muestra el selector");
  salto += 2 * 3600 * 1000; refrescoValido = false;
  try { await C.asegurarToken({ silencioso: true }); ok(false, "debe fallar"); } catch (e) { ok(e.codigo === "CADUCADA" && !store.ag_refresh, "llave caducada: se borra y se avisa"); }
  try { await C.asegurarToken({ silencioso: true }); ok(false, "debe fallar"); } catch (e) { ok(e.codigo === "INTERACCION", "después pide un toque en vez de abrir ventana sola"); }
  await C.asegurarToken(); ok(store.ag_refresh === "R1", "con un toque vuelve a conectar y guarda otra llave");
})();
