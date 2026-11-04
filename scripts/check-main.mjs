/**
 * Cada HTML de `_site` tiene exactamente un <main>, y dentro no hay cabecera, barra móvil ni pie.
 * Un segundo <main> (p. ej. el de una plantilla que ya lo traía) invalida el landmark.
 *
 * Uso: node scripts/check-main.mjs   (sobre un `_site` ya construido; corre dentro de `npm run build`)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SITE = "_site";
const FUERA_DE_MAIN = ["site-header", "mobile-bar", "site-footer"];

const htmls = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    return e.isDirectory() ? htmls(ruta) : e.name.endsWith(".html") ? [ruta] : [];
  });

const fallos = [];
const ficheros = htmls(SITE);
for (const f of ficheros) {
  const html = readFileSync(f, "utf8");
  const aperturas = [...html.matchAll(/<main[\s>]/g)].length;
  const cierres = [...html.matchAll(/<\/main>/g)].length;
  if (aperturas !== 1 || cierres !== 1) { fallos.push(`${f}: ${aperturas} <main> y ${cierres} </main>, se esperaba 1 de cada`); continue; }
  const dentro = html.slice(html.search(/<main[\s>]/), html.indexOf("</main>"));
  for (const clase of FUERA_DE_MAIN)
    if (new RegExp(`class="[^"]*\\b${clase}\\b`).test(dentro)) fallos.push(`${f}: «${clase}» queda dentro de <main>`);
}

if (fallos.length) {
  console.error(`check-main: FALLA\n- ${fallos.join("\n- ")}`);
  process.exit(1);
}
console.log(`check-main: OK (${ficheros.length} HTML)`);
