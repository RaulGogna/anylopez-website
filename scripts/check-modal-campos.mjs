/**
 * js/treatment-modal.js solo recibe del catálogo los campos de src/_data/catalogoModalCampos.json.
 * Si el JS lee de `trat`/`t` (tratamiento) o de `cat`/`c` (categoría) un campo que no está en la lista,
 * el modal lo pintaría vacío sin avisar: aquí el build falla antes.
 *
 * Analiza el fuente (sin comentarios ni cadenas): lecturas `x.campo`, `x?.campo` y desestructuración
 * `const { campo } = x`. Un acceso `trat[...]` no se puede analizar y también falla.
 *
 * Uso: node scripts/check-modal-campos.mjs   (corre dentro de `npm run build`)
 */
import { readFileSync } from "node:fs";

const CAMPOS = JSON.parse(readFileSync("src/_data/catalogoModalCampos.json", "utf8"));
const VARIABLES = { trat: "tratamiento", t: "tratamiento", cat: "categoria", c: "categoria" };

const codigo = readFileSync("js/treatment-modal.js", "utf8").replace(
  /\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g,
  ""
);

const leidos = new Set();
for (const [, variable, campo] of codigo.matchAll(/(?<![\w.$])(trat|cat|t|c)\??\.(\w+)/g)) leidos.add(`${variable}.${campo}`);
for (const [, nombres, variable] of codigo.matchAll(/\{([^{}]*)\}\s*=\s*(trat|cat|t|c)\b/g))
  for (const n of nombres.split(",")) if (n.trim()) leidos.add(`${variable}.${n.split(/[:=]/)[0].trim()}`);

const fallos = [...leidos]
  .filter((lectura) => !CAMPOS[VARIABLES[lectura.split(".")[0]]].includes(lectura.split(".")[1]))
  .map((lectura) => `treatment-modal.js lee ${lectura}, que no está en «${VARIABLES[lectura.split(".")[0]]}» de catalogoModalCampos.json`);
for (const variable of ["trat", "cat"])
  if (new RegExp(`(?<![\\w.$])${variable}\\s*\\[`).test(codigo)) fallos.push(`treatment-modal.js accede a ${variable}[...]: no se puede comprobar contra la lista`);

if (fallos.length) {
  console.error(`check-modal-campos: FALLA\n- ${fallos.join("\n- ")}`);
  process.exit(1);
}
console.log(`check-modal-campos: OK (${leidos.size} lecturas: ${[...leidos].sort().join(", ")})`);
