const { createHash } = require("node:crypto");
const langs = require("./langs.json");
const CAMPOS = require("./catalogoModalCampos.json");

// Solo lo que lee js/treatment-modal.js; scripts/check-modal-campos.mjs falla en el build si el JS lee algo que no está en la lista.
const pick = (obj, campos) => Object.fromEntries(campos.map((c) => [c, obj[c]]));

module.exports = Object.fromEntries(
  langs.map(({ code }) => {
    const catalogo = require(`./catalogo/${code}.json`);
    const json = JSON.stringify({
      garantiaDefault: catalogo.garantiaDefault,
      categorias: catalogo.categorias.map((c) => pick(c, CAMPOS.categoria)),
      tratamientos: catalogo.tratamientos.map((t) => pick(t, CAMPOS.tratamiento)),
    });
    // El sufijo ?v= evita que el JSON se quede un mes en caché tras cambiar el catálogo (ver src/.htaccess).
    const version = createHash("md5").update(json).digest("hex").slice(0, 8);
    return [code, { json, version }];
  })
);
