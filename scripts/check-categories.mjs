/**
 * Páginas de categoría (/services/<categoría>/) en Chromium real sobre `_site`, en las 56
 * combinaciones de idioma y categoría.
 *
 * Lo comprobado es el DOM que pinta el navegador, calculado desde los catálogos y los JSON de
 * copy, no desde las plantillas. Las secciones con `content-visibility: auto` miden fuera de
 * pantalla su tamaño de reserva, no el real: se fuerza `visible` antes de medir.
 *
 * Cabeceras (title, description, canonical, hreflang, JSON-LD): se comparan con un build de
 * master si se da su carpeta, `node scripts/check-categories.mjs --base <_site de master>`;
 * sin ella, esa comparación se omite y lo dice. `--solo es/corporal` limita la pasada a una página.
 *
 * Uso: npm run verify:categories   (construye y comprueba)
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { serveStatic } from "./lib/serve-static.mjs";
import { HOST, cerrar, lanzarNavegador, nuevaPagina } from "./lib/browser.mjs";
import { filasDelHub } from "./lib/hub.mjs";

const require = createRequire(import.meta.url);
const todas = require("../src/_data/categoryPages.js");
const catalogo = (code) => require(`../src/_data/catalogo/${code}.json`);
const textos = (code, nombre) => require(`../src/_data/i18n/${code}/${nombre}.json`);

const SITE = "_site";
const MOVIL = { width: 390, height: 844 };
const ESCRITORIO = { width: 1440, height: 900 };
const ANCHOS = [320, 375, 768, 1024, 1440];
const MAX_PRIMER_TRATAMIENTO = { movil: 1.3, escritorio: 1.1 };
const MAX_PANTALLAS = 9.5;
const TACTIL = 44;
const SECCIONES_DE_COPY = ["pain", "why", "process", "tests", "faq"];
const opcion = (nombre) => (process.argv.includes(nombre) ? process.argv[process.argv.indexOf(nombre) + 1] : null);
const BASE = opcion("--base");
const SOLO = opcion("--solo");
const paginas = SOLO ? todas.filter(({ l, cat }) => `${l.code}/${cat.id}` === SOLO) : todas;

const fallos = [];
const fallar = (id, msg) => fallos.push(`[${id}] ${msg}`);

const normalizar = (s) => s.replace(/\s+/g, " ").trim();

function cadenasDeCopy(tx) {
  const salida = [];
  const recorrer = (valor, clave) => {
    if (typeof valor === "string") salida.push({ clave, valor });
    else if (Array.isArray(valor)) valor.forEach((v) => recorrer(v, clave));
    else if (valor) Object.entries(valor).forEach(([k, v]) => recorrer(v, k));
  };
  SECCIONES_DE_COPY.forEach((s) => recorrer(tx[s], s));
  return salida;
}

// Lo que el catálogo aporta a la tarjeta y el modal ya no enseña: `incluye` y, donde la categoría
// lo etiqueta, `paraQuien`.
function cadenasDeCatalogo(code, tx, cat) {
  const tratamientos = catalogo(code).tratamientos.filter((t) => t.categoria === cat.id);
  return tratamientos.flatMap((t) => [
    ...(t.incluye ?? []),
    ...(tx.grid.forWhom_html ? [t.paraQuien] : []),
  ]).map((valor) => ({ clave: "catalogo", valor }));
}

const cabecera = (html) => {
  const una = (re) => html.match(re)?.[1].trim() ?? null;
  return {
    title: una(/<title>([\s\S]*?)<\/title>/),
    description: una(/<meta name="description" content="([^"]*)"/),
    canonical: una(/<link rel="canonical" href="([^"]*)"/),
    hreflang: [...html.matchAll(/<link rel="alternate"[^>]*hreflang="[^"]*"[^>]*>/g)].map((m) => m[0]),
    jsonld: [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1].trim()),
  };
};

function comprobarCabecera({ url }, id) {
  if (!BASE) return;
  const actual = join(SITE, url, "index.html");
  const previo = join(BASE, url, "index.html");
  if (!existsSync(previo)) { fallar(id, `no existe ${previo} en la línea base`); return; }
  const a = cabecera(readFileSync(actual, "utf8"));
  const b = cabecera(readFileSync(previo, "utf8"));
  for (const campo of Object.keys(a)) {
    if (JSON.stringify(a[campo]) !== JSON.stringify(b[campo])) fallar(id, `${campo} difiere de master`);
  }
  if (!a.title || !a.canonical || !a.hreflang.length || !a.jsonld.length) fallar(id, "falta title, canonical, hreflang o JSON-LD");
}

async function leerHub(browser, base, lang) {
  const page = await nuevaPagina(browser, MOVIL);
  await page.goto(`${base}${lang.prefix}/services/`, { waitUntil: "load" });
  const filas = await filasDelHub(page);
  await cerrar(page);
  return new Map(filas.map((f) => [f.slug, f]));
}

const forzarVisible = (page) => page.addStyleTag({ content: "*{content-visibility:visible !important}" });
const pantallasHasta = (page, alto, selector) =>
  page.evaluate(([sel, vh]) => (document.querySelector(sel).getBoundingClientRect().top + scrollY) / vh, [selector, alto]);

async function comprobarTarjetas(page, { l, cat, url }, id, hub) {
  const code = l.code;
  const esperados = catalogo(code).tratamientos.filter((t) => t.categoria === cat.id);
  const tarjetas = await page.$$eval(".trat-card", (cs) =>
    cs.map((c) => ({
      id: c.id,
      href: c.querySelector("a.trat-cta")?.getAttribute("href") ?? null,
      nombre: c.querySelector(".trat-card-name")?.textContent.trim(),
      precio: c.querySelector(".price-from bdi")?.textContent.trim() ?? null,
      marcaDesde: c.querySelector(".price-from-label")?.textContent.trim() ?? null,
    }))
  );
  if (tarjetas.length !== esperados.length) fallar(id, `${tarjetas.length} tarjetas, se esperaban ${esperados.length}`);

  for (const t of esperados) {
    const tarjeta = tarjetas.find((c) => c.id === t.slug);
    const fila = hub.get(t.slug);
    if (!tarjeta) { fallar(id, `falta la tarjeta ${t.slug}`); continue; }
    if (!fila) { fallar(id, `el hub no tiene ${t.slug}`); continue; }
    if (tarjeta.nombre !== t.nombre || tarjeta.nombre !== fila.nombre) fallar(id, `${t.slug}: nombre «${tarjeta.nombre}» ≠ «${t.nombre}»`);
    if (tarjeta.precio !== fila.precio) fallar(id, `${t.slug}: precio «${tarjeta.precio}» ≠ hub «${fila.precio}»`);
    if (tarjeta.marcaDesde !== fila.marcaDesde) fallar(id, `${t.slug}: marcador «${tarjeta.marcaDesde}» ≠ hub «${fila.marcaDesde}»`);
    if (fila.href !== `${url}#${t.slug}`) fallar(id, `${t.slug}: el hub enlaza ${fila.href}, no ${url}#${t.slug}`);
    const enlazada = cat.linkedTreatments[t.slug];
    if (enlazada && tarjeta.href !== `${l.prefix}${enlazada}`) fallar(id, `${t.slug}: enlaza ${tarjeta.href}, no ${l.prefix}${enlazada}`);
    if (!enlazada && tarjeta.href) fallar(id, `${t.slug}: es un enlace y no debería`);
  }
}

async function comprobarCopy(page, { l, cat }, id) {
  const tx = textos(l.code, `svc-${cat.id}`);
  const cadenas = [...cadenasDeCopy(tx), ...cadenasDeCatalogo(l.code, tx, cat)];
  const ausentes = await page.evaluate((lista) => {
    const compacto = (s) => s.replace(/\s+/g, " ").trim();
    const pagina = compacto(document.querySelector(".category-page").textContent);
    const caja = document.createElement("div");
    const aTexto = ({ clave, valor }) => {
      caja.innerHTML = valor;
      return compacto(clave.endsWith("_html") ? caja.textContent : valor);
    };
    return lista.filter((c) => !pagina.includes(aTexto(c))).map(({ valor }) => valor);
  }, cadenas);
  for (const valor of ausentes) fallar(id, `falta en la página: «${normalizar(valor).slice(0, 70)}»`);
  if (!cadenas.length) fallar(id, "no se leyó ninguna cadena de copy");
}

// El carrusel de testimonios solo es foco de teclado cuando desplaza de verdad.
async function carruselConTabindex(page, id, desplaza) {
  const esperado = desplaza ? "0" : null;
  const ok = await page
    .waitForFunction(
      (e) => document.querySelector(".cat-page-tests-grid").getAttribute("tabindex") === e,
      esperado,
      { timeout: 3000 }
    )
    .then(() => true, () => false);
  if (!ok) fallar(id, `tabindex del carrusel ${desplaza ? "ausente cuando desplaza" : "presente cuando no desplaza"}`);
}

async function comprobarMedidas(page, id) {
  await page.setViewportSize(MOVIL);
  const primero = await pantallasHasta(page, MOVIL.height, ".trat-card");
  if (primero > MAX_PRIMER_TRATAMIENTO.movil) fallar(id, `el primer tratamiento queda a ${primero.toFixed(2)} pantallas a 390×844 (máximo ${MAX_PRIMER_TRATAMIENTO.movil})`);
  const pantallas = (await page.evaluate(() => document.documentElement.scrollHeight)) / MOVIL.height;
  if (pantallas > MAX_PANTALLAS) fallar(id, `la página mide ${pantallas.toFixed(2)} pantallas a 390×844 (máximo ${MAX_PANTALLAS})`);

  const pequenos = await page.evaluate((min) => {
    const cajas = [...document.querySelectorAll(".trat-card .trat-cta, .trat-card-more summary, .cat-page-faq-q, .cat-page-process-details summary, .cat-page-hero .btn, .cat-page-final .btn")];
    return cajas.filter((e) => e.getBoundingClientRect().height < min - 0.5).map((e) => e.className || e.tagName);
  }, TACTIL);
  if (pequenos.length) fallar(id, `objetivos táctiles de menos de ${TACTIL} px: ${[...new Set(pequenos)].join(", ")}`);

  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: 900 });
    const { scrollW, clientW } = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
    if (scrollW > clientW) fallar(id, `desborde horizontal a ${ancho}px (${scrollW} > ${clientW})`);
  }
  await page.setViewportSize(ESCRITORIO);
  const enEscritorio = await pantallasHasta(page, ESCRITORIO.height, ".trat-card");
  if (enEscritorio > MAX_PRIMER_TRATAMIENTO.escritorio) fallar(id, `el primer tratamiento queda a ${enEscritorio.toFixed(2)} pantallas a 1440×900 (máximo ${MAX_PRIMER_TRATAMIENTO.escritorio})`);
  await carruselConTabindex(page, id, false);
  await page.setViewportSize(MOVIL);
  await carruselConTabindex(page, id, true);
  return { primero, pantallas };
}

async function comprobarModal(page, { l, cat }, id) {
  const esperados = catalogo(l.code).tratamientos.filter((t) => t.categoria === cat.id && !cat.linkedTreatments[t.slug]);
  const emitidos = (nombre) => page.evaluate((n) => window.__eventos.filter((e) => e.nombre === n), nombre);
  const abierto = (nombre) =>
    page.waitForFunction(
      (n) => document.getElementById("trat-modal").open && document.querySelector('#trat-modal [data-field="nombre"]').textContent === n,
      nombre,
      { timeout: 5000 }
    );

  for (const [i, t] of esperados.entries()) {
    const boton = page.locator(`#${t.slug} .trat-cta`);
    await boton.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await boton.click();
    await abierto(t.nombre).catch(() => fallar(id, `la tarjeta ${t.slug} no abre su modal`));
    const descripcion = await page.locator('#trat-modal [data-field="descripcion"]').textContent();
    if (descripcion !== t.descripcion) fallar(id, `el modal de ${t.slug} no muestra la descripción completa`);

    if (i === 0 || i === esperados.length - 1) {
      await page.evaluate(() => { window.__eventos = []; });
      const popup = page.context().waitForEvent("page", { timeout: 5000 }).catch(() => null);
      await page.click(".trat-modal-cta-wa");
      await (await popup)?.close();
      const wa = await emitidos("whatsapp_clicked");
      if (wa.length !== 1 || wa[0].props?.treatment_slug !== t.slug)
        fallar(id, `whatsapp_clicked de ${t.slug}: ${JSON.stringify(wa.map((e) => e.props))}`);
    }
    await page.keyboard.press("Escape");
  }
}

async function comprobarProceso(page, id) {
  const detalles = page.locator(".cat-page-process-details");
  if (await detalles.evaluate((d) => d.open)) fallar(id, "el proceso empieza abierto");
  await page.focus(".cat-page-process-details summary");
  await page.keyboard.press("Enter");
  if (!(await detalles.evaluate((d) => d.open))) fallar(id, "el proceso no se abre con Enter");
  await page.keyboard.press("Enter");
  if (await detalles.evaluate((d) => d.open)) fallar(id, "el proceso no se cierra con Enter");
}

const server = await serveStatic(SITE);
const base = `http://${HOST}:${server.address().port}`;
const browser = await lanzarNavegador();
const resumen = [];
try {
  const hubs = new Map();
  for (const pagina of paginas) {
    const { l, cat, url } = pagina;
    const id = `${l.code}/${cat.id}`;
    if (!hubs.has(l.code)) hubs.set(l.code, await leerHub(browser, base, l));
    comprobarCabecera(pagina, id);

    const page = await nuevaPagina(browser, MOVIL);
    const respuesta = await page.goto(`${base}${url}`, { waitUntil: "load" });
    if (!respuesta.ok()) { fallar(id, `${url} responde ${respuesta.status()}`); await cerrar(page); continue; }
    await forzarVisible(page);

    await comprobarTarjetas(page, pagina, id, hubs.get(l.code));
    await comprobarCopy(page, pagina, id);
    const { primero, pantallas } = await comprobarMedidas(page, id);
    await comprobarModal(page, pagina, id);
    await comprobarProceso(page, id);
    resumen.push(`${id}: ${pantallas.toFixed(2)} pantallas, primer tratamiento a ${primero.toFixed(2)}`);
    await cerrar(page);
  }
} catch (err) {
  fallos.push(`excepción: ${err.stack || err}`);
} finally {
  await browser.close();
  server.close();
}

console.log(resumen.join("\n"));
if (!BASE) console.log("check-categories: sin --base, no se comparan title, description, canonical, hreflang ni JSON-LD con master");
if (fallos.length) {
  console.error(`check-categories: FALLA\n- ${fallos.join("\n- ")}`);
  process.exit(1);
}
console.log(`check-categories: OK (${resumen.length} páginas)`);
