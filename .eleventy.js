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

  eleventyConfig.addFilter("startsWith", (str, prefix) =>
    typeof str === "string" && str.startsWith(prefix)
  );

  eleventyConfig.addFilter("bust", bustAsset);

  return {
    pathPrefix: process.env.PATH_PREFIX || "/",
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
