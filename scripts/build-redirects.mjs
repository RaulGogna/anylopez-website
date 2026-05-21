#!/usr/bin/env node
// Reemplaza cada HTML en _site/ por una página de redirect 301-equivalente
// hacia https://anylopez.com<path>. Diseñado para publicarse en GitHub Pages
// tras la migración de dominio. Preserva el path del subdirectorio antiguo
// /anylopez-website/<path>/ → https://anylopez.com/<path>/.
//
// Uso: PATH_PREFIX=/anylopez-website/ node scripts/build-redirects.mjs
//
// Requiere que el build se haya hecho con PATH_PREFIX=/anylopez-website/
// para que las rutas físicas en _site/ coincidan con lo indexado por Google.

import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';

const SITE_DIR = './_site';
const NEW_DOMAIN = 'https://anylopez.com';
const PATH_PREFIX = (process.env.PATH_PREFIX || '/').replace(/\/$/, '');

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (entry.endsWith('.html')) yield full;
  }
}

function urlForFile(filePath) {
  // _site/index.html              → /
  // _site/about/index.html        → /about/
  // _site/en/services/index.html  → /en/services/
  // _site/404.html                → /404.html
  let rel = relative(SITE_DIR, filePath).split(sep).join('/');
  if (rel.endsWith('/index.html')) rel = rel.slice(0, -'index.html'.length);
  else if (rel === 'index.html') rel = '';
  return '/' + rel;
}

function redirectHtml(targetUrl) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Redirigiendo a anylopez.com</title>
<link rel="canonical" href="${targetUrl}">
<meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0; url=${targetUrl}">
<script>window.location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body>
<p>Esta página se ha mudado a <a href="${targetUrl}">${targetUrl}</a>.</p>
</body>
</html>
`;
}

let count = 0;
for (const file of walk(SITE_DIR)) {
  const path = urlForFile(file);
  const target = NEW_DOMAIN + path;
  writeFileSync(file, redirectHtml(target), 'utf8');
  count++;
}

console.log(`Generated ${count} redirect pages → ${NEW_DOMAIN} (PATH_PREFIX=${PATH_PREFIX || '/'})`);
