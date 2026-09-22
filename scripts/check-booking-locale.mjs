/**
 * ¿El calendario de reservas habla el idioma de la página, y marca la hora de la clínica?
 *
 * Dos bugs motivan este script:
 *
 *  1. `booking.js` elegía el locale con un ternario binario
 *     (`LANG === "en" ? "en-GB" : "es-ES"`), así que fr/de/ar/ru/uk pintaban los
 *     meses y los días en español.
 *  2. Las horas se formateaban en la zona del dispositivo, no en la de Benidorm:
 *     un hueco de las 19:30 lo veía como 20:30 alguien en Kiev.
 *
 * Ninguno lo veía un verificador de los que había, porque los tres leen el HTML
 * generado y este texto no está ahí: lo escribe el JS en el navegador, y la
 * etiqueta del día solo aparece DESPUÉS de hacer clic. Por eso esto abre un
 * navegador de verdad, hace clic de verdad, y repite todo con el reloj del
 * navegador puesto en Kiev.
 *
 * Uso:
 *   npm run verify:booking                             # construye y comprueba
 *   node scripts/check-booking-locale.mjs              # sirve el _site que haya
 *   node scripts/check-booking-locale.mjs https://anylopez.com
 *
 * Contra un sitio con el bug vivo debe SALIR EN ROJO. Si da verde sobre algo que
 * sabemos roto, el probe no vale: arréglalo antes de fiarte de su verde.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { writeFileSync, rmSync } from "node:fs";

const require = createRequire(import.meta.url);
const LANGS = require("../src/_data/langs.json");

const TZ_CLINICA = "Europe/Madrid";

// Una lista de idiomas truncada haría que el script no comprobara nada y
// saliera con 0: el verde por vacío que este gate existe para evitar.
if (LANGS.length !== 7) {
  throw new Error(`langs.json trae ${LANGS.length} idiomas y se esperaban 7. Actualiza este gate a conciencia.`);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
};

function serve(root) {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p.endsWith("/")) p += "index.html";
      const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ""));
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const ARABIC_INDIC = /[٠-٩۰-۹]/;

// Lo que el navegador DEBERÍA pintar, calculado aquí con el bcp47 del idioma.
function esperado(bcp47, date, opts) {
  return capFirst(
    new Intl.DateTimeFormat(bcp47, { ...opts, numberingSystem: "latn", timeZone: TZ_CLINICA }).format(date)
  );
}

const MES_OPTS = { month: "long", year: "numeric" };
const DIA_OPTS = { weekday: "long", day: "numeric", month: "long" };

async function comprobarIdioma(page, base, lang) {
  const url = base + (lang.prefix || "") + "/";
  const out = { code: lang.code, url, fallos: [], datos: {} };
  try {
    await medir(page, url, lang, out);
  } catch (err) {
    // Una excepción aquí abortaba el proceso entero y dejaba el informe sin
    // escribir; un idioma que revienta es un dato, no el final de la pasada.
    out.fallos.push(`excepción durante la comprobación: ${err.message || err}`);
  }
  return out;
}

async function medir(page, url, lang, out) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

  // El bloque es lazy: no existe hasta que entra en viewport.
  await page.locator("#booking").scrollIntoViewIfNeeded({ timeout: 20000 });

  const monthLbl = page.locator('[data-bind="month-label"]');
  try {
    await monthLbl.filter({ hasText: /\S/ }).waitFor({ timeout: 30000 });
  } catch {
    out.fallos.push("el calendario no llegó a pintar el mes (¿API de disponibilidad caída?)");
    return;
  }

  // El mes que el calendario muestra al abrir es el de hoy EN BENIDORM: cerca de
  // medianoche, un navegador en otra zona podría estar ya en el día siguiente.
  const [{ value: y }, , { value: m }] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_CLINICA, year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const mesCursor = new Date(Number(y), Number(m) - 1, 1);

  const mesVisto = (await monthLbl.textContent()).trim();
  const mesOk = esperado(lang.bcp47, mesCursor, MES_OPTS);
  const mesEs = esperado("es-ES", mesCursor, MES_OPTS);
  out.datos.mes = mesVisto;

  if (mesVisto !== mesOk) out.fallos.push(`mes: visto "${mesVisto}" · esperado "${mesOk}"`);
  if (lang.code !== "es" && mesVisto === mesEs) out.fallos.push(`mes EN ESPAÑOL: "${mesVisto}"`);

  // La etiqueta del día solo se puebla tras el clic: ahí es donde se vio el bug.
  const dia = page.locator(".booking-day.has-slots").first();
  if ((await dia.count()) === 0) {
    out.fallos.push("ningún día con hueco en el mes visible: no se pudo probar el clic");
    return;
  }
  const numDia = Number((await dia.textContent()).trim());
  await dia.click();

  const fechaClic = new Date(Date.UTC(mesCursor.getFullYear(), mesCursor.getMonth(), numDia, 12));
  const diaVisto = (await page.locator('[data-bind="day-label"]').textContent()).trim();
  const diaOk = esperado(lang.bcp47, fechaClic, DIA_OPTS);
  const diaEs = esperado("es-ES", fechaClic, DIA_OPTS);
  out.datos.dia = diaVisto;

  if (diaVisto !== diaOk) out.fallos.push(`día: visto "${diaVisto}" · esperado "${diaOk}"`);
  if (lang.code !== "es" && diaVisto === diaEs) out.fallos.push(`día EN ESPAÑOL: "${diaVisto}"`);

  const slot = page.locator(".booking-slot").first();
  if ((await slot.count()) === 0) {
    // Sin esto, media pasada (hora, desbordes, modal) se saltaba EN SILENCIO y
    // el idioma salía "ok" igual. Un día con `has-slots` tiene huecos por
    // construcción: si no se pintan, es que algo se rompió.
    out.fallos.push("el día estaba marcado con hueco pero no se pintó ningún slot");
    return;
  }

  const horaVista = (await slot.textContent()).trim();
  out.datos.hora = horaVista;
  // Reloj de 24 h en los 7: «01:30 م» para una cita de las 13:30 se lee como la
  // 1:30 de la madrugada si se pasa por alto el marcador.
  if (!/^\d{2}:\d{2}$/.test(horaVista)) out.fallos.push(`hora fuera del formato 24 h HH:MM: "${horaVista}"`);

  const desbordes = await page.evaluate(() => {
    const malos = [];
    for (const el of document.querySelectorAll(".booking-slot, .booking-slots, .booking-day, .booking-calendar")) {
      if (el.scrollWidth > el.clientWidth + 1) malos.push(`${el.className}: ${el.scrollWidth}>${el.clientWidth}`);
    }
    return malos;
  });
  for (const d of desbordes) out.fallos.push(`desbordamiento horizontal — ${d}`);

  // Tercer sitio donde aparece la fecha, y el último que ve la paciente antes de
  // confirmar: el título del modal. Solo existe tras clicar un hueco.
  await slot.click();
  const titulo = (await page.locator('[data-bind="modal-title"]').textContent()).trim();
  out.datos.modal = titulo;
  const tituloEs = esperado("es-ES", fechaClic, { ...DIA_OPTS, hour: "2-digit", minute: "2-digit", hour12: false });
  if (lang.code !== "es" && titulo === tituloEs) out.fallos.push(`título del modal EN ESPAÑOL: "${titulo}"`);
  // Contra la etiqueta del día ya validada, no contra el nombre del mes suelto:
  // ru y uk declinan («сентября», no «сентябрь») y un `includes` del nominativo
  // marcaría en rojo un título correcto.
  if (!titulo.includes(diaVisto)) {
    out.fallos.push(`título del modal incoherente con el día "${diaVisto}": "${titulo}"`);
  }

  for (const [campo, valor] of Object.entries(out.datos)) {
    if (ARABIC_INDIC.test(valor)) out.fallos.push(`${campo} con dígitos árabigo-índicos: "${valor}"`);
  }
}

/**
 * Los placeholders del mensaje de WhatsApp, en los 7 diccionarios.
 *
 * La paridad estructural solo exige que la clave exista; no mira dentro. Un
 * `{tratment}` mal escrito se interpolaría a cadena vacía sin que chistara
 * nadie, y la paciente enviaría un mensaje con un hueco en medio.
 */
