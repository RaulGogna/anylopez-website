// Compara dos builds de _site para refactors de plantillas sin cambio visible.
//
// Uso: node scripts/compare-sites.mjs <baseline> <actual> [--html-only]
//
// Pensado para refactors de las paginas de categoria contra una baseline construida antes del cambio.
//
// 1. HTML: todos los ficheros iguales byte a byte, salvo las paginas de categoria
//    (services/<categoria>/ x idiomas), donde se normaliza solo la forma exacta que
//    introdujo el refactor, igual en baseline y actual (ver normalize).
// 2. Estilos calculados: sirve ambos sitios por HTTP y compara getComputedStyle de
//    cada elemento (y ::before/::after), emparejados por orden en el DOM.
//
// Sale con codigo 1 si hay cualquier diferencia.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const langs = require(path.join(root, "src/_data/langs.json"));
const categoryIds = require(path.join(root, "src/_data/pages.json"))
  .filter((p) => /^\/services\/[^/]+\/$/.test(p.path))
  .map((p) => p.key);

const args = process.argv.slice(2);
const htmlOnly = args.includes("--html-only");
const [baselineDir, actualDir] = args.filter((a) => !a.startsWith("--")).map((a) => path.resolve(a));
if (!baselineDir || !actualDir) {
  console.error("Uso: node scripts/compare-sites.mjs <baseline> <actual> [--html-only]");
  process.exit(2);
}

const NEW_FILES = new Set(["css/category.css"]);
const categoryPageId = (file) => {
  for (const l of langs) {
    for (const id of categoryIds) {
      if (file === `${l.prefix.slice(1)}${l.prefix ? "/" : ""}services/${id}/index.html`) return id;
    }
  }
  return null;
};

const isHome = (file) => langs.some((l) => file === `${l.prefix.slice(1)}${l.prefix ? "/" : ""}index.html`);

// Excepcion nominal contra la baseline 26b002d: el formulario de la home guarda el texto original
// del boton y lo restaura al fallar el envio, en vez de escribir el literal "book".
function normalizeHome(html) {
  const start = html.indexOf("const leadForm = ");
  return (
    html.slice(0, start) +
    html
      .slice(start)
      .replace(/      const originalLabel = btn\.textContent;\r?\n/, "")
      .replace(/btn\.textContent = (?:originalLabel|"[^"\n]*");(?=\s*alert)/g, "btn.textContent = <restore>;")
  );
}

const listFiles = (dir) =>
  fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join("/"))
    .sort();

// Lo unico que el refactor cambia, por forma exacta. Se aplica igual a baseline y actual.
const CATEGORY_STYLE_BLOCK = /<style>\s*\/\* ─── HERO CINEMATIC[\s\S]*?<\/style>/;
const CATEGORY_CSS_LINK = /<link rel="stylesheet" href="[^"]*\/css\/category\.css\?v=[0-9a-f]{8}" \/>/;
const categoryWrapperOpen = (id) => `<div class="category-page" data-category="${id}">`;
const WRAPPER_CLOSE = /(<\/section>\s*)<\/div>(\s*<!-- TREATMENT MODAL)/;
// Excepciones nominales: tratamientos-faciales tenia dos particularidades propias.
const TF_SPECIALTIES_INLINE =
  '"relevantSpecialty": ["https://schema.org/Dermatologic", "https://schema.org/PlasticSurgery"],';
const tfSpecialtiesListed = (eol) =>
  `"relevantSpecialty": [${eol}    "https://schema.org/Dermatologic",${eol}    "https://schema.org/PlasticSurgery"${eol}  ],`;
const TF_SCRIPT_COMMENT = /  \/\* FAQ accordion \*\/\r?\n/;

