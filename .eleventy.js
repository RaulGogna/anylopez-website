module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("js");

  eleventyConfig.addFilter("byCategory", (treatments, categoryId) =>
    treatments.filter((t) => t.categoria === categoryId)
  );

  return {
    pathPrefix: "/anylopez-website/",
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
