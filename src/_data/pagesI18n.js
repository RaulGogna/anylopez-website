// Expande pages.json × langs.json en URLs y priorities por idioma.
// Regla del sitio: ES es el canónico (priority tal cual); el resto baja 0.1.
const langs = require("./langs.json");
const pages = require("./pages.json");

function minusTenth(priority) {
  return (Math.round((parseFloat(priority) - 0.1) * 100) / 100)
    .toFixed(2)
    .replace(/0$/, "")
    .replace(/\.$/, "");
}

module.exports = pages.map((p) => {
  const urls = {};
  const priority = {};
  for (const l of langs) {
    if (p.only && !p.only.includes(l.code)) continue;
    urls[l.code] = l.prefix + p.path;
    priority[l.code] = l.code === "es" ? p.priority : minusTenth(p.priority);
  }
  return {
    key: p.key,
    path: p.path,
    changefreq: p.changefreq,
    urls,
    priority,
    multilang: Object.keys(urls).length > 1,
  };
});