// Colapsa los espacios a uno solo en el texto y entre atributos. No toca valores de atributo,
// <script> ni <style> (incluido el JSON-LD). Que haya o no espacio si cuenta.
const HTML_TOKEN =
  /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const collapseTag = (tag) => tag.replace(/("[^"]*"|'[^']*')|\s+/g, (_, quoted) => quoted ?? " ");
function collapseWhitespace(html) {
  let out = "";
  let last = 0;
  for (const m of html.matchAll(HTML_TOKEN)) {
    out += html.slice(last, m.index).replace(/\s+/g, " ");
    out += /^<(script|style)\b/.test(m[0]) ? m[0] : collapseTag(m[0]);
    last = m.index + m[0].length;
  }
  return (out + html.slice(last).replace(/\s+/g, " ")).trim();
}

function normalize(html, id) {
  let out = html
    .replace(CATEGORY_STYLE_BLOCK, "")
    .replace(CATEGORY_CSS_LINK, "")
    .replace(categoryWrapperOpen(id), "")
    .replace(WRAPPER_CLOSE, "$1$2");
  if (id === "tratamientos-faciales") {
    const eol = out.includes("\r\n") ? "\r\n" : "\n";
    out = out.replace(TF_SPECIALTIES_INLINE, tfSpecialtiesListed(eol)).replace(TF_SCRIPT_COMMENT, "");
  }
  return collapseWhitespace(out.replace(/<!--[\s\S]*?-->/g, ""));
}

function firstDifference(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const view = (s) => JSON.stringify(s.slice(Math.max(0, i - 60), i + 100));
  return `posicion ${i}\n      baseline: ${view(a)}\n      actual:   ${view(b)}`;
}

const failures = [];

function compareHtml() {
  const baseline = listFiles(baselineDir);
  const actual = listFiles(actualDir);
  const baselineSet = new Set(baseline);
  const actualSet = new Set(actual);

  for (const f of baseline) if (!actualSet.has(f)) failures.push(`FALTA en actual: ${f}`);
  for (const f of actual) if (!baselineSet.has(f) && !NEW_FILES.has(f)) failures.push(`SOBRA en actual: ${f}`);

  let categoryPages = 0;
  for (const f of baseline.filter((f) => actualSet.has(f))) {
    const id = categoryPageId(f);
    const a = fs.readFileSync(path.join(baselineDir, f));
    const b = fs.readFileSync(path.join(actualDir, f));
    if (isHome(f)) {
      if (normalizeHome(a.toString("utf8")) !== normalizeHome(b.toString("utf8"))) failures.push(`HTML distinto (home): ${f}`);
      continue;
    }
    if (!id) {
      if (!a.equals(b)) failures.push(`HTML distinto (byte a byte): ${f}`);
      continue;
    }
    categoryPages++;
    const na = normalize(a.toString("utf8"), id);
    const nb = normalize(b.toString("utf8"), id);
    if (na !== nb) failures.push(`HTML distinto (categoria ${id}): ${f}\n      ${firstDifference(na, nb)}`);
  }
  console.log(`HTML: ${baseline.length} ficheros en baseline, ${categoryPages} paginas de categoria normalizadas`);
  if (categoryPages !== categoryIds.length * langs.length) {
    failures.push(`Se esperaban ${categoryIds.length * langs.length} paginas de categoria y hay ${categoryPages}`);
  }
}

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".mp4": "video/mp4" };

