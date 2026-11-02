// Cada tratamiento del catalogo debe tener al menos un objetivo, ningun objetivo puede citar un slug
// que no exista, y todos los objetivos necesitan etiqueta en cada idioma: si no, el filtro del hub
// (services.njk) esconde tratamientos para siempre o pinta un boton vacio.
import { readFileSync } from 'node:fs';

const leer = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
const langs = leer('src/_data/langs.json');
const objetivos = leer('src/_data/catalogo/objetivos.json');
const slugs = new Set(leer('src/_data/catalogo/es.json').tratamientos.map((t) => t.slug));

const fallos = [];
const cubiertos = new Set(objetivos.flatMap((o) => o.slugs));

for (const slug of slugs) if (!cubiertos.has(slug)) fallos.push(`tratamiento sin objetivo: ${slug}`);
for (const o of objetivos) {
  for (const slug of o.slugs) if (!slugs.has(slug)) fallos.push(`objetivo ${o.id} cita un slug inexistente: ${slug}`);
}
for (const { code } of langs) {
  const etiquetas = leer(`src/_data/i18n/${code}/services.json`).goals ?? {};
  for (const o of objetivos) if (!etiquetas[o.id]?.trim()) fallos.push(`objetivo ${o.id} sin etiqueta en ${code}`);
}

if (fallos.length) {
  console.error('check-objetivos: FALLA\n- ' + fallos.join('\n- '));
  process.exit(1);
}
console.log(`check-objetivos: OK (${slugs.size} tratamientos, ${objetivos.length} objetivos, ${langs.length} idiomas)`);
