/**
 * ¿Existe la página a la que apunta cada enlace interno?
 *
 * `check-lang-links.mjs` comprueba que el enlace lleva el prefijo de idioma
 * correcto. Son cosas distintas: `/uk/privacidad/` puede tener el prefijo bien
 * y ser un 404 si esa página no se genera. Este script resuelve cada href
 * contra el `_site` construido y exige que haya archivo detrás.
 *
 * Uso: node scripts/check-link-targets.mjs   (requiere _site construido)
 */
import { readdirSync, statSync, readFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = fileURLToPath(new URL("../_site", import.meta.url));
const DESTINO = fileURLToPath(new URL("../link-targets-report.txt", import.meta.url));
rmSync(DESTINO, { force: true });

if (!existsSync(SITE)) {
  console.error('No existe _site — ejecuta "npx @11ty/eleventy" primero.');
  process.exit(1);
}

function htmls(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) htmls(p, acc);
    else if (e.endsWith(".html")) acc.push(p);
  }
  return acc;
}

const paginas = htmls(SITE);
if (paginas.length === 0) {
  console.error("0 páginas escaneadas: el verde no significaría nada.");
  process.exit(1);
}

const A_HREF = /<a\b[^>]*\bhref="([^"]+)"/gi;
const roto = [];
let comprobados = 0;
const noExiste = new Set();

for (const f of paginas) {
  const html = readFileSync(f, "utf8");
  for (const m of html.matchAll(A_HREF)) {
    let href = m[1].trim();
    if (/^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) continue;
    href = href.replace(/^https?:\/\/anylopez\.com/i, "");
    if (!href.startsWith("/")) continue;

    const limpio = href.split("#")[0].split("?")[0];
    if (!limpio || limpio === "/") {
      comprobados++;
      if (!existsSync(join(SITE, "index.html"))) roto.push([f, href, "falta /index.html"]);
      continue;
    }

    comprobados++;
    const candidatos = limpio.endsWith("/")
      ? [join(SITE, limpio, "index.html")]
      : [join(SITE, limpio), join(SITE, limpio + ".html"), join(SITE, limpio, "index.html")];

    if (!candidatos.some((c) => existsSync(c))) {
      roto.push([relative(SITE, f), href, "sin destino en _site"]);
      noExiste.add(href);
    }
  }
}

const lineas = [
  `Páginas escaneadas: ${paginas.length}`,
  `Enlaces internos resueltos: ${comprobados}`,
  `Destinos distintos que no existen: ${noExiste.size}`,
  "",
];
if (roto.length) {
  lineas.push(`ENLACES ROTOS: ${roto.length}`);
  for (const [p, h, motivo] of roto.slice(0, 60)) lineas.push(`   ✗ ${p}  ->  ${h}  (${motivo})`);
  if (roto.length > 60) lineas.push(`   … y ${roto.length - 60} más`);
} else {
  lineas.push("OK — todos los enlaces internos tienen una página detrás.");
}

writeFileSync(DESTINO, lineas.join("\n"), "utf8");
console.log(`Informe en link-targets-report.txt · ${comprobados} enlaces, ${roto.length} rotos`);
process.exit(roto.length ? 1 : 0);
