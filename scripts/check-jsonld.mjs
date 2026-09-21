import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_DIR = path.join(ROOT, '_site');

const JSONLD_BLOCK_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const HTML_ENTITY_RE = /&#39;|&amp;|&quot;|&lt;|&gt;|&\w+;/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function findEntitiesInValues(value, keyPath, hits) {
  if (typeof value === 'string') {
    if (HTML_ENTITY_RE.test(value)) {
      hits.push({ path: keyPath, value });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => findEntitiesInValues(v, `${keyPath}[${i}]`, hits));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      findEntitiesInValues(v, keyPath ? `${keyPath}.${k}` : k, hits);
    }
  }
}

function checkFile(file) {
  const html = readFileSync(file, 'utf8');
  const rel = path.relative(SITE_DIR, file);
  const matches = [...html.matchAll(JSONLD_BLOCK_RE)];
  const errors = [];

  matches.forEach((m, blockIndex) => {
    const raw = m[1];
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      errors.push(`  bloque #${blockIndex}: JSON.parse falló — ${e.message}`);
      return;
    }
    const hits = [];
    findEntitiesInValues(parsed, '', hits);
    for (const hit of hits) {
      errors.push(`  bloque #${blockIndex}: entidad HTML en "${hit.path}" → ${JSON.stringify(hit.value)}`);
    }
  });

  return { rel, errors };
}

function main() {
  if (!statSync(SITE_DIR, { throwIfNoEntry: false })) {
    console.error(`No existe ${SITE_DIR} — ejecuta "npm run build" primero.`);
    process.exit(1);
  }

  const files = walk(SITE_DIR);
  let pagesWithErrors = 0;
  let totalErrors = 0;

  for (const file of files) {
    const { rel, errors } = checkFile(file);
    if (errors.length > 0) {
      pagesWithErrors += 1;
      totalErrors += errors.length;
      console.error(`✗ ${rel}`);
      for (const err of errors) console.error(err);
    }
  }

  console.log(`\nPáginas escaneadas: ${files.length}`);
  console.log(`Páginas con problemas en JSON-LD: ${pagesWithErrors}`);

  if (pagesWithErrors > 0) {
    process.exit(1);
  }
  console.log('OK — todos los bloques JSON-LD parsean y no contienen entidades HTML.');
}

main();
