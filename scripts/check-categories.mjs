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
import { HOST, cerrar, lanzarNavegador, nuevaPagina, nuevaPaginaIphone, forzarVisible } from "./lib/browser.mjs";
import { filasDelHub } from "./lib/hub.mjs";
import { recorrerFoco } from "./lib/foco.mjs";
import { TACTIL, controlesPequenos, controlesPequenosDeLaCabecera, primeraPantalla } from "./lib/movil.mjs";

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

const pantallasHasta = (page, alto, selector) =>
  page.evaluate(([sel, vh]) => (document.querySelector(sel).getBoundingClientRect().top + scrollY) / vh, [selector, alto]);

async function comprobarTarjetas(page, { l, cat, url }, id, hub) {
  const code = l.code;
  const esperados = catalogo(code).tratamientos.filter((t) => t.categoria === cat.id);
  const tarjetas = await page.$$eval(".trat-card", (cs) =>
    cs.map((c) => ({
      id: c.id,
      panel: c.querySelector(".trat-card-more-panel")?.textContent ?? "",
      etiquetas: [...c.querySelectorAll(".trat-card-more-panel strong")].map((e) => e.textContent.trim()),
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
    if (!tarjeta.panel.includes(t.duracion)) fallar(id, `${t.slug}: el panel «Qué incluye» no repite la duración completa «${t.duracion}»`);
    const sinDosPuntos = tarjeta.etiquetas.filter((e) => !/\s?:$/.test(e));
    if (sinDosPuntos.length) fallar(id, `${t.slug}: etiquetas del panel sin «:» final: ${sinDosPuntos.join(", ")}`);
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

// Botones de tarjeta y resúmenes: una sola línea. Los `.btn` de la página llevan copy largo que en
// móvil se parte, pero la flecha final nunca debe quedarse sola en la última línea.
function botonesPartidos(page) {
  return page.evaluate(() => {
    const lineas = (nodo, desde, hasta) => {
      const r = document.createRange();
      r.setStart(nodo.first, desde);
      r.setEnd(nodo.last, hasta);
      const tops = [...r.getClientRects()].filter((q) => q.width > 0).map((q) => q.top).sort((a, b) => a - b);
      return tops.reduce((n, top, i) => (i && top - tops[i - 1] > 6 ? n + 1 : n), tops.length ? 1 : 0);
    };
    const textos = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodos = [];
      while (walker.nextNode()) if (walker.currentNode.data.trim()) nodos.push(walker.currentNode);
      return nodos.length ? { first: nodos[0], last: nodos.at(-1) } : null;
    };
    const partidos = [];
    for (const el of document.querySelectorAll(".trat-cta, .trat-card-more-btn, .category-page .btn")) {
      const t = textos(el);
      if (!t || !el.getClientRects().length) continue;
      const fin = t.last.data.trimEnd().length;
      const total = lineas(t, 0, fin);
      const esBtn = el.classList.contains("btn");
      if (!esBtn && total > 1) partidos.push(`${el.className}: ${total} líneas`);
      if (esBtn && /[→←]$/.test(t.last.data.trimEnd()) && total > lineas(t, 0, fin - 1)) partidos.push(`${el.className}: la flecha queda sola`);
    }
    return partidos;
  });
}

// `.btn` pinta su propia flecha: no puede repetir la del copy ni acompañar a un enlace tel:.
function flechasDobles(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".category-page .btn")]
      .filter((el) => getComputedStyle(el, "::after").display !== "none")
      .filter((el) => /[→←]$/.test(el.textContent.trim()) || el.getAttribute("href")?.startsWith("tel:"))
      .map((el) => el.textContent.trim().slice(0, 40))
  );
}

async function comprobarMedidas(page, id) {
  await page.setViewportSize(MOVIL);
  const primero = await pantallasHasta(page, MOVIL.height, ".trat-card");
  if (primero > MAX_PRIMER_TRATAMIENTO.movil) fallar(id, `el primer tratamiento queda a ${primero.toFixed(2)} pantallas a 390×844 (máximo ${MAX_PRIMER_TRATAMIENTO.movil})`);
  const pantallas = (await page.evaluate(() => document.documentElement.scrollHeight)) / MOVIL.height;
  if (pantallas > MAX_PANTALLAS) fallar(id, `la página mide ${pantallas.toFixed(2)} pantallas a 390×844 (máximo ${MAX_PANTALLAS})`);

  const dobles = await flechasDobles(page);
  if (dobles.length) fallar(id, `botones con la flecha repetida: ${dobles.join("; ")}`);

  const pequenos = await page.evaluate((min) => {
    const cajas = [...document.querySelectorAll(".trat-card .trat-cta, .trat-card-more-btn, .cat-page-faq-q, .cat-page-process-details summary, .cat-page-hero .btn, .cat-page-final .btn")];
    return cajas.filter((e) => e.getBoundingClientRect().height < min - 0.5).map((e) => e.className || e.tagName);
  }, TACTIL);
  if (pequenos.length) fallar(id, `objetivos táctiles de menos de ${TACTIL} px: ${[...new Set(pequenos)].join(", ")}`);

  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: 900 });
    const { scrollW, clientW } = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
    if (scrollW > clientW) fallar(id, `desborde horizontal a ${ancho}px (${scrollW} > ${clientW})`);
    const partidos = await botonesPartidos(page);
    if (partidos.length) fallar(id, `botón partido a ${ancho}px: ${[...new Set(partidos)].join("; ")}`);
  }
  await page.setViewportSize(ESCRITORIO);
  const enEscritorio = await pantallasHasta(page, ESCRITORIO.height, ".trat-card");
  if (enEscritorio > MAX_PRIMER_TRATAMIENTO.escritorio) fallar(id, `el primer tratamiento queda a ${enEscritorio.toFixed(2)} pantallas a 1440×900 (máximo ${MAX_PRIMER_TRATAMIENTO.escritorio})`);
  await carruselConTabindex(page, id, false);
  await page.setViewportSize(MOVIL);
  await carruselConTabindex(page, id, true);
  return { primero, pantallas };
}

