/**
 * Carta del hub (/services/) en Chromium real sobre `_site`, en todos los idiomas de langs.json.
 *
 * Lo que mira es el DOM que pinta el navegador: los precios salen de una tabla fija de este script,
 * no de src/_data/preciosDesde.js, para que un fallo allí no se replique; nombres y filtros, de los catálogos.
 * Las secciones con `content-visibility: auto` miden fuera de pantalla su tamaño de reserva, no el
 * real: se fuerza `visible` antes de medir la altura.
 *
 * Uso: npm run verify:hub   (construye y comprueba)
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { serveStatic } from "./lib/serve-static.mjs";
import { HOST, cerrar, lanzarNavegador, nuevaPagina, nuevaPaginaIphone, forzarVisible } from "./lib/browser.mjs";
import { filasDelHub } from "./lib/hub.mjs";
import { recorrerFoco } from "./lib/foco.mjs";
import { TACTIL, controlesPequenos, controlesPequenosDeLaCabecera, primeraPantalla } from "./lib/movil.mjs";

const require = createRequire(import.meta.url);
const LANGS = require("../src/_data/langs.json");
const OBJETIVOS = require("../src/_data/catalogo/objetivos.json");
const TELEFONO = require("../src/_data/site.json").phoneE164.replace(/^34/, "");
const catalogo = (code) => require(`../src/_data/catalogo/${code}.json`);
const textos = (code, nombre = "services") => require(`../src/_data/i18n/${code}/${nombre}.json`);

const SITE = "_site";
const ANCHOS = [320, 375, 768, 1024, 1440];
const MAX_PANTALLAS = 8.5;
const ULTIMO_OBJETIVO = OBJETIVOS.at(-1).id;

// Precios que debe pintar el hub, fijados a mano contra catalogo/es.json (los packs y los retoques
// no cuentan; los precios son iguales en todos los idiomas). Si el catálogo cambia, este gate falla
// a propósito: revisa el catálogo y actualiza esta tabla a mano, no la derives de él.
const DESDE = true;
const PRECIO_ESPERADO = new Map(Object.entries({
  "limpieza-facial-gold": ["50 €"],
  "limpieza-facial-platinum": ["75 €"],
  "limpieza-facial-detox": ["150 €"],
  "limpieza-facial-diamond": ["150 €"],
  "limpieza-facial-elite": ["200 €"],
  "mesoterapia-virtual": ["90 €"],
  "velo-colageno-puro": ["150 €"],
  "dermapen-hidratacion": ["150 €"],
  "dermapen-cicatrices": ["75 €"],
  "peeling-antimanchas": ["175 €"],
  "peeling-quimico-facial": ["150 €"],
  "dermaplaning-facial": ["50 €"],
  "anti-acne": ["75 €"],
  "laser-plasma-pen": ["95 €", DESDE],
  "ultherapy": ["200 €", DESDE],
  "radiofrecuencia-indiba": ["65 €", DESDE],
  "botox-zona": ["300 €"],
  "acido-hialuronico": ["300 €", DESDE],
  "hilos-tensores": ["395 €", DESDE],
  "prp-plasma": ["275 €"],
  "maderoterapia": ["40 €"],
  "presoterapia": ["25 €"],
  "drenaje-linfatico-postop": ["65 €", DESDE],
  "dolor-muscular-corporal": ["65 €"],
  "triple-accion-anticelulitica": ["90 €"],
  "masaje-corporal": ["35 €", DESDE],
  "masaje-relajante": ["25 €", DESDE],
  "masaje-craneo-facial-cervical": ["50 €", DESDE],
  "masaje-podal": ["45 €", DESDE],
  "masaje-piernas-cansadas": ["45 €", DESDE],
  "masaje-aloe-vera": ["75 €"],
  "masaje-facial-colageno": ["60 €"],
  "masaje-facial-vitamina-c": ["50 €"],
  "pestanas-pelo-a-pelo": ["70 €", DESDE],
  "micropigmentacion": ["300 €"],
  "depilacion-ipl": ["12 €", DESDE],
}).map(([slug, [precio, esDesde = false]]) => [slug, { precio, esDesde }]));

const AVISO_TABLA = "revisa el catálogo y actualiza PRECIO_ESPERADO en scripts/check-hub.mjs a mano";

const urlDe = (lang, ruta) => `${lang.prefix}${ruta}`;

function slugsDelModal(code) {
  const ruta = join(SITE, "assets", "catalogo", `${code}.json`);
  return existsSync(ruta) ? JSON.parse(readFileSync(ruta, "utf8")).tratamientos.map((t) => t.slug) : [];
}

const fallos = [];
const fallar = (code, msg) => fallos.push(`[${code}] ${msg}`);

const slugsCatalogo = catalogo("es").tratamientos.map((t) => t.slug);
const sinPrecio = slugsCatalogo.filter((s) => !PRECIO_ESPERADO.has(s));
const sobrantes = [...PRECIO_ESPERADO.keys()].filter((s) => !slugsCatalogo.includes(s));
if (sinPrecio.length || sobrantes.length)
  fallar("es", `el catálogo cambió (sin precio esperado: ${sinPrecio.join(", ") || "-"}; sobran: ${sobrantes.join(", ") || "-"}): ${AVISO_TABLA}`);

const eventos = (page) => page.evaluate(() => window.__eventos.map((e) => e.nombre));

async function comprobarContenido(page, lang, base) {
  const code = lang.code;
  const cat = catalogo(code);
  const total = cat.tratamientos.length;
  const desde = textos(code, "partials").catalog.from;
  await page.goto(base + urlDe(lang, "/services/"), { waitUntil: "load" });
  await page.locator(".svc-goals:not([hidden])").waitFor({ timeout: 10000 });

  const filas = await filasDelHub(page);
  if (filas.length !== total) fallar(code, `${filas.length} filas, se esperaban ${total}`);

  for (const t of cat.tratamientos) {
    const fila = filas.find((f) => f.slug === t.slug);
    if (!fila) { fallar(code, `falta la fila de ${t.slug}`); continue; }
    const esperado = PRECIO_ESPERADO.get(t.slug);
    if (fila.nombre !== t.nombre) fallar(code, `${t.slug}: nombre «${fila.nombre}» ≠ «${t.nombre}»`);
    if (fila.precio !== (esperado?.precio ?? null)) fallar(code, `${t.slug}: precio «${fila.precio}» ≠ «${esperado?.precio ?? null}»; ${AVISO_TABLA}`);
    const marcaEsperada = esperado?.esDesde ? desde : null;
    if (fila.marcaDesde !== marcaEsperada) fallar(code, `${t.slug}: marcador «${fila.marcaDesde}» ≠ «${marcaEsperada}»; ${AVISO_TABLA}`);

    const destino = urlDe(lang, `/services/${t.categoria}/`);
    if (fila.href !== `${destino}#${t.slug}`) fallar(code, `${t.slug}: href ${fila.href} ≠ ${destino}#${t.slug}`);
    else if (!existsSync(join(SITE, destino, "index.html"))) fallar(code, `${t.slug}: no existe ${destino}`);
    else if (!slugsDelModal(code).includes(t.slug)) fallar(code, `${t.slug}: el modal no conoce el #slug de ${destino}`);
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
  const total = catalogo(code).tratamientos.length;
  const plantilla = textos(code).list.count;
  const anuncio = (n) => plantilla.replace("{shown}", n).replace("{total}", total);
  const visibles = () => page.$$eval(".svc-row", (rows) => rows.filter((r) => r.offsetParent !== null).map((r) => r.dataset.slug));
  const pulsado = () => page.$$eval("[data-goal][aria-pressed='true']", (bs) => bs.map((b) => b.dataset.goal));
  const gruposVacios = () =>
    page.$$eval(
      ".svc-group",
      (gs) => gs.filter((g) => g.offsetParent !== null && ![...g.querySelectorAll(".svc-row")].some((r) => r.offsetParent !== null)).length
    );

  for (const objetivo of OBJETIVOS) {
    await page.click(`[data-goal="${objetivo.id}"]`);
    const vistos = await visibles();
    const esperados = [...new Set(objetivo.slugs)];
    if (vistos.length !== esperados.length || !esperados.every((s) => vistos.includes(s)))
      fallar(code, `objetivo ${objetivo.id}: ${vistos.length} filas visibles, se esperaban ${esperados.length}`);
    if ((await pulsado()).join() !== objetivo.id) fallar(code, `objetivo ${objetivo.id}: aria-pressed incorrecto`);
    if ((await gruposVacios()) !== 0) fallar(code, `objetivo ${objetivo.id}: queda un grupo vacío visible`);
    const dicho = (await page.textContent(".svc-count")).trim();
    if (dicho !== anuncio(esperados.length)) fallar(code, `objetivo ${objetivo.id}: recuento «${dicho}» ≠ «${anuncio(esperados.length)}»`);
  }
  await page.click('[data-goal=""]');
  if ((await visibles()).length !== total) fallar(code, `«Todos» no restaura las ${total} filas`);
  if ((await pulsado()).join() !== "") fallar(code, "«Todos» no queda pulsado");
  const dicho = (await page.textContent(".svc-count")).trim();
  if (dicho !== anuncio(total)) fallar(code, `«Todos»: recuento «${dicho}» ≠ «${anuncio(total)}»`);
}

async function comprobarModal(page, lang) {
  const code = lang.code;
  const cat = catalogo(code);
  const nombreDe = (slug) => cat.tratamientos.find((t) => t.slug === slug).nombre;
  const modalAbierto = (slug) =>
    page.waitForFunction(
      (nombre) => document.getElementById("trat-modal").open && document.querySelector('#trat-modal [data-field="nombre"]').textContent === nombre,
      nombreDe(slug),
      { timeout: 5000 }
    );
  const hub = page.url().split("#")[0];

  const ultimo = cat.tratamientos.at(-1).slug;
  await page.click(`.svc-row[data-slug="${ultimo}"]`);
  await modalAbierto(ultimo).catch(() => fallar(code, `clic en ${ultimo} no abre su modal`));
  if (page.url().split("#")[0] !== hub) fallar(code, "el clic en una fila sacó del hub");
  await page.click(".trat-modal-close");
  const emitidos = await eventos(page);
  if (!emitidos.includes("treatment_modal_opened")) fallar(code, "abrir el modal no emite treatment_modal_opened");
  const deFormulario = emitidos.filter((e) => e.startsWith("form_"));
  if (deFormulario.length) fallar(code, `el <form method="dialog"> del modal emitió ${deFormulario.join(", ")}`);

  await page.focus(`[data-goal="${ULTIMO_OBJETIVO}"]`);
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

// Ctrl, Shift y botón central abren otra pestaña o ventana y deben dejar el hub sin modal.
async function comprobarClicsNativos(page, lang) {
  const code = lang.code;
  const fila = page.locator(".svc-row").first();
  const casos = [
    { nombre: "Ctrl", opciones: { modifiers: ["Control"] }, abrePestana: true },
    { nombre: "Shift", opciones: { modifiers: ["Shift"] }, abrePestana: true },
    { nombre: "botón central", opciones: { button: "middle" }, abrePestana: true },
    { nombre: "Meta", opciones: { modifiers: ["Meta"] }, abrePestana: false },
  ];
  for (const { nombre, opciones, abrePestana } of casos) {
    const popup = abrePestana ? page.context().waitForEvent("page", { timeout: 5000 }).catch(() => null) : null;
    // Meta+clic no abre pestaña en Windows y el enlace navegaría en la misma: se frena en window, tras
    // los manejadores de la página, para que la comprobación no compita con la navegación.
    if (!abrePestana) {
      await page.evaluate(() => {
        window.__prevenidoPorLaPagina = null;
        window.addEventListener("click", (e) => { window.__prevenidoPorLaPagina = e.defaultPrevented; e.preventDefault(); }, { once: true });
      });
    }
    await fila.click(opciones);
    if (abrePestana && !(await popup)) fallar(code, `clic con ${nombre}: no abrió otra pestaña`);
    if (!abrePestana && (await page.evaluate(() => window.__prevenidoPorLaPagina)) !== false) fallar(code, `clic con ${nombre}: la página lo tomó (preventDefault) o no llegó el clic`);
    if (await page.evaluate(() => document.getElementById("trat-modal").open)) fallar(code, `clic con ${nombre} abrió el modal`);
  }
}

// Los CTA del modal llevan data-event: sin él, tracking.js contaría el clic a wa.me como outbound_clicked.
// El clic abre wa.me en otra pestaña, y el route de nuevaPagina lo aborta: no se sale a la red.
async function comprobarEventosDelModal(page, lang) {
  const code = lang.code;
  const slug = catalogo(code).tratamientos[0].slug;
  const emitidos = (nombre) => page.evaluate((n) => window.__eventos.filter((e) => e.nombre === n), nombre);

  await page.click(`.svc-row[data-slug="${slug}"]`);
  await page.locator("#trat-modal[open]").waitFor();
  await page.evaluate(() => { window.__eventos = []; });

  const popup = page.context().waitForEvent("page", { timeout: 5000 }).catch(() => null);
  await page.click(".trat-modal-cta-wa");
  await (await popup)?.close();
  const wa = await emitidos("whatsapp_clicked");
  if (wa.length !== 1) fallar(code, `el CTA de WhatsApp emitió ${wa.length} whatsapp_clicked, se esperaba 1`);
  else if (wa[0].props?.treatment_slug !== slug || wa[0].props?.location !== "treatment-modal")
    fallar(code, `whatsapp_clicked con props ${JSON.stringify(wa[0].props)}, se esperaba ${slug} en treatment-modal`);
  if ((await emitidos("outbound_clicked")).length) fallar(code, "el CTA de WhatsApp emitió outbound_clicked");

  await page.evaluate(() => { window.__eventos = []; });
  await page.click(".trat-modal-cta-tel").catch(() => {});
  const tel = await emitidos("phone_clicked");
  if (tel.length !== 1 || tel[0].props?.treatment_slug !== slug || tel[0].props?.number !== TELEFONO)
    fallar(code, `el CTA de teléfono emitió ${JSON.stringify(tel)}`);
  await page.keyboard.press("Escape");
}

async function comprobarTracking(browser, lang, base) {
  const page = await nuevaPagina(browser, { width: 1024, height: 800 });
  await page.goto(base + urlDe(lang, "/contact/"), { waitUntil: "load" });
  await page.focus("form input");
  if (!(await eventos(page)).includes("form_started")) fallar(lang.code, "escribir en el formulario de contacto no emite form_started");
  await cerrar(page);
}

// Recorre la página con Tab y con Shift+Tab: nada enfocado puede quedar bajo la cabecera, la fila
// fija de categorías ni la barra móvil.
async function comprobarFocoVisible(browser, lang, base, ancho) {
  const code = lang.code;
  const alto = ancho <= 768 ? 844 : 900;
  const page = await nuevaPagina(browser, { width: ancho, height: alto });
  await page.goto(base + urlDe(lang, "/services/"), { waitUntil: "load" });
  await page.locator(".svc-goals:not([hidden])").waitFor();

  for (const { tecla, recorridos, tapado } of await recorrerFoco(page, [".site-header", ".svc-nav", ".mobile-bar"])) {
    if (tapado) fallar(code, `${tecla} a ${ancho}px: ${tapado}`);
    if (recorridos < 50) fallar(code, `${tecla} a ${ancho}px solo recorrió ${recorridos} elementos: ¿el recorrido se cortó?`);
  }
  await cerrar(page);
}

async function comprobarMedidas(browser, lang, base) {
  const code = lang.code;
  for (const ancho of ANCHOS) {
    const page = await nuevaPagina(browser, { width: ancho, height: 900 });
    await page.goto(base + urlDe(lang, "/services/"), { waitUntil: "load" });
    const { scrollW, clientW } = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
    if (scrollW > clientW) fallar(code, `desborde horizontal a ${ancho}px (${scrollW} > ${clientW})`);
    await cerrar(page);
  }
  const page = await nuevaPagina(browser, { width: 390, height: 844 });
  await page.goto(base + urlDe(lang, "/services/"), { waitUntil: "load" });
  await forzarVisible(page);
  const pantallas = (await page.evaluate(() => document.documentElement.scrollHeight)) / 844;
  if (pantallas > MAX_PANTALLAS) fallar(code, `la página mide ${pantallas.toFixed(2)} pantallas a 390×844 (máximo ${MAX_PANTALLAS})`);
  await cerrar(page);
  return pantallas;
}

// iPhone 13 (390×664 útiles, táctil): sin desplazar y por encima de la barra móvil se ven los chips de
// categoría, la fila de objetivos y la primera fila de tratamiento; y todo control del hub y de la
// cabecera mide al menos 44 px de alto y de ancho (exclusiones en lib/movil.mjs).
async function comprobarMovil(browser, lang, base) {
  const code = lang.code;
  const page = await nuevaPaginaIphone(browser);
  await page.goto(base + urlDe(lang, "/services/"), { waitUntil: "load" });
  await page.locator(".svc-goals:not([hidden])").waitFor();

  let fila;
  for (const [nombre, selector] of [["los chips de categoría", ".svc-nav"], ["la fila de objetivos", ".svc-goals"], ["la primera fila", ".svc-row"]]) {
    const { fondo, barra } = await primeraPantalla(page, selector);
    if (selector === ".svc-row") fila = fondo;
    if (fondo > barra) fallar(code, `a 390×664, ${nombre} acaba a ${Math.round(fondo)} px, bajo la barra móvil (${Math.round(barra)} px)`);
  }
  const pequenos = [...(await controlesPequenos(page, [".site-header", ".svc-index"])), ...(await controlesPequenosDeLaCabecera(page))];
  if (pequenos.length) fallar(code, `a 390×664, controles de menos de ${TACTIL} px de alto o ancho: ${[...new Set(pequenos)].join(", ")}`);

  await forzarVisible(page);
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  await cerrar(page);
  return { fila, alto };
}

const server = await serveStatic(SITE);
const base = `http://${HOST}:${server.address().port}`;
const browser = await lanzarNavegador();
try {
  for (const lang of LANGS) {
    const page = await nuevaPagina(browser, { width: 390, height: 844 });
    await comprobarContenido(page, lang, base);
    await comprobarFiltros(page, lang);
    await comprobarModal(page, lang);
    await comprobarEventosDelModal(page, lang);
    await comprobarClicsNativos(page, lang);
    await cerrar(page);
    await comprobarTracking(browser, lang, base);
    for (const ancho of [390, 1440]) await comprobarFocoVisible(browser, lang, base, ancho);
    const pantallas = await comprobarMedidas(browser, lang, base);
    const { fila, alto } = await comprobarMovil(browser, lang, base);
    console.log(`${lang.code}: ${pantallas.toFixed(2)} pantallas a 390×844; a 390×664 la primera fila acaba en ${Math.round(fila)} px, la página mide ${alto} px`);
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
