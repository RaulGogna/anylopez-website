// Alias temporal durante la Fase 2 del refactor i18n: las plantillas aun
// consumen el global `tratamientos`. Se elimina al unificar las plantillas
// (que pasan a usar catalogo[l.code]).
module.exports = require("./catalogo/es.json");
