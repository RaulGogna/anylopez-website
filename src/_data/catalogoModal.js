const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const langs = require("./langs.json");

// El JSON lleva solo lo que js/treatment-modal.js lee de `trat.` y de `cat.`: la lista sale
// del propio JS, así que añadir una lectura allí la añade aquí sin tocar nada más.
const modalJs = readFileSync(join(__dirname, "../../js/treatment-modal.js"), "utf8");
const camposLeidos = (variable) => [...new Set([...modalJs.matchAll(new RegExp(`\\b${variable}\\.(\\w+)`, "g"))].map((m) => m[1]))];
const CAMPOS_TRATAMIENTO = camposLeidos("trat");
const CAMPOS_CATEGORIA = ["id", ...camposLeidos("cat")];
const pick = (obj, campos) => Object.fromEntries(campos.map((c) => [c, obj[c]]));

module.exports = Object.fromEntries(
  langs.map(({ code }) => {
    const catalogo = require(`./catalogo/${code}.json`);
    const json = JSON.stringify({
      garantiaDefault: catalogo.garantiaDefault,
      categorias: catalogo.categorias.map((c) => pick(c, CAMPOS_CATEGORIA)),
      tratamientos: catalogo.tratamientos.map((t) => pick(t, CAMPOS_TRATAMIENTO)),
    });
    // El sufijo ?v= evita que el JSON se quede un mes en caché tras cambiar el catálogo (ver src/.htaccess).
    const version = createHash("md5").update(json).digest("hex").slice(0, 8);
    return [code, { json, version }];
  })
);
