import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS_URL = new URL('../src/_data/langs.json', import.meta.url);

const ARABIC_RE = /[؀-ۿ]/;
const CYRILLIC_RE = /[Ѐ-ӿ]/;

function homePathFor(lang) {
  const prefix = (lang.prefix || '').replace(/^\/+|\/+$/g, '');
  return prefix
    ? path.join(ROOT, '_site', prefix, 'index.html')
    : path.join(ROOT, '_site', 'index.html');
}

function extractJsonLd(html, langCode) {
  const matches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (matches.length === 0) {
    throw new Error(`[${langCode}] no se encontró ningún bloque <script type="application/ld+json">`);
  }
  for (const m of matches) {
    let parsed;
    try {
      parsed = JSON.parse(m[1]);
    } catch (e) {
      throw new Error(`[${langCode}] un bloque JSON-LD no parsea con JSON.parse: ${e.message}`);
    }
    const graph = parsed['@graph'];
    if (Array.isArray(graph)) {
      const clinic = graph.find((n) => n['@type'] === 'MedicalClinic');
      if (clinic) return clinic;
    }
  }
  throw new Error(`[${langCode}] ningún bloque JSON-LD contiene un nodo @type "MedicalClinic"`);
}

function extractOgSiteName(html, langCode) {
  const m = html.match(/<meta\s+property="og:site_name"\s+content="([^"]*)"\s*\/?>/);
  if (!m) {
    throw new Error(`[${langCode}] no se encontró <meta property="og:site_name">`);
  }
  return m[1];
}

function readHome(lang) {
  const file = homePathFor(lang);
  if (!existsSync(file)) {
    throw new Error(`[${lang.code}] no existe ${file} — ¿has ejecutado "npm run build"?`);
  }
  const html = readFileSync(file, 'utf8');
  const clinic = extractJsonLd(html, lang.code);
  const ogSiteName = extractOgSiteName(html, lang.code);
  return {
    file: path.relative(ROOT, file),
    name: clinic.name,
    description: clinic.description,
    ogSiteName,
  };
}

function main() {
  const langs = JSON.parse(readFileSync(LANGS_URL, 'utf8'));
  const es = langs.find((l) => l.code === 'es');
  if (!es) throw new Error('langs.json no contiene el idioma "es" de referencia');

  const errors = [];
  const rows = [];

  const results = {};
  for (const lang of langs) {
    try {
      results[lang.code] = readHome(lang);
    } catch (e) {
      errors.push(e.message);
    }
  }

  const esResult = results.es;
  if (!esResult) {
    console.error('No se pudo leer la home en español — abortando comparación.');
    console.error(errors.join('\n'));
    process.exit(1);
  }

  const names = new Set();
  for (const lang of langs) {
    const r = results[lang.code];
    if (!r) continue;
    names.add(r.name);

    if (lang.code !== 'es') {
      if (r.description === esResult.description) {
        errors.push(`[${lang.code}] "description" del JSON-LD es idéntica a la de es — no se tradujo`);
      }
      if (r.ogSiteName === esResult.ogSiteName) {
        errors.push(`[${lang.code}] og:site_name es idéntico al de es — no se tradujo`);
      }
    }

    if (lang.code === 'ar' && !ARABIC_RE.test(r.description)) {
      errors.push(`[ar] "description" no contiene caracteres árabes (rango U+0600-06FF)`);
    }
    if ((lang.code === 'ru' || lang.code === 'uk') && !CYRILLIC_RE.test(r.description)) {
      errors.push(`[${lang.code}] "description" no contiene caracteres cirílicos (rango U+0400-04FF)`);
    }

    rows.push({
      idioma: lang.code,
      'og:site_name': r.ogSiteName,
      description: r.description.length > 60 ? r.description.slice(0, 57) + '…' : r.description,
    });
  }

  if (names.size > 1) {
    errors.push(
      `El "name" del JSON-LD difiere entre idiomas — debe ser idéntico en los ${langs.length}: ` +
        [...names].map((n) => `"${n}"`).join(', ')
    );
  }

  if (errors.length > 0) {
    console.error('check-seo-i18n: FALLO\n');
    for (const err of errors) console.error(' - ' + err);
    process.exit(1);
  }

  console.log('check-seo-i18n: OK\n');
  console.table(rows);
  console.log(`\nname (JSON-LD, idéntico en los ${langs.length} idiomas): "${[...names][0]}"`);
}

main();
