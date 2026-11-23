const { interpretar } = require("../interprete.js");
const AHORA = { y: 2026, m: 11, d: 20, h: 13, mi: 45 }; // viernes 20/11/2026 13:45
const C = [
 ["Mañana a las diez tengo cita con el médico", { titulo: "Cita con el médico", fecha: "2026-11-21", hora: "10:00" }],
 ["El próximo viernes a las cinco, reunión con Pedro", { titulo: "Reunión con Pedro", fecha: "2026-11-27", hora: "17:00" }],
 ["Recuérdame llamar al fontanero el lunes a las nueve", { titulo: "Llamar al fontanero", fecha: "2026-11-23", hora: "09:00" }],
 ["Todos los miércoles a las ocho, revisar la instalación solar", { titulo: "Revisar la instalación solar", fecha: "2026-11-25", hora: "08:00", recurrencia: "RRULE:FREQ=WEEKLY;BYDAY=WE" }],
 ["El día 20 de diciembre tengo que llevar el coche al taller", { titulo: "Llevar el coche al taller", fecha: "2026-12-20", hora: null, todoElDia: true }],
 ["El martes tengo dentista a las seis, avísame una hora antes", { titulo: "Dentista", fecha: "2026-11-24", hora: "18:00", aviso: 60 }],
 ["Mañana a las cinco tengo que ir al dentista", { titulo: "Ir al dentista", fecha: "2026-11-21", hora: "17:00" }],
 ["el viernes a las 10 revisar el coche", { titulo: "Revisar el coche", fecha: "2026-11-27", hora: "10:00" }],
 ["pasado mañana a las 17:30 reunión con Ana durante dos horas", { titulo: "Reunión con Ana", fecha: "2026-11-22", hora: "17:30", duracion: 120 }],
 ["mañana a las nueve y media de la mañana desayuno con Luis", { titulo: "Desayuno con Luis", fecha: "2026-11-21", hora: "09:30" }],
 ["el 5 de enero a las 8 de la tarde cena con los vecinos", { titulo: "Cena con los vecinos", fecha: "2027-01-05", hora: "20:00" }],
 ["llamar al banco", { fecha: null, falta: ["fecha"] }],
 ["dentro de tres días a las 12 cita con el notario", { titulo: "Cita con el notario", fecha: "2026-11-23", hora: "12:00" }],
 ["todos los lunes y jueves a las 7 de la tarde gimnasio", { titulo: "Gimnasio", fecha: "2026-11-23", hora: "19:00", recurrencia: "RRULE:FREQ=WEEKLY;BYDAY=MO,TH" }],
 ["mañana de 4 a 6 reunión de obra", { titulo: "Reunión de obra", fecha: "2026-11-21", hora: "16:00", duracion: 120 }],
 ["el sábado a las siete menos cuarto salir al campo", { titulo: "Salir al campo", fecha: "2026-11-21", hora: "18:45" }],
 ["todos los días a las 9 regar las plantas", { titulo: "Regar las plantas", fecha: "2026-11-21", hora: "09:00", recurrencia: "RRULE:FREQ=DAILY" }],
 ["el 20 a las 6 de la tarde revisión", { titulo: "Revisión", fecha: "2026-11-20", hora: "18:00" }],
 ["mañana a las 8 de la mañana revisión del coche sin aviso", { titulo: "Revisión del coche", fecha: "2026-11-21", hora: "08:00", aviso: -1 }],
 ["la semana que viene comprar pintura", { fecha: null, falta: ["fecha"] }],
 ["el 31 de febrero cita", { fecha: null, falta: ["fecha"] }],
 ["el lunes de la semana que viene a las 11 de la mañana comité", { titulo: "Comité", fecha: "2026-11-23", hora: "11:00" }],
 ["Recuérdame pagar el seguro el 15 de diciembre", { titulo: "Pagar el seguro", fecha: "2026-12-15", todoElDia: true }],
 ["cada dos semanas el martes a las 9 de la mañana reunión de equipo", { titulo: "Reunión de equipo", fecha: "2026-11-24", hora: "09:00", recurrencia: "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU" }],
 ["el día 5 de cada mes a las 10 de la mañana pagar la cuota", { titulo: "Pagar la cuota", fecha: "2026-12-05", hora: "10:00", recurrencia: "RRULE:FREQ=MONTHLY;BYMONTHDAY=5" }],
 ["esta tarde a las 6 recoger el paquete", { titulo: "Recoger el paquete", fecha: "2026-11-20", hora: "18:00" }],
 ["el 3/12 a las 16:00 revisión de la caldera, avísame un día antes", { titulo: "Revisión de la caldera", fecha: "2026-12-03", hora: "16:00", aviso: 1440 }],
 ["mañana al mediodía comida con Pedro", { titulo: "Comida con Pedro", fecha: "2026-11-21", hora: "12:00" }],
 ["el lunes a las 9 y media llamar al electricista, con un aviso de 15 minutos antes", { titulo: "Llamar al electricista", fecha: "2026-11-23", hora: "09:30", aviso: 15 }],
["mañana a las 5 de la mañana revisar la placa solar", { titulo: "Revisar la placa solar", fecha: "2026-11-21", hora: "05:00" }],
 ["mañana a las 5 tarde reunión", { titulo: "Reunión", fecha: "2026-11-21", hora: "17:00" }],
 ["mañana a las 8 de la tarde cena", { titulo: "Cena", fecha: "2026-11-21", hora: "20:00" }],
];
let fallos = 0;
for (const [frase, esp] of C) {
  const r = interpretar(frase, AHORA);
  const malos = Object.entries(esp).filter(([k, v]) => JSON.stringify(r[k]) !== JSON.stringify(v));
  if (malos.length) {
    fallos++;
    console.log("FALLA:", frase);
    malos.forEach(([k, v]) => console.log("   " + k + ": esperado " + JSON.stringify(v) + " / obtenido " + JSON.stringify(r[k])));
    console.log("   dudas:", JSON.stringify(r.dudas));
  }
}
console.log(fallos ? fallos + " de " + C.length + " fallan" : "TODAS OK (" + C.length + ")");
