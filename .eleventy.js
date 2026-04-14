module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("js");

  return {
    pathPrefix: "/anylopez-website/",
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