function serve(dir) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(dir, rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// Se ejecuta dentro de la pagina: una huella por elemento (y sus pseudo-elementos) y la altura total.
function collectStyles(detailIndexes) {
  const SKIP = new Set(["STYLE", "LINK", "SCRIPT", "NOSCRIPT", "TEMPLATE", "META"]);
  const toObject = (cs) => {
    const props = {};
    for (let i = 0; i < cs.length; i++) props[cs[i]] = cs.getPropertyValue(cs[i]);
    return props;
  };
  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  const elements = [document.documentElement, ...document.body.querySelectorAll("*")].filter(
    (el) => !SKIP.has(el.tagName) && !el.matches(".category-page[data-category]"),
  );
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/).join(".")}` : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const state = (el) => ["", "::before", "::after"].map((p) => toObject(getComputedStyle(el, p || null)));
  const result = { height: document.documentElement.scrollHeight, count: elements.length };
  if (detailIndexes) {
    result.details = detailIndexes.map((i) => ({ i, name: describe(elements[i]), states: state(elements[i]) }));
  } else {
    result.hashes = elements.map((el) => state(el).map((s) => hash(JSON.stringify(Object.entries(s).sort()))).join("-"));
  }
  return result;
}

async function compareStyles() {
  const { chromium } = await import("playwright");
  const [baseServer, actualServer] = await Promise.all([serve(baselineDir), serve(actualDir)]);
  const origins = {
    baseline: `http://127.0.0.1:${baseServer.address().port}`,
    actual: `http://127.0.0.1:${actualServer.address().port}`,
  };
  const browser = await chromium.launch({ headless: true });
  const viewports = [375, 768, 1440];
  const checkedLangs = langs.filter((l) => ["es", "ar"].includes(l.code));
  let pages = 0;

  const load = async (site, url, width) => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.route("**/*", (route) =>
      route.request().url().startsWith(origins[site]) ? route.continue() : route.abort(),
    );
    await page.goto(origins[site] + url, { waitUntil: "load" });
    await page.addStyleTag({ content: "*, *::before, *::after { content-visibility: visible !important; }" });
    await page.evaluate(() => document.fonts.ready);
    return { page, context };
  };

  // Las transiciones en curso (revelados, hovers de carga) falsean la lectura: se espera a que dos lecturas seguidas coincidan.
  const settledStyles = async (page) => {
    let previous = await page.evaluate(collectStyles, null);
    for (let attempt = 0; attempt < 15; attempt++) {
      await page.waitForTimeout(250);
      const current = await page.evaluate(collectStyles, null);
      if (current.hashes.join() === previous.hashes.join() && current.height === previous.height) return current;
      previous = current;
    }
    return previous;
  };

  const compareOne = async (l, id, width) => {
    const url = `${l.prefix}/services/${id}/`;
    const label = `${url} @${width}`;
    const [a, b] = await Promise.all([load("baseline", url, width), load("actual", url, width)]);
    const [sa, sb] = await Promise.all([settledStyles(a.page), settledStyles(b.page)]);
    pages++;
    if (sa.height !== sb.height) failures.push(`ESTILOS ${label}: altura de pagina ${sa.height} -> ${sb.height}`);
    if (sa.count !== sb.count) {
      failures.push(`ESTILOS ${label}: ${sa.count} elementos en baseline, ${sb.count} en actual`);
    } else {
      const different = sa.hashes.flatMap((h, i) => (h === sb.hashes[i] ? [] : [i]));
      if (different.length) {
        const da = (await a.page.evaluate(collectStyles, different.slice(0, 5))).details;
        const db = (await b.page.evaluate(collectStyles, different.slice(0, 5))).details;
        failures.push(`ESTILOS ${label} [categoria ${id}]: ${different.length} elementos con estilo calculado distinto`);
        da.forEach((d, k) => {
          ["", "::before", "::after"].forEach((pseudo, s) => {
            const pa = d.states[s];
            const pb = db[k].states[s];
            const props = Object.keys({ ...pa, ...pb }).filter((p) => pa[p] !== pb[p]).slice(0, 4);
            if (props.length) {
              failures.push(`      ${d.name}${pseudo}: ${props.map((p) => `${p} ${pa[p]} -> ${pb[p]}`).join(" | ")}`);
            }
          });
        });
      }
    }
    await Promise.all([a.context.close(), b.context.close()]);
  };

  const jobs = checkedLangs.flatMap((l) => categoryIds.flatMap((id) => viewports.map((width) => [l, id, width])));
  const workers = Array.from({ length: 3 }, async () => {
    while (jobs.length) await compareOne(...jobs.shift());
  });
  await Promise.all(workers);
  await browser.close();
  baseServer.close();
  actualServer.close();
  console.log(`Estilos: ${pages} paginas comparadas (${checkedLangs.map((l) => l.code).join(", ")} x ${categoryIds.length} categorias x ${viewports.join("/")}px)`);
}

compareHtml();
if (!htmlOnly) await compareStyles();

if (failures.length) {
  console.error(`\nDIFERENCIAS (${failures.length}):`);
  failures.slice(0, 80).forEach((f) => console.error(`  - ${f}`));
  if (failures.length > 80) console.error(`  ... y ${failures.length - 80} mas`);
  process.exit(1);
}
console.log("OK: sin diferencias");
