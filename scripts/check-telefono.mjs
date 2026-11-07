/**
 * Ningún teléfono español del `_site` construido es distinto de los de `src/_data/site.json`
 * (claves `phone*E164`). Cubre texto, `href`, `data-event-props` y JSON-LD, con o sin +34 y con
 * espacios, puntos o guiones. Un número escrito a mano y desfasado, o un cambio en site.json que
 * no llega a un texto corrido, rompe el build en vez de publicarse.
 *
 * Uso: node scripts/check-telefono.mjs   (sobre un `_site` ya construido; corre dentro de `npm run build`)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SITE = "_site";
const EXTENSIONES = /\.(html|js|json|txt|xml|css|webmanifest)$/;

const site = JSON.parse(readFileSync("src/_data/site.json", "utf8"));
const permitidos = new Set(
  Object.entries(site)
    .filter(([clave]) => /^phone\d*E164$/.test(clave))
    .map(([, valor]) => valor.replace(/^34/, ""))
);

const SEP = String.raw`(?:[ .\- ]|&nbsp;)?`;
const TELEFONO = new RegExp(
  String.raw`(?<![\w.])(?:(?:\+|00)?34${SEP})?[6-9]\d{2}${SEP}(?:\d{3}${SEP}\d{3}|\d{2}${SEP}\d{2}${SEP}\d{2})(?!\d)`,
  "g"
);

const ficheros = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    return e.isDirectory() ? ficheros(ruta) : EXTENSIONES.test(e.name) ? [ruta] : [];
  });

const nacional = (texto) => texto.replace(/\D/g, "").replace(/^(?:00)?34(?=\d{9}$)/, "");

const fallos = [];
const rutas = ficheros(SITE);
for (const ruta of rutas)
  for (const [encontrado] of readFileSync(ruta, "utf8").matchAll(TELEFONO))
    if (!permitidos.has(nacional(encontrado))) fallos.push(`${ruta}: «${encontrado}»`);

if (fallos.length) {
  console.error(`check-telefono: FALLA, teléfonos que no están en site.json\n- ${fallos.join("\n- ")}`);
  process.exit(1);
}
console.log(`check-telefono: OK (${rutas.length} ficheros, ${permitidos.size} teléfonos permitidos)`);
