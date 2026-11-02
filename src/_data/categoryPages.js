const langs = require("./langs.json");
const pagesI18n = require("./pagesI18n");
const { defaults, categories } = require("./serviceCategories.json");

module.exports = categories.flatMap((overrides) => {
  const cat = { ...defaults, ...overrides };
  const { urls } = pagesI18n.find((entry) => entry.key === cat.id);
  return langs.map((l) => ({ l, cat, url: urls[l.code] }));
});
