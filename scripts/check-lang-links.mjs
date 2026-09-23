/**
 * check-lang-links.mjs — gate de coherencia de idioma en los enlaces internos.
 *
 * Qué comprueba: que ningún `<a href>` interno de una página en idioma X apunte a
 * una página de idioma Y. El bug que lo motivó: en `/uk/contact/` el enlace de la
 * política de privacidad apuntaba a `/privacidad/` (español) porque la plantilla se
 * dejó el `l.prefix`. Vivió desde el refactor i18n sin que ningún gate lo viera.
 *
 * Uso:
 *   node scripts/check-lang-links.mjs          # asume `_site/` ya construido
 *   npx @11ty/eleventy && node scripts/check-lang-links.mjs
 *
 * El informe completo (UTF-8) se escribe en `lang-links-report.txt` en la raíz del
 * repo. El script lo BORRA al arrancar: si peta a medias, un informe viejo se lee
 * igual de bien que uno nuevo y no habría forma de distinguirlos. Quien lo invoque
 * desde fuera debería borrarlo también antes de llamar.
 *
 * La consola solo recibe ASCII: la cp1252 de Windows crashea con cirílico o árabe.
 *
 * Sale con código 1 si hay hallazgos, si no encuentra todos los idiomas de
 * langs.json, o si escanea 0 páginas.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, '_site');
const REPORT = path.join(ROOT, 'lang-links-report.txt');
// Se borra ANTES de escanear, no al final: si el script peta a medias, un informe
// viejo se lee igual de bien que uno nuevo y no habria forma de distinguirlos.
rmSync(REPORT, { force: true });

const langs = JSON.parse(readFileSync(path.join(ROOT, 'src/_data/langs.json'), 'utf8'));
const pages = JSON.parse(readFileSync(path.join(ROOT, 'src/_data/pages.json'), 'utf8'));

// prefijo ("/uk") -> código ("uk"). El español tiene prefix "" y vive en la raíz.
const prefixToCode = new Map();
for (const l of langs) {
  const seg = (l.prefix || '').replace(/^\/+|\/+$/g, '');
  if (seg) prefixToCode.set(seg, l.code);
}
const codeToPrefix = new Map(langs.map((l) => [l.code, l.prefix || '']));
const DEFAULT_LANG = langs.find((l) => !(l.prefix || ''))?.code;

// Páginas que solo existen en un idioma (`"only": ["es"]` en pages.json): enlazar a
// la versión española desde otro idioma es lo correcto, no hay alternativa. Se
// deriva leyendo pages.json, no escribiendo "/aviso-legal/" a mano: si mañana otra
// página pasa a ser solo-ES, el gate se entera solo.
const singleLangPages = new Map();
for (const p of pages) {
  if (Array.isArray(p.only)) singleLangPages.set(normalizePath(p.path), p.only);
}

const ASSET_DIRS = ['/css/', '/js/', '/images/', '/assets/'];

function normalizePath(p) {
  if (!p.startsWith('/')) p = '/' + p;
  if (!p.endsWith('/')) p += '/';
  return p;
}

function ascii(s) {
  return String(s).replace(/[^\x20-\x7E]/g, '?');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

/** Idioma de una página a partir de su ruta en _site: `_site/uk/x/` -> uk, resto -> es. */
function langOfSitePath(relPath) {
  const first = relPath.split('/')[0];
  return prefixToCode.get(first) || DEFAULT_LANG;
}

/** Idioma al que apunta un href absoluto de sitio: `/uk/contact/` -> uk, `/contact/` -> es. */
function langOfHref(href) {
  const first = href.replace(/^\/+/, '').split('/')[0];
  return prefixToCode.get(first) || DEFAULT_LANG;
}

/** Quita el prefijo de idioma de un href: `/uk/contact/` -> `/contact/`. */
function stripPrefix(href, code) {
  const prefix = codeToPrefix.get(code) || '';
  if (!prefix) return href;
  return href.slice(prefix.length) || '/';
}

const skipped = {
  externo: 0,
  mailtoTel: 0,
  ancla: 0,
  asset: 0,
  selectorIdioma: 0, // <a data-lang>: enlaza a los otros 6 idiomas A PROPOSITO
  paginaSoloUnIdioma: 0, // /aviso-legal/ y cía: no existe traducción a la que enviar
};

const findings = [];
// tel: sin prefijo internacional ("tel:656306167" en vez de "tel:+34656306167"):
// un movil con SIM extranjera (turistas ru/de/uk, publico real de la clinica) no
// conecta si el numero no lleva "+". Informe aparte del de enlaces cruzados de
// idioma porque es un fallo de formato, no de idioma de destino.
const telFindings = [];
let telValid = 0;
const langsSeen = new Set();
let pagesScanned = 0;
let internalChecked = 0;
let langSwitcherOnUk = 0;
let avisoLegalOnUk = 0;

const files = walk(SITE);

