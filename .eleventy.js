module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  eleventyConfig.addFilter("byCategory", (treatments, categoryId) =>
    treatments.filter((t) => t.categoria === categoryId)
  );

  eleventyConfig.addFilter("startsWith", (str, prefix) =>
    typeof str === "string" && str.startsWith(prefix)
  );

  return {
    pathPrefix: "/anylopez-website/",
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
