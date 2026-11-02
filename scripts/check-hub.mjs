/**
 * ¿La carta del hub (/services/) pinta lo que dice el catálogo, filtra y se abre con teclado?
 *
 * Lo que comprueba, en los 7 idiomas y en un Chromium real sobre `_site`:
 *  - 36 filas, con el nombre del catálogo de ese idioma y el precio "desde" calculado AQUÍ
 *    (aparte de src/_data/preciosDesde.js, para que un fallo en uno no se replique en el otro);
 *  - cada fila enlaza a una página de categoría cuyo modal contiene ese slug, y los 8 encabezados
 *    de grupo enlazan a sus páginas (SEO) y las anclas de los chips existen;
 *  - cada objetivo deja visibles exactamente sus filas, «Todos» restaura las 36, solo un botón
 *    tiene aria-pressed y el recuento anunciado coincide;
 *  - clic o Tab + Enter en una fila abre el modal de ese tratamiento sin salir del hub;
 *  - sin desborde horizontal a 320, 375, 768, 1024 y 1440, y la página a 390×844 no pasa de 8,5
 *    pantallas.
 *
 * Los .svc-trust/.svc-flagship/.svc-final-cta llevan `content-visibility: auto`, y fuera de pantalla
 * miden su `contain-intrinsic-size`, no su altura real: se fuerza `visible` antes de medir.
 * Se bloquean las peticiones que no son del servidor local.
 *
 * Uso: npm run verify:hub   (construye y comprueba)
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const LANGS = require("../src/_data/langs.json");
const OBJETIVOS = require("../src/_data/catalogo/objetivos.json");
const catalogo = (code) => require(`../src/_data/catalogo/${code}.json`);

const SITE = "_site";
const ANCHOS = [320, 375, 768, 1024, 1440];
const MAX_PANTALLAS = 8.5;
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

if (LANGS.length !== 7) throw new Error(`langs.json trae ${LANGS.length} idiomas y se esperaban 7. Actualiza este gate a conciencia.`);

function servir() {
  const server = createServer((req, res) => {
    let ruta = decodeURIComponent(req.url.split("?")[0]);
    if (ruta.endsWith("/")) ruta += "index.html";
    const fichero = join(SITE, normalize(ruta).replace(/^(\.\.[/\\])+/, ""));
    if (!existsSync(fichero)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": MIME[extname(fichero)] || "application/octet-stream" });
    res.end(readFileSync(fichero));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

// Mínimo de los conceptos que no son pack, leído del catálogo español (los precios son iguales
// en todos los idiomas y `concepto` solo es fiable en es).
function precioEsperado(tratamiento) {
  const numerico = (p) => Number(p.precio.replace(/[^\d,.]/g, "").replace(",", "."));
  const sueltos = tratamiento.precios.filter((p) => !p.concepto.toLowerCase().startsWith("pack") && /\d/.test(p.precio));
  if (!sueltos.length) return null;
  return sueltos.reduce((a, b) => (numerico(b) < numerico(a) ? b : a)).precio;
}

const PRECIO_ESPERADO = new Map(catalogo("es").tratamientos.map((t) => [t.slug, precioEsperado(t)]));

const urlDe = (lang, ruta) => `${lang.prefix}${ruta}`;
const ficheroDe = (url) => join(SITE, url, "index.html");

function slugsDelModal(url) {
  const html = readFileSync(ficheroDe(url), "utf8");
  const json = html.match(/<script id="trat-data" type="application\/json">([\s\S]*?)<\/script>/);
  return json ? JSON.parse(json[1]).tratamientos.map((t) => t.slug) : [];
}

const fallos = [];
const fallar = (code, msg) => fallos.push(`[${code}] ${msg}`);

async function nuevaPagina(browser, viewport) {
  const page = await browser.newPage({ viewport });
  await page.route("**/*", (route) => (new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort()));
  return page;
}