for (const file of files) {
  const rel = path.relative(SITE, file).split(path.sep).join('/');
  const pageLang = langOfSitePath(rel);
  const pageUrl = '/' + rel.replace(/index\.html$/, '');
  pagesScanned++;
  langsSeen.add(pageLang);

  const html = readFileSync(file, 'utf8');
  // Regex sobre las etiquetas <a ...> del HTML generado: no se añade ninguna
  // dependencia de parseo (cheerio no está en node_modules).
  // Los <link rel="alternate" hreflang> y el canonical son <link>, no <a>:
  // mirando solo <a> quedan fuera por construcción, sin excluirlos a mano.
  const tags = html.match(/<a\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const isSwitcher = /\sdata-lang\s*=/i.test(tag);
    const m = tag.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (!m) continue;
    let href = (m[1] ?? m[2] ?? '').trim();
    if (!href) continue;

    if (/^https?:\/\/anylopez\.com/i.test(href)) href = href.replace(/^https?:\/\/anylopez\.com/i, '') || '/';

    if (/^mailto:/i.test(href)) { skipped.mailtoTel++; continue; }
    if (/^tel:/i.test(href)) {
      skipped.mailtoTel++;
      if (/^tel:\+/i.test(href)) telValid++;
      else telFindings.push({ pageLang, pageUrl, href });
      continue;
    }
    if (href.startsWith('#')) { skipped.ancla++; continue; }
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) { skipped.externo++; continue; }
    if (!href.startsWith('/')) { skipped.externo++; continue; }

    const bare = href.split('#')[0].split('?')[0];
    if (ASSET_DIRS.some((d) => bare.startsWith(d))) { skipped.asset++; continue; }
    if (/\.[a-z0-9]{2,5}$/i.test(bare)) { skipped.asset++; continue; }

    if (pageLang === 'uk' && isSwitcher) langSwitcherOnUk++;
    if (pageLang === 'uk' && normalizePath(bare) === '/aviso-legal/') avisoLegalOnUk++;

    if (isSwitcher) { skipped.selectorIdioma++; continue; }

    const targetLang = langOfHref(bare);
    const logicalPath = normalizePath(stripPrefix(bare, targetLang));
    const only = singleLangPages.get(logicalPath);
    if (only && !only.includes(pageLang)) { skipped.paginaSoloUnIdioma++; continue; }

    internalChecked++;
    if (targetLang !== pageLang) {
      const expected = normalizePath((codeToPrefix.get(pageLang) || '') + logicalPath);
      findings.push({ pageLang, pageUrl, href: bare, targetLang, expected });
    }
  }
}

// --- guardias: un gate que da verde por vacío no vale nada ---
const fatal = [];
if (pagesScanned === 0) fatal.push(`0 paginas HTML escaneadas en ${SITE} (falta construir?)`);
const missing = langs.map((l) => l.code).filter((c) => !langsSeen.has(c));
if (missing.length) fatal.push(`faltan paginas de ${missing.length} idioma(s): ${missing.join(', ')}`);

// --- informe ---
const lines = [];
lines.push('check-lang-links — enlaces internos que cruzan de idioma');
lines.push(`fecha: ${new Date().toISOString()}`);
lines.push(`páginas escaneadas: ${pagesScanned} · idiomas vistos: ${[...langsSeen].sort().join(', ')}`);
lines.push(`enlaces internos comprobados: ${internalChecked}`);
lines.push('enlaces excluidos por motivo:');
for (const [k, v] of Object.entries(skipped)) lines.push(`  ${k}: ${v}`);
lines.push(`sonda uk: <a data-lang> vistos en páginas uk: ${langSwitcherOnUk} · enlaces a /aviso-legal/ en páginas uk: ${avisoLegalOnUk}`);
lines.push('');

if (fatal.length) {
  lines.push('FATAL:');
  for (const f of fatal) lines.push(`  - ${f}`);
  lines.push('');
}

if (findings.length === 0) {
  lines.push('OK — 0 hallazgos.');
} else {
  lines.push(`HALLAZGOS: ${findings.length}`);
  const byLang = new Map();
  for (const f of findings) {
    if (!byLang.has(f.pageLang)) byLang.set(f.pageLang, new Map());
    const byPage = byLang.get(f.pageLang);
    if (!byPage.has(f.pageUrl)) byPage.set(f.pageUrl, []);
    byPage.get(f.pageUrl).push(f);
  }
  for (const [lang, byPage] of [...byLang].sort()) {
    lines.push('');
    lines.push(`[${lang}]`);
    for (const [pageUrl, items] of [...byPage].sort()) {
      lines.push(`  ${pageUrl}`);
      for (const f of items) {
        lines.push(`    href="${f.href}" -> idioma ${f.targetLang}; deberia ser "${f.expected}"`);
      }
    }
  }
}

lines.push('');
lines.push('--- check-lang-links — tel: sin prefijo internacional (+) ---');
// SIM extranjera (turistas ru/de/uk...) marcando "tel:656306167" sin "+34": no conecta.
lines.push(`tel: validos vistos: ${telValid}`);
if (telFindings.length === 0) {
  lines.push('OK — 0 hallazgos.');
} else {
  lines.push(`HALLAZGOS: ${telFindings.length}`);
  for (const f of [...telFindings].sort((a, b) => a.pageUrl.localeCompare(b.pageUrl))) {
    lines.push(`  ${f.pageUrl}  href="${f.href}"`);
  }
}

writeFileSync(REPORT, lines.join('\n') + '\n', 'utf8');

for (const line of lines) console.log(ascii(line));
console.log(`\ninforme completo: ${ascii(path.relative(ROOT, REPORT))}`);

if (fatal.length || findings.length || telFindings.length) process.exit(1);