// iPhone 13 (390×664 útiles, táctil): el nombre del primer tratamiento se ve sin desplazar y por encima
// de la barra móvil, y todo control de la tarjeta y de la cabecera mide al menos 44 px de alto y de ancho
// (exclusiones en lib/movil.mjs).
async function comprobarMovil(browser, base, { url }, id) {
  const page = await nuevaPaginaIphone(browser);
  await page.goto(`${base}${url}`, { waitUntil: "load" });
  const { fondo, barra } = await primeraPantalla(page, ".trat-card-name");
  if (fondo > barra) fallar(id, `a 390×664, el nombre del primer tratamiento acaba a ${Math.round(fondo)} px, bajo la barra móvil (${Math.round(barra)} px)`);
  const pequenos = [...(await controlesPequenos(page, [".site-header", ".trat-card"])), ...(await controlesPequenosDeLaCabecera(page))];
  if (pequenos.length) fallar(id, `a 390×664, controles de menos de ${TACTIL} px de alto o ancho: ${[...new Set(pequenos)].join(", ")}`);
  await forzarVisible(page);
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  await cerrar(page);
  return { fondo, alto };
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

// El catálogo del modal es una petición aparte: si falla, el clic lleva al ancla del tratamiento en vez de quedarse mudo.
// En la categoría el ancla es la propia tarjeta; en el hub, la fila enlaza a su categoría.
async function comprobarCatalogoBloqueado(browser, base, { l, url }, id, hubsProbados) {
  const abrir = async (ruta, selector) => {
    const page = await nuevaPagina(browser, MOVIL);
    await page.route("**/assets/catalogo/*", (route) => route.abort());
    await page.goto(`${base}${ruta}`, { waitUntil: "load" });
    await forzarVisible(page);
    const objetivo = page.locator(selector).first();
    const slug = await objetivo.getAttribute("data-slug");
    await objetivo.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await objetivo.click();
    return { page, slug };
  };

  const categoria = await abrir(url, ".trat-cta[data-slug]");
  await categoria.page
    .waitForFunction((s) => location.hash === "#" + s, categoria.slug, { timeout: 5000 })
    .catch(() => fallar(id, "con el JSON del catálogo bloqueado, el clic en la tarjeta no navega a su ancla"));
  if (await categoria.page.evaluate(() => document.getElementById("trat-modal").open)) fallar(id, "con el JSON bloqueado el modal se abrió");
  await cerrar(categoria.page);

  if (hubsProbados.has(l.code)) return;
  hubsProbados.add(l.code);
  const rutaHub = `${l.prefix}/services/`;
  const hub = await abrir(rutaHub, ".svc-row[data-slug]");
  await hub.page
    .waitForURL((u) => u.hash === "#" + hub.slug && u.pathname !== rutaHub, { timeout: 5000 })
    .catch(() => fallar(l.code, "con el JSON del catálogo bloqueado, el clic en la fila del hub no navega a la categoría"));
  await cerrar(hub.page);
}

// El catálogo solo se pide cuando hace falta: con un hash que no es una tarjeta no sale la petición, con el de una
// tarjeta se abre el modal, y tras el clic el disparador queda aria-busy y con cursor de espera hasta que llega el JSON.
async function comprobarCargaDelCatalogo(browser, base, { url }, id) {
  const abrir = async (ruta, antes) => {
    const page = await nuevaPagina(browser, MOVIL);
    const peticiones = [];
    page.on("request", (r) => r.url().includes("/assets/catalogo/") && peticiones.push(r.url()));
    if (antes) await antes(page);
    await page.goto(`${base}${ruta}`, { waitUntil: "load" });
    await page.waitForTimeout(500);
    return { page, peticiones };
  };

  const sinHash = await abrir(url);
  const ancla = await sinHash.page.evaluate(() => document.querySelector("[id]:not(.trat-card)")?.id);
  const slug = await sinHash.page.locator(".trat-card[data-slug]").first().getAttribute("id");
  await cerrar(sinHash.page);

  const otroHash = await abrir(`${url}#${ancla}`);
  if (otroHash.peticiones.length) fallar(id, `el hash #${ancla}, que no es una tarjeta, pidió el catálogo`);
  await cerrar(otroHash.page);

  const hashTarjeta = await abrir(`${url}#${slug}`);
  const abierto = await hashTarjeta.page.evaluate(() => document.getElementById("trat-modal").open);
  if (!hashTarjeta.peticiones.length || !abierto) fallar(id, `el hash #${slug}, de una tarjeta, no abrió el modal`);
  await cerrar(hashTarjeta.page);

  const lento = await abrir(url, (page) => page.route("**/assets/catalogo/*", async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); }));
  const boton = lento.page.locator(".trat-cta[data-slug]").first();
  await boton.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await boton.click();
  const durante = await boton.evaluate((el) => [el.getAttribute("aria-busy"), el.style.cursor]);
  if (durante[0] !== "true" || durante[1] !== "wait") fallar(id, `mientras llega el JSON el disparador tiene aria-busy=${durante[0]} y cursor=${durante[1]}`);
  await lento.page.waitForFunction(() => document.getElementById("trat-modal").open, null, { timeout: 8000 }).catch(() => fallar(id, "con el JSON lento el modal no se abrió"));
  const despues = await boton.evaluate((el) => [el.getAttribute("aria-busy"), el.style.cursor]);
  if (despues[0] !== null || despues[1] !== "") fallar(id, "el disparador sigue aria-busy o con cursor de espera tras abrirse el modal");
  await cerrar(lento.page);
}