async function comprobarContenido(page, lang, base) {
  const code = lang.code;
  const cat = catalogo(code);
  await page.goto(base + urlDe(lang, "/services/"), { waitUntil: "load" });
  await page.locator(".svc-goals:not([hidden])").waitFor({ timeout: 10000 });

  const filas = await page.$$eval(".svc-row", (rows) =>
    rows.map((r) => ({
      slug: r.dataset.slug,
      href: r.getAttribute("href"),
      nombre: r.querySelector(".svc-row-name")?.textContent.trim(),
      precio: r.querySelector(".svc-row-price bdi")?.textContent.trim() ?? null,
    }))
  );
  if (filas.length !== 36) fallar(code, `${filas.length} filas, se esperaban 36`);

  for (const t of cat.tratamientos) {
    const fila = filas.find((f) => f.slug === t.slug);
    if (!fila) { fallar(code, `falta la fila de ${t.slug}`); continue; }
    if (fila.nombre !== t.nombre) fallar(code, `${t.slug}: nombre «${fila.nombre}» ≠ «${t.nombre}»`);
    if (fila.precio !== PRECIO_ESPERADO.get(t.slug)) fallar(code, `${t.slug}: precio «${fila.precio}» ≠ «${PRECIO_ESPERADO.get(t.slug)}»`);

    const destino = urlDe(lang, `/services/${t.categoria}/`);
    if (fila.href !== `${destino}#${t.slug}`) fallar(code, `${t.slug}: href ${fila.href} ≠ ${destino}#${t.slug}`);
    else if (!existsSync(ficheroDe(destino))) fallar(code, `${t.slug}: no existe ${destino}`);
    else if (!slugsDelModal(destino).includes(t.slug)) fallar(code, `${t.slug}: el #slug no existe en ${destino}`);
  }

  const cabeceras = await page.$$eval(".svc-group-head h2 a", (as) => as.map((a) => a.getAttribute("href")));
  const esperadas = cat.categorias.map((c) => urlDe(lang, `/services/${c.id}/`));
  if (JSON.stringify(cabeceras) !== JSON.stringify(esperadas)) fallar(code, `enlaces de categoría ${JSON.stringify(cabeceras)}`);
  for (const c of cat.categorias) {
    if ((await page.locator(`a.svc-chip[href="#${c.id}"]`).count()) !== 1) fallar(code, `chip de ${c.id} sin ancla`);
    if ((await page.locator(`section.svc-group#${c.id}`).count()) !== 1) fallar(code, `grupo ${c.id} sin id`);
  }
}

async function comprobarFiltros(page, lang) {
  const code = lang.code;
  const visibles = () => page.$$eval(".svc-row", (rows) => rows.filter((r) => r.offsetParent !== null).map((r) => r.dataset.slug));
  const pulsado = () => page.$$eval("[data-goal][aria-pressed='true']", (bs) => bs.map((b) => b.dataset.goal));
  const gruposVacios = () =>
    page.$$eval(".svc-group", (gs) => gs.filter((g) => g.offsetParent !== null && !g.querySelector(".svc-row:not([hidden])")).length);

  for (const objetivo of OBJETIVOS) {
    await page.click(`[data-goal="${objetivo.id}"]`);
    const vistos = await visibles();
    const esperados = [...new Set(objetivo.slugs)];
    if (vistos.length !== esperados.length || !esperados.every((s) => vistos.includes(s)))
      fallar(code, `objetivo ${objetivo.id}: ${vistos.length} filas visibles, se esperaban ${esperados.length}`);
    if ((await pulsado()).join() !== objetivo.id) fallar(code, `objetivo ${objetivo.id}: aria-pressed incorrecto`);
    if ((await gruposVacios()) !== 0) fallar(code, `objetivo ${objetivo.id}: queda un grupo vacío visible`);
    const anuncio = await page.textContent(".svc-count");
    if (!anuncio.includes(String(esperados.length)) || !anuncio.includes("36")) fallar(code, `objetivo ${objetivo.id}: recuento «${anuncio}»`);
  }
  await page.click('[data-goal=""]');
  if ((await visibles()).length !== 36) fallar(code, "«Todos» no restaura las 36 filas");
  if ((await pulsado()).join() !== "") fallar(code, "«Todos» no queda pulsado");
}