const WA_PLACEHOLDERS = ["date", "time", "treatment", "name", "notes"];

function comprobarPlantillasWa() {
  const fallos = [];
  for (const lang of LANGS) {
    const b = require(`../src/_data/i18n/${lang.code}/partials.json`).booking;
    const tpl = b?.waTemplate;
    const notes = b?.waNotes;

    if (typeof tpl !== "string") {
      fallos.push(`[${lang.code}] falta booking.waTemplate`);
    } else {
      for (const p of WA_PLACEHOLDERS) {
        const n = (tpl.match(new RegExp(`\\{${p}\\}`, "g")) || []).length;
        if (n !== 1) fallos.push(`[${lang.code}] waTemplate: {${p}} aparece ${n} vez/veces, debe ser 1`);
      }
      const desconocidos = [...tpl.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => !WA_PLACEHOLDERS.includes(k));
      for (const k of desconocidos) fallos.push(`[${lang.code}] waTemplate: placeholder desconocido {${k}}`);
    }

    if (typeof notes !== "string") {
      fallos.push(`[${lang.code}] falta booking.waNotes`);
    } else {
      if ((notes.match(/\{notes\}/g) || []).length !== 1) fallos.push(`[${lang.code}] waNotes: {notes} debe aparecer 1 vez`);
      if (!notes.startsWith(" ")) fallos.push(`[${lang.code}] waNotes debe empezar por espacio: se concatena tras un punto`);
    }

    // Interpolado de verdad, en los dos casos que existen en el formulario.
    if (typeof tpl === "string" && typeof notes === "string") {
      const fill = (t, v) => String(t).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
      const conNotas = fill(tpl, { date: "X", time: "Y", treatment: "Z", name: "N", notes: fill(notes, { notes: "hola" }) });
      const sinNotas = fill(tpl, { date: "X", time: "Y", treatment: "Z", name: "N", notes: "" });
      for (const [caso, txt] of [["con notas", conNotas], ["sin notas", sinNotas]]) {
        if (/\s{2,}/.test(txt)) fallos.push(`[${lang.code}] ${caso}: doble espacio → "${txt}"`);
        if (/\{\w+\}/.test(txt)) fallos.push(`[${lang.code}] ${caso}: quedó un placeholder sin sustituir`);
      }
    }
  }
  return fallos;
}

