/* Intérprete de frases en español para Mi Agenda por Voz.
 * Sin dependencias. Zona horaria: Europe/Madrid.
 * Uso: Interprete.interpretar("mañana a las diez cita con el médico")
 */
(function (root) {
  "use strict";

  const TZ = "Europe/Madrid";
  const NOMBRES_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIA_NUM = { domingo: 0, domingos: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, sabados: 6 };
  const MES_NUM = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  const COD_DIA = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const PALABRAS = {
    cero: 0, un: 1, uno: 1, una: 1, primero: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
    diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
    veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
    veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60
  };

  // ---------- utilidades ----------
  const pad = (n) => String(n).padStart(2, "0");
  const LB = "(?<![a-zñ0-9])";
  const FIN = "(?![a-zñ])";
  const SIMPLES = Object.keys(PALABRAS).sort((a, b) => b.length - a.length).join("|");
  const NUM = "(?:(?:treinta|cuarenta|cincuenta|sesenta)\\s+y\\s+(?:uno|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)(?![a-zñ])|(?:" + SIMPLES + ")(?![a-zñ])|\\d{1,3})";
  const DIAS_RE = "lunes|martes|miercoles|jueves|viernes|sabados?|domingos?";
  const MESES_RE = Object.keys(MES_NUM).join("|");

  const ACENTOS = { "á": "a", "à": "a", "ä": "a", "â": "a", "é": "e", "è": "e", "ë": "e", "ê": "e", "í": "i", "ì": "i", "ï": "i", "î": "i", "ó": "o", "ò": "o", "ö": "o", "ô": "o", "ú": "u", "ù": "u", "ü": "u", "û": "u" };
  function normalizar(s) {
    return s.replace(/./g, (c) => {
      const l = c.toLowerCase();
      if (l.length !== 1) return c;
      return ACENTOS[l] || l;
    });
  }

  function numero(txt) {
    const t = txt.trim().replace(/\s+/g, " ");
    if (/^\d+$/.test(t)) return Number(t);
    if (t.indexOf(" y ") > 0) {
      const [a, b] = t.split(" y ");
      return PALABRAS[a] + PALABRAS[b];
    }
    return PALABRAS[t];
  }

  function dia(y, m, d, n) {
    const t = new Date(Date.UTC(y, m - 1, d + (n || 0)));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() };
  }
  function valida(y, m, d) {
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }
  const iso = (o) => o.y + "-" + pad(o.m) + "-" + pad(o.d);
  const cmp = (a, b) => (a.y - b.y) || (a.m - b.m) || (a.d - b.d);
  const largo = (o) => NOMBRES_DIA[o.wd] + " " + o.d + " de " + NOMBRES_MES[o.m - 1] + " de " + o.y;

  function ahoraMadrid() {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const g = (t) => Number(p.find((x) => x.type === t).value);
    let h = g("hour"); if (h === 24) h = 0;
    return { y: g("year"), m: g("month"), d: g("day"), h: h, mi: g("minute") };
  }

  // ---------- expresiones ----------
  const RE = {
    sinAviso: new RegExp(LB + "sin\\s+(?:aviso|recordatorio|alarma|notificacion)" + FIN),
    laborables: new RegExp(LB + "(?:todos\\s+los\\s+dias\\s+laborables|de\\s+lunes\\s+a\\s+viernes|entre\\s+semana)" + FIN),
    cadaN: new RegExp(LB + "(?:cada|todos\\s+los|todas\\s+las)\\s+(" + NUM + ")\\s+(dias|semanas|meses|a[nñ]os)" + FIN),
    mensualDia: new RegExp(LB + "(?:el\\s+)?(?:dia\\s+)?(" + NUM + ")\\s+de\\s+cada\\s+mes" + FIN),
    diaria: new RegExp(LB + "(?:todos\\s+los\\s+dias|cada\\s+dia|diariamente|a\\s+diario)" + FIN),
    semanalDias: new RegExp(LB + "(?:todos\\s+los|cada|los)\\s+((?:" + DIAS_RE + ")(?:(?:\\s*,\\s*|\\s+y\\s+)(?:" + DIAS_RE + "))*)" + FIN),
    semanal: new RegExp(LB + "(?:todas\\s+las\\s+semanas|cada\\s+semana|semanalmente)" + FIN),
    mensual: new RegExp(LB + "(?:todos\\s+los\\s+meses|cada\\s+mes|mensualmente)" + FIN),
    anual: new RegExp(LB + "(?:todos\\s+los\\s+a[nñ]os|cada\\s+a[nñ]o|anualmente)" + FIN),

    aviso: new RegExp(LB + "(?:(?:avisame|avisarme|recuerdame|recuerdamelo|recordarme|ponme|pon|con)\\s+)?(?:(?:un|el)\\s+)?(?:(?:aviso|recordatorio|alarma)\\s+)?(?:de\\s+)?(?:(" + NUM + ")|(media))\\s+(horas?|minutos?|min|dias?|semanas?)(?:\\s+y\\s+(media))?\\s+(?:antes|de\\s+antelacion)" + FIN),
    vispera: new RegExp(LB + "(?:(?:avisame|recuerdame)\\s+)?(?:el\\s+dia\\s+antes|la\\s+vispera)" + FIN),
    duracion: new RegExp(LB + "(?:durante|dura|durara|durando|con\\s+una\\s+duracion\\s+de|duracion\\s+de)\\s+(?:(" + NUM + ")|(media))\\s+(horas?|minutos?|min)(?:\\s+y\\s+(media))?" + FIN),

    rango: new RegExp(LB + "(?:de|desde)\\s+(?:las\\s+|la\\s+)?(" + NUM + ")(?:[:.h](\\d{2}))?\\s*(?:horas?\\s*)?(?:a|hasta)\\s+(?:las\\s+|la\\s+)?(" + NUM + ")(?:[:.h](\\d{2}))?(?:\\s*horas?)?(?:\\s+(?:de\\s+la|del|por\\s+la|en\\s+la)\\s+(mañana|tarde|noche))?(?![a-zñ0-9])"),
    horaUna: new RegExp(LB + "(?:a|sobre|hacia|para|desde)\\s+(?:las|la)\\s+(" + NUM + ")(?:[:.h](\\d{2}))?(?:\\s*(?:horas?|h)(?![a-zñ]))?(?:\\s+y\\s+(media|cuarto|" + NUM + ")" + FIN + "|\\s+menos\\s+(cuarto|" + NUM + ")" + FIN + ")?(?:\\s+(?:(?:de\\s+la|del|por\\s+la|en\\s+la)\\s+(mañana|tarde|noche|madrugada|mediodia)|(tarde|noche|madrugada))" + FIN + ")?"),
    mediodia: new RegExp(LB + "(?:a|al|hacia)\\s+(?:la\\s+)?(mediodia|medianoche)" + FIN),
    hhmm: /(?<![\d:])(\d{1,2}):(\d{2})(?![\d])(?:\s*h(?:oras?)?(?![a-zñ]))?/,
    estaParte: new RegExp(LB + "esta\\s+(mañana|tarde|noche)" + FIN),
    parte: new RegExp(LB + "(?:por|en|de|durante)\\s+la\\s+(mañana|tarde|noche|madrugada)" + FIN),

    pasadoManana: new RegExp(LB + "pasado\\s+mañana" + FIN),
    hoy: new RegExp(LB + "hoy" + FIN),
    manana: new RegExp(LB + "mañana" + FIN),
    dentroDe: new RegExp(LB + "(?:dentro\\s+de|en)\\s+(" + NUM + ")\\s+(dias?|semanas?|mes|meses)" + FIN),
    fechaMes: new RegExp(LB + "(?:(?:el|este)\\s+)?(?:dia\\s+)?(" + NUM + ")\\s+de\\s+(" + MESES_RE + ")(?:\\s+(?:de|del)\\s+(\\d{4}))?" + FIN),
    fechaNum: /(?<![a-zñ\d\/-])(?:el\s+)?(?:dia\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?![\d])/,
    semanaQueViene: new RegExp(LB + "(?:de\\s+)?(?:la\\s+)?(?:semana\\s+que\\s+viene|proxima\\s+semana|semana\\s+proxima)" + FIN),
    diaSemana: new RegExp(LB + "(?:(?:el|este|ese)\\s+)?(?:(proximo|siguiente|este)\\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?:\\s+(que\\s+viene|proximo|siguiente))?" + FIN),
    diaDelMes: new RegExp(LB + "(?:el\\s+)?dia\\s+(" + NUM + ")(?![a-zñ0-9:])"),
    elNumero: new RegExp(LB + "el\\s+(" + NUM + ")(?![a-zñ0-9:])"),

    inicio: /^(?:por\s+favor\s+|oye\s+|vale\s+|ok\s+)?(?:(?:me\s+)?(?:recuerdame|recuerda|recordadme)(?:\s+que)?|avisame(?:\s+de(?:\s+que)?|\s+que)?|apuntame|apunta|anota|anade|agrega|crea(?:\s+un(?:a)?(?:\s+evento|\s+cita|\s+recordatorio|\s+tarea)?)?|programa|agenda|pon(?:me)?|tengo\s+que|tengo|he\s+de|debo|hay\s+que|tenemos\s+que|tenemos|quiero|necesito|toca)\s+/
  };

  // ---------- hora ----------
  function resolverHora(t, periodoExtra, dudas) {
    let h = t.h;
    const per = t.periodo || periodoExtra || null;
    let ambigua = false;
    const explicito = h >= 13 || h === 0 || t.cero;
    if (per) {
      if (per === "tarde" && h < 12) h += 12;
      else if (per === "noche") {
        if (h >= 6 && h < 12) h += 12;
        else if (h === 12) { h = 0; dudas.push("«12 de la noche» se ha entendido como las 00:00."); }
      }
    } else if (!explicito && h >= 1 && h <= 12) {
      if (h <= 7) h += 12;
      ambigua = true;
    }
    let total = h * 60 + (t.mm || 0) + (t.off || 0);
    if (total < 0) total += 1440;
    if (total >= 1440) total -= 1440;
    return { minutos: total, ambigua: ambigua };
  }
  const hhmm = (min) => pad(Math.floor(min / 60)) + ":" + pad(min % 60);

  // ---------- recurrencia ----------
  function armarRRule(r) {
    let s = "RRULE:FREQ=" + r.freq;
    if (r.interval && r.interval > 1) s += ";INTERVAL=" + r.interval;
    if (r.byday && r.byday.length) s += ";BYDAY=" + r.byday.join(",");
    if (r.bymonthday) s += ";BYMONTHDAY=" + r.bymonthday;
    return s;
  }

  function describirRecurrencia(rrule) {
    if (!rrule) return "";
    const p = {};
    rrule.replace("RRULE:", "").split(";").forEach((kv) => { const [k, v] = kv.split("="); p[k] = v; });
    const n = Number(p.INTERVAL || 1);
    const dias = (p.BYDAY ? p.BYDAY.split(",") : []).map((c) => NOMBRES_DIA[COD_DIA.indexOf(c)]);
    if (p.FREQ === "DAILY") return n > 1 ? "Cada " + n + " días" : "Todos los días";
    if (p.FREQ === "WEEKLY") {
      if (dias.length === 5 && p.BYDAY === "MO,TU,WE,TH,FR") return "De lunes a viernes";
      const lista = dias.length > 1 ? dias.slice(0, -1).join(", ") + " y " + dias[dias.length - 1] : dias[0] || "semana";
      if (n > 1) return "Cada " + n + " semanas" + (dias.length ? " (" + lista + ")" : "");
      return dias.length ? "Todos los " + lista : "Todas las semanas";
    }
    if (p.FREQ === "MONTHLY") return (n > 1 ? "Cada " + n + " meses" : "Cada mes") + (p.BYMONTHDAY ? ", el día " + p.BYMONTHDAY : "");
    if (p.FREQ === "YEARLY") return n > 1 ? "Cada " + n + " años" : "Todos los años";
    return "";
  }

  // ---------- principal ----------
  function interpretar(texto, ahoraOpc) {
    const ahora = ahoraOpc || ahoraMadrid();
    const hoyO = dia(ahora.y, ahora.m, ahora.d);
    const ahoraMin = ahora.h * 60 + ahora.mi;
    const dudas = [];

    let orig = String(texto || "").replace(/\s+/g, " ").trim();
    let norm = normalizar(orig);

    function blank(i, len) {
      const sp = " ".repeat(len);
      orig = orig.slice(0, i) + sp + orig.slice(i + len);
      norm = norm.slice(0, i) + sp + norm.slice(i + len);
    }
    function tomar(re) {
      const m = re.exec(norm);
      if (!m) return null;
      blank(m.index, m[0].length);
      return m;
    }

    let aviso = null;     // minutos antes, -1 = sin aviso
    let duracion = null;  // minutos
    let rec = null;       // recurrencia
    let hora = null;      // {h, mm, off, periodo, cero}
    let rango = null;     // {h2, mm2}
    let periodo = null;
    let fecha = null;     // {y,m,d,wd}
    let fechaForzada = null;
    let diaSemanaPedido = null;

    // 1. Sin aviso
    if (tomar(RE.sinAviso)) aviso = -1;

    // 2. Recurrencia
    let m;
    if ((m = tomar(RE.laborables))) rec = { freq: "WEEKLY", byday: ["MO", "TU", "WE", "TH", "FR"] };
    else if ((m = tomar(RE.cadaN))) {
      const n = numero(m[1]);
      const u = m[2];
      rec = { freq: u === "dias" ? "DAILY" : u === "semanas" ? "WEEKLY" : u === "meses" ? "MONTHLY" : "YEARLY", interval: n };
    } else if ((m = tomar(RE.mensualDia))) {
      const n = numero(m[1]);
      if (n >= 1 && n <= 31) rec = { freq: "MONTHLY", bymonthday: n };
    } else if ((m = tomar(RE.diaria))) rec = { freq: "DAILY" };
    else if ((m = tomar(RE.semanalDias))) {
      const dias = m[1].match(new RegExp(DIAS_RE, "g")).map((d) => COD_DIA[DIA_NUM[d]]);
      rec = { freq: "WEEKLY", byday: Array.from(new Set(dias)) };
    } else if ((m = tomar(RE.semanal))) rec = { freq: "WEEKLY" };
    else if ((m = tomar(RE.mensual))) rec = { freq: "MONTHLY" };
    else if ((m = tomar(RE.anual))) rec = { freq: "YEARLY" };

    // 3. Aviso previo
    if ((m = tomar(RE.aviso))) {
      const base = m[2] ? 0.5 : numero(m[1]);
      const u = m[3];
      const por = /^(hora)/.test(u) ? 60 : /^(dia)/.test(u) ? 1440 : /^(semana)/.test(u) ? 10080 : 1;
      let min = base * por;
      if (m[4]) min += por / 2;
      if (min >= 0 && min <= 40320) aviso = Math.round(min);
    } else if (tomar(RE.vispera)) aviso = 1440;

    // 4. Duración
    if ((m = tomar(RE.duracion))) {
      const base = m[2] ? 0.5 : numero(m[1]);
      const por = /^hora/.test(m[3]) ? 60 : 1;
      let min = base * por;
      if (m[4] && por === 60) min += 30;
      if (min > 0) duracion = Math.round(min);
    }

    // 5. Hora
    if ((m = tomar(RE.rango))) {
      const h1 = numero(m[1]), h2 = numero(m[3]);
      if (h1 <= 24 && h2 <= 24) {
        hora = { h: h1 % 24, mm: m[2] ? Number(m[2]) : 0, periodo: m[5] || null, cero: /^0\d$/.test(m[1]) };
        rango = { h2: h2, mm2: m[4] ? Number(m[4]) : 0 };
      }
    } else if ((m = tomar(RE.horaUna))) {
      const h = numero(m[1]);
      if (h <= 24) {
        let mm = m[2] ? Number(m[2]) : 0, off = 0;
        if (m[3]) {
          if (m[3] === "media") off = 30; else if (m[3] === "cuarto") off = 15; else off = numero(m[3]);
        } else if (m[4]) {
          off = -(m[4] === "cuarto" ? 15 : numero(m[4]));
        }
        hora = { h: h % 24, mm: mm, off: off, periodo: m[5] === "mediodia" ? null : (m[5] || m[6] || null), cero: /^0\d$/.test(m[1]) };
        if (m[5] === "mediodia") { hora.h = 12; hora.mm = 0; hora.periodo = "mediodia"; }
      }
    } else if ((m = tomar(RE.mediodia))) {
      if (m[1] === "mediodia") hora = { h: 12, mm: 0, periodo: "mediodia" };
      else { hora = { h: 0, mm: 0, periodo: "noche", cero: true }; dudas.push("Medianoche = 00:00: comprueba si te refieres al inicio o al final del día."); }
    } else if ((m = tomar(RE.hhmm))) {
      const h = Number(m[1]);
      if (h <= 23 && Number(m[2]) <= 59) hora = { h: h, mm: Number(m[2]), cero: /^0\d$/.test(m[1]) };
    }

    // 6. Parte del día
    if ((m = tomar(RE.estaParte))) { periodo = m[1]; fechaForzada = hoyO; }
    else if ((m = tomar(RE.parte))) periodo = m[1];

    // 7. Fecha
    let horaMin = null;
    let finMin = null;
    let ambigua = false;
    if (hora) {
      const r = resolverHora(hora, periodo, dudas);
      horaMin = r.minutos; ambigua = r.ambigua;
      if (rango) {
        let h2 = rango.h2 % 24;
        let fin = h2 * 60 + rango.mm2;
        if (h2 < 13 && h2 !== 0 && fin <= horaMin) fin += 12 * 60;
        if (fin > horaMin && fin <= 1440) finMin = fin;
        else dudas.push("No he podido entender la hora de fin; he puesto 1 hora de duración.");
      }
    }

    let fechaDesc = null;
    if (fechaForzada) fecha = fechaForzada;
    else if ((m = tomar(RE.pasadoManana))) fecha = dia(hoyO.y, hoyO.m, hoyO.d, 2);
    else if ((m = tomar(RE.hoy))) fecha = hoyO;
    else if ((m = tomar(RE.manana))) fecha = dia(hoyO.y, hoyO.m, hoyO.d, 1);
    else if ((m = tomar(RE.dentroDe))) {
      const n = numero(m[1]);
      const u = m[2];
      if (/^dia/.test(u)) fecha = dia(hoyO.y, hoyO.m, hoyO.d, n);
      else if (/^semana/.test(u)) fecha = dia(hoyO.y, hoyO.m, hoyO.d, 7 * n);
      else {
        let mes = hoyO.m + n, y = hoyO.y;
        while (mes > 12) { mes -= 12; y++; }
        if (valida(y, mes, hoyO.d)) fecha = dia(y, mes, hoyO.d);
        else dudas.push("El día " + hoyO.d + " no existe ese mes; indica la fecha.");
      }
    } else if ((m = tomar(RE.fechaMes))) {
      const d = numero(m[1]), mes = MES_NUM[m[2]];
      let y = m[3] ? Number(m[3]) : hoyO.y;
      if (!valida(y, mes, d)) {
        dudas.push("La fecha " + d + " de " + NOMBRES_MES[mes - 1] + " no existe.");
      } else {
        let f = dia(y, mes, d);
        if (!m[3] && cmp(f, hoyO) < 0) {
          f = dia(y + 1, mes, d);
          dudas.push("Ese día ya ha pasado este año; he puesto " + (y + 1) + ".");
        }
        fecha = f;
      }
    } else if ((m = tomar(RE.fechaNum))) {
      const d = Number(m[1]), mes = Number(m[2]);
      let y = m[3] ? Number(m[3]) : hoyO.y;
      if (m[3] && m[3].length === 2) y += 2000;
      if (mes < 1 || mes > 12 || !valida(y, mes, d)) dudas.push("La fecha indicada no existe.");
      else {
        let f = dia(y, mes, d);
        if (!m[3] && cmp(f, hoyO) < 0) { f = dia(y + 1, mes, d); dudas.push("Ese día ya ha pasado este año; he puesto " + (y + 1) + "."); }
        fecha = f;
      }
    }

    // semana que viene (con o sin día)
    let semanaSig = !!tomar(RE.semanaQueViene);

    if (!fecha) {
      if ((m = tomar(RE.diaSemana))) {
        const wd = DIA_NUM[m[2]];
        diaSemanaPedido = wd;
        const explicitoProx = !!(m[1] && m[1] !== "este") || !!m[3];
        const esteExpl = m[1] === "este";
        if (semanaSig) {
          const lunes = dia(hoyO.y, hoyO.m, hoyO.d, ((8 - hoyO.wd) % 7) || 7);
          fecha = dia(lunes.y, lunes.m, lunes.d, (wd + 6) % 7);
          semanaSig = false;
        } else {
          let diff = (wd - hoyO.wd + 7) % 7;
          if (diff === 0) {
            if (esteExpl) diff = 0;
            else if (explicitoProx) diff = 7;
            else { diff = 7; dudas.push("Hoy ya es " + NOMBRES_DIA[wd] + ": he puesto el de la semana que viene. Si es hoy, cámbialo."); }
          }
          fecha = dia(hoyO.y, hoyO.m, hoyO.d, diff);
        }
      } else if ((m = tomar(RE.diaDelMes)) || (m = tomar(RE.elNumero))) {
        const d = numero(m[1]);
        if (d >= 1 && d <= 31) {
          let y = hoyO.y, mes = hoyO.m, cand = null;
          for (let i = 0; i < 14 && !cand; i++) {
            if (valida(y, mes, d)) { const f = dia(y, mes, d); if (cmp(f, hoyO) >= 0) cand = f; }
            mes++; if (mes > 12) { mes = 1; y++; }
          }
          if (cand) { fecha = cand; dudas.push("He supuesto el mes de " + NOMBRES_MES[cand.m - 1] + ". Compruébalo."); }
        }
      }
    }
    if (semanaSig && !fecha) dudas.push("«La semana que viene» no indica un día concreto.");

    // aviso de coherencia día de la semana / fecha escrita
    if (fecha && diaSemanaPedido === null) {
      const m2 = tomar(RE.diaSemana);
      if (m2) {
        const wd = DIA_NUM[m2[2]];
        if (wd !== fecha.wd) dudas.push("Has dicho " + NOMBRES_DIA[wd] + ", pero esa fecha cae en " + NOMBRES_DIA[fecha.wd] + ".");
      }
    }

    // 8. Recurrencia: completar
    if (rec) {
      if (!fecha) {
        const horaPasada = horaMin !== null && horaMin <= ahoraMin;
        const desde = horaPasada ? 1 : 0;
        if (rec.freq === "DAILY") fecha = dia(hoyO.y, hoyO.m, hoyO.d, desde);
        else if (rec.freq === "WEEKLY" && rec.byday) {
          for (let i = desde; i < 8 && !fecha; i++) {
            const c = dia(hoyO.y, hoyO.m, hoyO.d, i);
            if (rec.byday.indexOf(COD_DIA[c.wd]) >= 0) fecha = c;
          }
        } else if (rec.freq === "MONTHLY" && rec.bymonthday) {
          let y = hoyO.y, mes = hoyO.m;
          for (let i = 0; i < 14 && !fecha; i++) {
            if (valida(y, mes, rec.bymonthday)) {
              const f = dia(y, mes, rec.bymonthday);
              if (cmp(f, hoyO) > 0 || (cmp(f, hoyO) === 0 && !horaPasada)) fecha = f;
            }
            mes++; if (mes > 12) { mes = 1; y++; }
          }
        }
      }
      if (fecha) {
        if (rec.freq === "WEEKLY" && !rec.byday) rec.byday = [COD_DIA[fecha.wd]];
        if (rec.freq === "MONTHLY" && !rec.bymonthday) rec.bymonthday = fecha.d;
      }
    }

    // 9. Comprobaciones de pasado
    const falta = [];
    if (fecha && cmp(fecha, hoyO) < 0) { falta.push("fecha"); dudas.push("Esa fecha ya ha pasado."); fecha = null; }
    if (fecha && cmp(fecha, hoyO) === 0 && horaMin !== null && horaMin <= ahoraMin && !rec) dudas.push("Esa hora ya ha pasado hoy.");
    if (!fecha && falta.indexOf("fecha") < 0) falta.push("fecha");

    if (horaMin !== null && ambigua) dudas.push("Hora asumida: " + hhmm(horaMin) + ". Comprueba si es de la mañana o de la tarde.");
    if (horaMin === null && fecha) dudas.push(rec ? "Sin hora concreta: como se repite, se guardará como evento de todo el día." : "Sin hora concreta: se propone guardarla como tarea del día (sin hora).");

    // 10. Título
    let t = orig;
    function recortar(re) { // recorta en orig/norm con índices alineados
      const mm = re.exec(norm);
      if (mm) { orig = orig.slice(mm[0].length); norm = norm.slice(mm[0].length); return true; }
      return false;
    }
    orig = orig.replace(/\s+/g, (s) => s); // sin cambios; mantiene alineación
    for (let i = 0; i < 8; i++) {
      let cambio = false;
      const lead = /^[\s,.;:¿?¡!\-–]+/.exec(norm);
      if (lead) { orig = orig.slice(lead[0].length); norm = norm.slice(lead[0].length); cambio = true; }
      if (recortar(RE.inicio)) cambio = true;
      const conj = /^(?:y|e|que|para|de|en|a)\s+/.exec(norm);
      if (conj) { orig = orig.slice(conj[0].length); norm = norm.slice(conj[0].length); cambio = true; }
      const cola = /[\s,.;:¿?¡!\-–]+$|\s+(?:y|e|que|para|de|del|en|a|el|la|los|las|con|al)$/.exec(norm);
      if (cola) { orig = orig.slice(0, cola.index); norm = norm.slice(0, cola.index); cambio = true; }
      if (!cambio) break;
    }
    let titulo = orig.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
    titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);
    if (!titulo) falta.push("titulo");

    // 11. Resultado
    const todoElDia = horaMin === null;
    if (aviso === null) aviso = todoElDia ? 900 : 30;
    if (duracion === null) duracion = finMin !== null ? finMin - horaMin : 60;
    if (finMin !== null && duracion === 60 && finMin - horaMin !== 60) duracion = finMin - horaMin;

    return {
      original: String(texto || ""),
      titulo: titulo,
      fecha: fecha ? iso(fecha) : null,
      fechaLarga: fecha ? largo(fecha) : null,
      hora: horaMin !== null ? hhmm(horaMin) : null,
      todoElDia: todoElDia,
      duracion: duracion,
      aviso: aviso,
      recurrencia: rec && fecha ? armarRRule(rec) : null,
      recurrenciaTexto: rec && fecha ? describirRecurrencia(armarRRule(rec)) : "",
      falta: falta,
      dudas: dudas
    };
  }

  const API = { interpretar: interpretar, describirRecurrencia: describirRecurrencia, ahoraMadrid: ahoraMadrid, largo: largo };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.Interprete = API;
})(typeof window !== "undefined" ? window : globalThis);