async function comprobarModal(page, lang) {
  const code = lang.code;
  const cat = catalogo(code);
  const modalAbierto = (slug) =>
    page.waitForFunction(
      (nombre) => document.getElementById("trat-modal").open && document.querySelector('#trat-modal [data-field="nombre"]').textContent === nombre,
      cat.tratamientos.find((t) => t.slug === slug).nombre,
      { timeout: 5000 }
    );
  const hub = page.url().split("#")[0];

  const ultimo = cat.tratamientos.at(-1).slug;
  await page.click(`.svc-row[data-slug="${ultimo}"]`);
  await modalAbierto(ultimo).catch(() => fallar(code, `clic en ${ultimo} no abre su modal`));
  if (page.url().split("#")[0] !== hub) fallar(code, "el clic en una fila sacó del hub");
  await page.keyboard.press("Escape");

  await page.focus('[data-goal="belleza-depilacion"]');
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const primero = cat.tratamientos[0].slug;
  const enFila = await page.evaluate(() => document.activeElement.dataset.slug);
  if (enFila !== primero) { fallar(code, `Tab desde el último objetivo cae en «${enFila}», no en la primera fila`); return; }
  await page.keyboard.press("Enter");
  await modalAbierto(primero).catch(() => fallar(code, "Enter sobre la primera fila no abre su modal"));
  await page.keyboard.press("Escape");

  await page.focus("a.svc-chip");
  for (let i = 0; i < cat.categorias.length; i++) await page.keyboard.press("Tab");
  if ((await page.evaluate(() => document.activeElement.dataset.goal)) !== "") fallar(code, "Tab no pasa de los chips de categoría al filtro «Todos»");
}

async function comprobarMedidas(browser, lang, base) {
  const code = lang.code;
  for (const ancho of ANCHOS) {
    const page = await nuevaPagina(browser, { width: ancho, height: 900 });
    await page.goto(base + urlDe(lang, "/services/"), { waitUntil: "load" });
    const { scrollW, clientW } = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
    if (scrollW > clientW) fallar(code, `desborde horizontal a ${ancho}px (${scrollW} > ${clientW})`);
    await page.close();
  }
  const page = await nuevaPagina(browser, { width: 390, height: 844 });
  await page.goto(base + urlDe(lang, "/services/"), { waitUntil: "load" });
  await page.addStyleTag({ content: "*{content-visibility:visible !important}" });
  const pantallas = (await page.evaluate(() => document.documentElement.scrollHeight)) / 844;
  if (pantallas > MAX_PANTALLAS) fallar(code, `la página mide ${pantallas.toFixed(2)} pantallas a 390×844 (máximo ${MAX_PANTALLAS})`);
  await page.close();
  return pantallas;
}

const server = await servir();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  for (const lang of LANGS) {
    const page = await nuevaPagina(browser, { width: 390, height: 844 });
    await comprobarContenido(page, lang, base);
    await comprobarFiltros(page, lang);
    await comprobarModal(page, lang);
    await page.close();
    const pantallas = await comprobarMedidas(browser, lang, base);
    console.log(`${lang.code}: ${pantallas.toFixed(2)} pantallas a 390×844`);
  }
} catch (err) {
  fallos.push(`excepción: ${err.stack || err}`);
} finally {
  await browser.close();
  server.close();
}

if (fallos.length) {
  console.error(`check-hub: FALLA\n- ${fallos.join("\n- ")}`);
  process.exit(1);
}
console.log("check-hub: OK");
