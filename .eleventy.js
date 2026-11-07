const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// Los assets se sirven con Cache-Control de 1 mes (ver src/.htaccess) y no llevan
// hash en el nombre: sin este sufijo, un cambio de CSS o JS tarda hasta 30 dias en
// llegar a quien ya visito la web.
const hashCache = new Map();

function bustAsset(publicUrl) {
  if (typeof publicUrl !== "string" || publicUrl.includes("?")) return publicUrl;
  if (hashCache.has(publicUrl)) return hashCache.get(publicUrl);

  const prefix = process.env.PATH_PREFIX || "/";
  const withoutPrefix =
    prefix !== "/" && publicUrl.startsWith(prefix)
      ? publicUrl.slice(prefix.length)
      : publicUrl;
  const rel = withoutPrefix.replace(/^\/+/, "");

  let result = publicUrl;
  for (const candidate of [path.join("src", rel), rel]) {
    try {
      const digest = crypto
        .createHash("md5")
        .update(fs.readFileSync(candidate))
        .digest("hex")
        .slice(0, 8);
      result = `${publicUrl}?v=${digest}`;
      break;
    } catch {
      // el asset no esta en esta ruta; probar la siguiente
    }
  }

  if (result === publicUrl) {
    console.warn(`[bust] asset no encontrado, se sirve sin versionar: ${publicUrl}`);
  }
  hashCache.set(publicUrl, result);
  return result;
}

// Pega la flecha final a la palabra anterior para que un botón no la deje sola en otra línea.
const glueArrow = (text) => text.replace(/\s+([→←])\s*$/, "\u00a0$1");

// Fuente unica: site.json guarda el E.164 sin "+"; todo formato visible se deriva de aqui.
const nationalParts = (e164) => /^(\d{2})(\d{3})(\d{3})(\d{3})$/.exec(e164).slice(1);

const PHONE_FORMATS = {
  phoneE164: (e164) => e164,
  phoneIntl: (e164) => `+${e164}`,
  phoneDigits: (e164) => nationalParts(e164).slice(1).join(""),
  phoneNational: (e164) => nationalParts(e164).slice(1).join(" "),
  phoneIntlSpaced: (e164) => `+${nationalParts(e164).join(" ")}`,
};

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/BingSiteAuth.xml": "BingSiteAuth.xml" });
  eleventyConfig.addPassthroughCopy({ "src/.htaccess": ".htaccess" });

  eleventyConfig.addFilter("byCategory", (treatments, categoryId) =>
    treatments.filter((t) => t.categoria === categoryId)
  );

  eleventyConfig.addFilter("glueArrow", glueArrow);

  eleventyConfig.addFilter("startsWith", (str, prefix) =>
    typeof str === "string" && str.startsWith(prefix)
  );

  // i18n: resuelve el objeto idioma a partir del code ('es' | 'en' | ...)
  eleventyConfig.addFilter("langByCode", (langs, code) =>
    langs.find((l) => l.code === code)
  );

  // i18n: entry de pagesI18n cuya URL (en cualquier idioma) coincide con la actual
  eleventyConfig.addFilter("entryByUrl", (entries, url) =>
    entries.find((e) => Object.values(e.urls).includes(url)) || null
  );

  eleventyConfig.addFilter("bust", bustAsset);

  for (const [name, format] of Object.entries(PHONE_FORMATS)) eleventyConfig.addFilter(name, format);
  eleventyConfig.addFilter("withPhone", (str, e164) =>
    str.replace(/\{(phone\w+)\}/g, (match, name) => PHONE_FORMATS[name]?.(e164) ?? match)
  );

  return {
    pathPrefix: process.env.PATH_PREFIX || "/",
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
