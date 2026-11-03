/**
 * Carta del hub (/services/) en Chromium real sobre `_site`, en todos los idiomas de langs.json.
 *
 * Lo que mira es el DOM que pinta el navegador: nombres, precios y filtros se calculan aquí a
 * partir de los catálogos, no de src/_data/preciosDesde.js, para que un fallo allí no se replique.
 * Las secciones con `content-visibility: auto` miden fuera de pantalla su tamaño de reserva, no el
 * real: se fuerza `visible` antes de medir la altura.
 *
 * Se sirve en anylopez.test (mapeado a 127.0.0.1) porque tracking.js no emite en localhost, y se
 * bloquea todo lo que no sea ese host.
 *
 * Uso: npm run verify:hub   (construye y comprueba)
 */
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { serveStatic } from "./lib/serve-static.mjs";

const require = createRequire(import.meta.url);
const LANGS = require("../src/_data/langs.json");
const OBJETIVOS = require("../src/_data/catalogo/objetivos.json");
const catalogo = (code) => require(`../src/_data/catalogo/${code}.json`);
const textos = (code) => require(`../src/_data/i18n/${code}/services.json`);

const SITE = "_site";
const HOST = "anylopez.test";
const ANCHOS = [320, 375, 768, 1024, 1440];
const MAX_PANTALLAS = 8.5;
const ULTIMO_OBJETIVO = OBJETIVOS.at(-1).id;

const noCuenta = (concepto) => /\b(pack|retoque)\b/i.test(concepto);
const importe = (precio) => Number(precio.replace(/[^\d,.]/g, "").replace(",", "."));

// Mínimo de los conceptos sueltos del catálogo español (los precios son iguales en todos los
// idiomas y `concepto` solo es fiable en es); lleva «desde» si hay varios importes o ya lo dice.
function precioEsperado({ precios }) {
  const sueltos = precios.filter((p) => !noCuenta(p.concepto) && /\d/.test(p.precio));
  if (!sueltos.length) return null;
  const minimo = sueltos.reduce((a, b) => (importe(b.precio) < importe(a.precio) ? b : a));
  const hayVarios = sueltos.some((p) => importe(p.precio) !== importe(minimo.precio));
  return { precio: minimo.precio, esDesde: hayVarios || minimo.concepto.toLowerCase().startsWith("desde") };
}

const PRECIO_ESPERADO = new Map(catalogo("es").tratamientos.map((t) => [t.slug, precioEsperado(t)]));

const urlDe = (lang, ruta) => `${lang.prefix}${ruta}`;

function slugsDelModal(url) {
  const html = readFileSync(join(SITE, url, "index.html"), "utf8");
  const json = html.match(/<script id="trat-data" type="application\/json">([\s\S]*?)<\/script>/);
  return json ? JSON.parse(json[1]).tratamientos.map((t) => t.slug) : [];
}

const fallos = [];
const fallar = (code, msg) => fallos.push(`[${code}] ${msg}`);

async function nuevaPagina(browser, viewport) {
  const context = await browser.newContext({ viewport });
  await context.route("**/*", (route) => (new URL(route.request().url()).hostname === HOST ? route.continue() : route.abort()));
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__eventos = [];
    window.umami = { track: (nombre, props) => window.__eventos.push({ nombre, props }) };
  });
  return page;
}

const cerrar = (page) => page.context().close();
const eventos = (page) => page.evaluate(() => window.__eventos.map((e) => e.nombre));

