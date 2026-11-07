/**
 * Ningún teléfono español del `_site` construido es distinto de los de `src/_data/site.json`
 * (claves `phone*E164`). Cubre texto, `href`, `data-event-props` y JSON-LD, con o sin +34, con
 * espacios, puntos o guiones, con el prefijo entre paréntesis «(656) 306 167», agrupado en 2-3-2-2
 * «65 630 61 67» y pegado a un `%20` dentro de una URL. Un número escrito a mano y desfasado, o un
 * cambio en site.json que no llega a un texto corrido, rompe el build en vez de publicarse.
 *
 * Uso: node scripts/check-telefono.mjs [carpeta]   (por defecto `_site`, ya construido; corre dentro de `npm run build`)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SITE = process.argv[2] ?? "_site";
const EXTENSIONES = /\.(html|js|json|txt|xml|css|webmanifest)$/;

const site = JSON.parse(readFileSync("src/_data/site.json", "utf8"));
const permitidos = new Set(
  Object.entries(site)
    .filter(([clave]) => /^phone\d*E164$/.test(clave))
    .map(([, valor]) => valor.replace(/^34/, ""))
);

const SEP = String.raw`(?:[ .\- ]|&nbsp;)?`;
const PREFIJO = String.raw`(?:(?:\+|00)?34${SEP})?`;
const TRES = String.raw`\(?[6-9]\d{2}\)?`;
const TELEFONO = new RegExp(
  String.raw`(?<![\w.])${PREFIJO}(?:${TRES}${SEP}(?:\d{3}${SEP}\d{3}|\d{2}${SEP}\d{2}${SEP}\d{2})|[6-9]\d${SEP}\d{3}${SEP}\d{2}${SEP}\d{2})(?!\d)`,
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
  // «%20» es un espacio escapado de una URL: sin esto, «…%20656306167» se leería como «20656306167».
  for (const [encontrado] of readFileSync(ruta, "utf8").replace(/%20/gi, " ").matchAll(TELEFONO))
    if (!permitidos.has(nacional(encontrado))) fallos.push(`${ruta}: «${encontrado}»`);

if (fallos.length) {
  console.error(`check-telefono: FALLA, teléfonos que no están en site.json\n- ${fallos.join("\n- ")}`);
  process.exit(1);
}
console.log(`check-telefono: OK (${rutas.length} ficheros, ${permitidos.size} teléfonos permitidos)`);