const DESTINO = fileURLToPath(new URL("../booking-locale-report.txt", import.meta.url));
// Borrar antes de nada: si el script peta, un informe viejo se lee igual de bien
// que uno nuevo y no hay forma de distinguirlos.
rmSync(DESTINO, { force: true });

const fallosWa = comprobarPlantillasWa();

/**
 * Dos rondas.
 *
 * La segunda pone el reloj del navegador en Kiev y la ventana en 360 px: es la
 * única forma de ver que la hora sigue siendo la de Benidorm y que el árabe no
 * desborda en móvil, que es donde el ancho aprieta.
 */
const RONDAS = [
  { etiqueta: "1400 px · reloj del sistema", width: 1400, height: 1000, timezoneId: undefined },
  { etiqueta: "360 px · reloj en Europe/Kyiv", width: 360, height: 800, timezoneId: "Europe/Kyiv" },
];

const arg = process.argv[2];
let base = arg;
let server = null;
if (!base) {
  const s = await serve(fileURLToPath(new URL("../_site", import.meta.url)));
  server = s.server;
  base = `http://127.0.0.1:${s.port}`;
}

const browser = await chromium.launch();
const porRonda = [];
for (const ronda of RONDAS) {
  const ctx = await browser.newContext({
    viewport: { width: ronda.width, height: ronda.height },
    timezoneId: ronda.timezoneId,
  });
  const page = await ctx.newPage();
  const resultados = [];
  for (const lang of LANGS) resultados.push(await comprobarIdioma(page, base, lang));
  await ctx.close();
  porRonda.push({ ronda, resultados });
}
await browser.close();
if (server) server.close();

// La cita es presencial en Benidorm: la hora no puede depender de dónde esté la
// paciente. Si las dos rondas discrepan, falta `timeZone` en algún formateo.
const fallosTz = [];
for (let i = 0; i < LANGS.length; i++) {
  const [a, b] = porRonda.map((r) => r.resultados[i]);
  for (const campo of ["mes", "dia", "hora", "modal"]) {
    if (a.datos[campo] && b.datos[campo] && a.datos[campo] !== b.datos[campo]) {
      fallosTz.push(`[${a.code}] ${campo} cambia con la zona del visitante: "${a.datos[campo]}" vs "${b.datos[campo]}" (Kiev)`);
    }
  }
}

const lineas = [`Base: ${base}`, ""];
for (const { ronda, resultados } of porRonda) {
  lineas.push(`### ${ronda.etiqueta}`);
  for (const r of resultados) {
    lineas.push(`[${r.code}] ${r.fallos.length ? "FALLA" : "ok"}`);
    lineas.push(`   mes:   ${r.datos.mes ?? "—"}`);
    lineas.push(`   día:   ${r.datos.dia ?? "—"}`);
    lineas.push(`   hora:  ${r.datos.hora ?? "—"}`);
    lineas.push(`   modal: ${r.datos.modal ?? "—"}`);
    for (const f of r.fallos) lineas.push(`   ✗ ${f}`);
  }
  lineas.push("");
}

lineas.push("--- la hora es la de la clínica, no la del visitante ---");
if (fallosTz.length) for (const f of fallosTz) lineas.push(`   ✗ ${f}`);
else lineas.push("   ok — mes, día, hora y modal idénticos con el reloj en Kiev");
lineas.push("");

lineas.push("--- plantilla del mensaje de WhatsApp ---");
if (fallosWa.length) for (const f of fallosWa) lineas.push(`   ✗ ${f}`);
else lineas.push("   ok — los 7 idiomas interpolan sin huecos ni dobles espacios, con y sin notas");
lineas.push("");

const fallosNav = porRonda.reduce((n, r) => n + r.resultados.reduce((m, x) => m + x.fallos.length, 0), 0);
const total = fallosNav + fallosTz.length + fallosWa.length;
lineas.push(
  total
    ? `${total} fallo(s)`
    : "Los 7 idiomas pintan el calendario en su lengua, con la hora de Benidorm, y el mensaje de WhatsApp está completo."
);

// La consola de Windows es cp1252 y revienta con cirílico y árabe.
writeFileSync(DESTINO, lineas.join("\n"), "utf8");
console.log(`Informe escrito en booking-locale-report.txt (${total} fallo(s))`);

process.exit(total ? 1 : 0);
