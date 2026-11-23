globalThis.CONFIG = { CLIENT_ID: "x.apps.googleusercontent.com", ZONA: "Europe/Madrid" };
globalThis.google = { accounts: { oauth2: { initTokenClient: (o) => ({ requestAccessToken: () => o.callback({ access_token: "tok", expires_in: 3600 }) }) } } };
const C = require("../calendario.js");
const ok = (c, m) => { if (!c) { console.log("FALLA:", m); process.exitCode = 1; } else console.log("ok  -", m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? "" : "  obtenido " + JSON.stringify(a)));

// 1. Cuerpos del evento
eq(C.construirEvento({ titulo: "Ir al dentista", fecha: "2026-11-21", hora: "17:00", duracion: 60, aviso: 30, recurrencia: null }, "abc").start,
   { dateTime: "2026-11-21T17:00:00", timeZone: "Europe/Madrid" }, "inicio con zona Europe/Madrid");
eq(C.construirEvento({ titulo: "t", fecha: "2026-11-21", hora: "23:30", duracion: 90, aviso: 10 }).end.dateTime, "2026-11-22T01:00:00", "fin cruzando medianoche");
const t = C.construirEvento({ titulo: "t", fecha: "2026-12-31", hora: "", duracion: 60, aviso: 900 });
eq([t.start, t.end], [{ date: "2026-12-31" }, { date: "2027-01-01" }], "todo el día: fin = día siguiente");
eq(C.construirEvento({ titulo: "t", fecha: "2026-11-25", hora: "08:00", duracion: 60, aviso: 30, recurrencia: "RRULE:FREQ=WEEKLY;BYDAY=WE" }).recurrence, ["RRULE:FREQ=WEEKLY;BYDAY=WE"], "recurrencia");
eq(C.construirEvento({ titulo: "t", fecha: "2026-11-21", hora: "10:00", duracion: 60, aviso: -1 }).reminders, { useDefault: false, overrides: [] }, "sin aviso");
eq(C.construirEvento({ titulo: "t", fecha: "2026-11-21", hora: "10:00", duracion: 60, aviso: 60 }).reminders.overrides, [{ method: "popup", minutes: 60 }], "aviso 1 hora");
ok(/^[0-9a-f]{26}$/.test(C.nuevoId()), "id de evento válido (26 hex)");

// 2. Flujo con Google simulado
const llamadas = [];
let modo = "normal";
globalThis.fetch = async (url, o) => {
  o = o || {}; llamadas.push((o.method || "GET") + " " + url);
  const res = (s, b) => ({ ok: s < 300, status: s, json: async () => b });
  if (url.includes("tasks.googleapis.com")) {
    if (o.method === "POST") { const b = JSON.parse(o.body); return res(200, { id: "t1", title: b.title, due: b.due, status: "needsAction" }); }
    if (url.includes("/tasks/t1")) return res(200, { id: "t1", title: "Llamar al fontanero", due: "2026-11-23T00:00:00.000Z" });
    return res(200, { items: [{ id: "t1", title: "Llamar al fontanero", due: "2026-11-23T00:00:00.000Z" }, { id: "t2", title: "Sin fecha" }] });
  }
  if (url.includes("/calendarList")) return res(200, { items: [{ id: "a@x.com", summary: "Personal", primary: true }] });
  if (o.method === "POST") { if (modo === "409") return res(409, { error: { message: "exists" } }); const b = JSON.parse(o.body); return res(200, Object.assign({ status: "confirmed" }, b)); }
  if (url.includes("/events/")) return res(200, { id: "abc", status: "confirmed", summary: "Ir al dentista", htmlLink: "https://calendar/x" });
  if (url.includes("/events?")) return res(200, { items: [{ status: "confirmed", summary: "Ir al dentista", start: { dateTime: "2026-11-21T17:00:00+01:00" } }] });
  return res(404, {});
};
(async () => {
  eq(await C.asegurarToken(), "tok", "inicio de sesión (simulado)");
  eq((await C.listarCalendarios())[0].nombre, "Personal", "lista de calendarios");
  const ev = { titulo: "Ir al dentista", fecha: "2026-11-21", hora: "17:00", duracion: 60, aviso: 30 };
  ok(!!(await C.buscarDuplicado("a@x.com", ev)), "detecta duplicado a la misma hora");
  ok(!(await C.buscarDuplicado("a@x.com", Object.assign({}, ev, { hora: "18:00" }))), "no marca duplicado a otra hora");
  const creado = await C.crearEvento("a@x.com", ev, "abc");
  eq(creado.summary, "Ir al dentista", "crea evento");
  eq((await C.verificar("a@x.com", "abc", "Ir al dentista")).status, "confirmed", "verifica que existe");
  modo = "409";
  eq((await C.crearEvento("a@x.com", ev, "abc")).id, "abc", "reintento con 409 no duplica");
  const tv = { titulo: "Llamar al fontanero", fecha: "2026-11-23" };
  ok(!!(await C.buscarTareaDuplicada(tv)), "detecta tarea duplicada (mismo título y día)");
  ok(!(await C.buscarTareaDuplicada({ titulo: "Llamar al fontanero", fecha: "2026-11-24" })), "no marca tarea duplicada otro día");
  const tarea = await C.crearTarea(tv);
  eq([tarea.title, tarea.due], ["Llamar al fontanero", "2026-11-23T00:00:00.000Z"], "crea tarea solo con día");
  eq((await C.verificarTarea("t1", "Llamar al fontanero")).id, "t1", "verifica la tarea");
  eq((await C.tareasPendientes()).map((x) => x.id), ["t1", "t2"], "lista tareas: por fecha y sin fecha al final");
  try { await C.verificarTarea("t1", "Otro"); ok(false, "verificarTarea debe fallar"); } catch (e) { eq(e.codigo, "VERIF", "verificación de tarea falla si no coincide"); }
  try { await C.verificar("a@x.com", "abc", "Otro título"); ok(false, "verificación debe fallar si no coincide"); } catch (e) { eq(e.codigo, "VERIF", "verificación falla si el título no coincide"); }
})();

// 3. Recordar cuenta y reconexión
(async () => {
  const store = {};
  globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  delete require.cache[require.resolve("../calendario.js")];
  const llamadasGIS = [];
  globalThis.google = { accounts: { oauth2: { initTokenClient: (o) => ({ requestAccessToken: (x) => { llamadasGIS.push({ hint: o.hint, prompt: x.prompt }); o.callback({ access_token: "t2", expires_in: 3600 }); } }) } } };
  const C2 = require("../calendario.js");
  C2.recordarCuenta("palao@gmail.com");
  await C2.asegurarToken({ silencioso: true });
  eq(llamadasGIS[0], { hint: "palao@gmail.com", prompt: "none" }, "reconexión silenciosa con la cuenta recordada");
  await C2.asegurarToken({ cambiarCuenta: true });
  eq(llamadasGIS[1], { hint: undefined, prompt: "select_account" }, "cambiar de cuenta: selector sin cuenta fija");
  eq(C2.cuentaGuardada(), "palao@gmail.com", "la cuenta queda guardada");
})();