async function comprobarContenido(page, lang, base) {
  const code = lang.code;
  const cat = catalogo(code);
  const total = cat.tratamientos.length;
  const desde = textos(code).list.from;
  await page.goto(base + urlDe(lang, "/services/"), { waitUntil: "load" });
  await page.locator(".svc-goals:not([hidden])").waitFor({ timeout: 10000 });

  const filas = await page.$$eval(".svc-row", (rows) =>
    rows.map((r) => ({
      slug: r.dataset.slug,
      href: r.getAttribute("href"),
      nombre: r.querySelector(".svc-row-name")?.textContent.trim(),
      precio: r.querySelector(".svc-row-price bdi")?.textContent.trim() ?? null,
      marcaDesde: r.querySelector(".svc-row-from")?.textContent.trim() ?? null,
    }))
  );
  if (filas.length !== total) fallar(code, `${filas.length} filas, se esperaban ${total}`);

  for (const t of cat.tratamientos) {
    const fila = filas.find((f) => f.slug === t.slug);
    if (!fila) { fallar(code, `falta la fila de ${t.slug}`); continue; }
    const esperado = PRECIO_ESPERADO.get(t.slug);
    if (fila.nombre !== t.nombre) fallar(code, `${t.slug}: nombre «${fila.nombre}» ≠ «${t.nombre}»`);
    if (fila.precio !== (esperado?.precio ?? null)) fallar(code, `${t.slug}: precio «${fila.precio}» ≠ «${esperado?.precio ?? null}»`);
    const marcaEsperada = esperado?.esDesde ? desde : null;
    if (fila.marcaDesde !== marcaEsperada) fallar(code, `${t.slug}: marcador «${fila.marcaDesde}» ≠ «${marcaEsperada}»`);

    const destino = urlDe(lang, `/services/${t.categoria}/`);
    if (fila.href !== `${destino}#${t.slug}`) fallar(code, `${t.slug}: href ${fila.href} ≠ ${destino}#${t.slug}`);
    else if (!existsSync(join(SITE, destino, "index.html"))) fallar(code, `${t.slug}: no existe ${destino}`);
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
    await fila.click(opciones);
    if (abrePestana && !(await popup)) fallar(code, `clic con ${nombre}: no abrió otra pestaña`);
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
  if (tel.length !== 1 || tel[0].props?.treatment_slug !== slug || tel[0].props?.number !== "656306167")
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

  // Devuelve null al salir de la página, "repetido" al cerrar el ciclo, o el nombre del elemento
  // (con " queda bajo <selector>" si algo lo tapa).
  const siguiente = () =>
    page.evaluate(async () => {
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      window.__recorridos ??= new WeakSet();
      if (window.__recorridos.has(el)) return "repetido";
      window.__recorridos.add(el);
      const caja = el.getBoundingClientRect();
      const nombre = el.dataset.slug || el.getAttribute("href") || el.textContent.trim().slice(0, 30);
      for (const sel of [".site-header", ".svc-nav", ".mobile-bar"]) {
        const cubierta = document.querySelector(sel);
        if (!cubierta || cubierta.contains(el) || getComputedStyle(cubierta).display === "none") continue;
        const c = cubierta.getBoundingClientRect();
        const solapeV = Math.min(caja.bottom, c.bottom) - Math.max(caja.top, c.top);
        const solapeH = Math.min(caja.right, c.right) - Math.max(caja.left, c.left);
        if (solapeV > 1 && solapeH > 1) return `${nombre} queda bajo ${sel}`;
      }
      return nombre;
    });

  for (const tecla of ["Tab", "Shift+Tab"]) {
    await page.evaluate(() => { window.__recorridos = new WeakSet(); document.activeElement?.blur(); });
    let recorridos = 0;
    for (let i = 0; i < 400; i++) {
      await page.keyboard.press(tecla);
      const resultado = await siguiente();
      if (resultado === null || resultado === "repetido") break;
      recorridos++;
      if (resultado.includes(" queda bajo ")) { fallar(code, `${tecla} a ${ancho}px: ${resultado}`); break; }
    }
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
  await page.addStyleTag({ content: "*{content-visibility:visible !important}" });
  const pantallas = (await page.evaluate(() => document.documentElement.scrollHeight)) / 844;
  if (pantallas > MAX_PANTALLAS) fallar(code, `la página mide ${pantallas.toFixed(2)} pantallas a 390×844 (máximo ${MAX_PANTALLAS})`);
  await cerrar(page);
  return pantallas;
}

const server = await serveStatic(SITE);
const base = `http://${HOST}:${server.address().port}`;
const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });
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
