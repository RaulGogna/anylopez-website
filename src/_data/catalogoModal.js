const { createHash } = require("node:crypto");
const langs = require("./langs.json");

// Solo lo que lee js/treatment-modal.js: el resto del catálogo no viaja al navegador.
const CAMPOS_TRATAMIENTO = [
  "slug", "categoria", "imagen", "nombre", "paraQuien", "descripcion", "duracion",
  "beneficios", "comoFunciona", "precios", "packDestacado", "idealPara", "recomendaciones",
];
const pick = (obj, campos) => Object.fromEntries(campos.map((c) => [c, obj[c]]));

module.exports = Object.fromEntries(
  langs.map(({ code }) => {
    const catalogo = require(`./catalogo/${code}.json`);
    const json = JSON.stringify({
      garantiaDefault: catalogo.garantiaDefault,
      categorias: catalogo.categorias.map((c) => pick(c, ["id", "nombre"])),
      tratamientos: catalogo.tratamientos.map((t) => pick(t, CAMPOS_TRATAMIENTO)),
    });
    // El sufijo ?v= evita que el JSON se quede un mes en caché tras cambiar el catálogo (ver src/.htaccess).
    const version = createHash("md5").update(json).digest("hex").slice(0, 8);
    return [code, { json, version }];
  })
);