// «Qué incluye» es un botón con aria-expanded/aria-controls sobre un panel con `hidden`. Sin JS el panel
// va abierto en el HTML (SEO) y el botón oculto. Con JS: un solo panel abierto, la tarjeta crece, un clic
// fuera no cierra, Escape cierra y devuelve el foco al botón, y abrirlo no abre el modal.
async function comprobarDesplegables(page, id) {
  const estado = () =>
    page.$$eval(".trat-card-more-btn", (bs) =>
      bs.map((b) => {
        const panel = document.getElementById(b.getAttribute("aria-controls"));
        return { tag: b.tagName, tipo: b.type, expandido: b.getAttribute("aria-expanded"), panelOculto: panel?.hidden ?? null, panelVisible: !!panel && panel.offsetHeight > 0 };
      })
    );
  const coherente = (e, i, abierto) => e[i].tag === "BUTTON" && e[i].tipo === "button" && e[i].expandido === String(abierto) && e[i].panelOculto === !abierto && e[i].panelVisible === abierto;
  const botones = page.locator(".trat-card-more-btn");
  const n = await botones.count();

  // Sin JS: panel abierto en el HTML y botón oculto. Con la clase `js` del <head> (que se pone antes
  // del primer pintado), el panel ya está oculto por CSS y el botón visible, sin esperar al JS del final.
  const url = page.url();
  const sinJs = await page.context().browser().newContext({ javaScriptEnabled: false, viewport: page.viewportSize() });
  await sinJs.route("**/*", (route) => (new URL(route.request().url()).hostname === HOST ? route.continue() : route.abort()));
  const estatica = await sinJs.newPage();
  await estatica.goto(url, { waitUntil: "load" });
  const medir = () =>
    estatica.$$eval(".trat-card-more-btn", (bs) =>
      bs.map((b) => {
        const panel = document.getElementById(b.getAttribute("aria-controls"));
        return { boton: b.offsetHeight > 0, panel: !!panel && panel.offsetHeight > 0 && !panel.hidden, texto: panel?.textContent.trim().length ?? 0 };
      })
    );
  const sin = await medir();
  if (sin.length !== n || sin.some((e) => e.boton || !e.panel || !e.texto))
    fallar(id, "sin JS el panel «Qué incluye» debe verse abierto y el botón oculto");
  const script = await estatica.evaluate(() => [...document.head.querySelectorAll("script:not([src])")].some((x) => /documentElement\.classList\.add\(['"]js['"]\)/.test(x.textContent)));
  if (!script) fallar(id, "falta en <head> el script que pone la clase `js` antes del primer pintado");
  await estatica.evaluate(() => document.documentElement.classList.add("js"));
  const con = await medir();
  if (con.some((e) => !e.boton || e.panel)) fallar(id, "con la clase `js` y antes de ejecutar el JS del final, el panel debe estar oculto y el botón visible");
  await sinJs.close();

  const inicial = await estado();
  if (!n || inicial.some((_, i) => !coherente(inicial, i, false))) fallar(id, "con JS, todos los «Qué incluye» deben empezar como botón cerrado con su panel hidden");

  const pulsar = async (i) => {
    const b = botones.nth(i);
    await b.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await b.click({ timeout: 3000 }).catch(() => fallar(id, `el botón ${i + 1} no se puede pulsar con un clic (¿lo tapa otro panel?)`));
  };
  const alto = () => page.locator(".trat-card").first().evaluate((el) => el.getBoundingClientRect().height);
  const antes = await alto();
  await pulsar(0);
  let e = await estado();
  if (!e.length || !coherente(e, 0, true)) fallar(id, "el botón «Qué incluye» no abre su panel (aria-expanded/hidden)");
  if ((await alto()) <= antes) fallar(id, "la tarjeta no crece al abrir «Qué incluye»");
  if (await page.evaluate(() => document.getElementById("trat-modal").open)) fallar(id, "abrir «Qué incluye» abrió el modal");
  await page.evaluate(() => document.body.click());
  e = await estado();
  if (!e.length || !coherente(e, 0, true)) fallar(id, "un clic fuera cerró «Qué incluye»");
  if (n > 1) {
    await pulsar(1);
    await page.waitForFunction(() => document.querySelectorAll(".trat-card-more-btn")[1].getAttribute("aria-expanded") === "true", null, { timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(100);
    e = await estado();
    if (e.filter((x) => x.expandido === "true").length !== 1 || !coherente(e, 1, true) || !coherente(e, 0, false)) fallar(id, "abrir un panel no cierra el anterior");
  }
  const ultimo = n > 1 ? 1 : 0;
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press("Escape");
  e = await estado();
  if (e.some((_, i) => !coherente(e, i, false))) fallar(id, "Escape no cierra el panel «Qué incluye»");
  if (!(await botones.nth(ultimo).evaluate((el) => el === document.activeElement))) fallar(id, "Escape no devuelve el foco al botón");
}

// El orden del DOM (el de tabulación) coincide con el visual: «Qué incluye» antes que «Ver detalles»
// en el sentido de lectura de la página (izquierda a derecha, o derecha a izquierda en RTL).
async function comprobarOrdenDeTabulacion(page, id) {
  const desordenadas = await page.evaluate(() => {
    const rtl = getComputedStyle(document.documentElement).direction === "rtl";
    return [...document.querySelectorAll(".trat-card")].filter((card) => {
      const resumen = card.querySelector(".trat-card-more-btn");
      const cta = card.querySelector(".trat-cta");
      const r = resumen.getBoundingClientRect();
      const c = cta.getBoundingClientRect();
      const domOk = !!(resumen.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING);
      const mismaFila = Math.abs(c.top - r.top) < r.height / 2;
      const visualOk = !mismaFila || (rtl ? r.left > c.left : r.left < c.left);
      return !domOk || !visualOk;
    }).map((card) => card.id);
  });
  if (desordenadas.length) fallar(id, `el orden de tabulación no coincide con el visual en: ${desordenadas.join(", ")}`);
}

// Ningún elemento enfocado queda bajo la cabecera ni la barra móvil.
async function comprobarFoco(page, id) {
  for (const [viewport, teclas] of [[MOVIL, "ambas"], [ESCRITORIO, "Tab"]]) {
    await page.setViewportSize(viewport);
    await page.reload({ waitUntil: "load" });
    for (const { tecla, recorridos, tapado } of await recorrerFoco(page, [".site-header", ".mobile-bar"])) {
      if (teclas !== "ambas" && tecla !== teclas) continue;
      if (tapado) fallar(id, `${tecla} a ${viewport.width}px: ${tapado}`);
      if (recorridos < 30) fallar(id, `${tecla} a ${viewport.width}px solo recorrió ${recorridos} elementos`);
    }
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
  const hubsProbados = new Set();
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
    await comprobarCatalogoBloqueado(browser, base, pagina, id, hubsProbados);
    if (l.code === "es") await comprobarCargaDelCatalogo(browser, base, pagina, id);
    await comprobarProceso(page, id);
    await comprobarOrdenDeTabulacion(page, id);
    await comprobarDesplegables(page, id);
    await comprobarFoco(page, id);
    const movil = await comprobarMovil(browser, base, pagina, id);
    resumen.push(`${id}: ${pantallas.toFixed(2)} pantallas, primer tratamiento a ${primero.toFixed(2)}; a 390×664 su nombre acaba en ${Math.round(movil.fondo)} px, la página mide ${movil.alto} px`);
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
