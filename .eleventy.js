module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("css");

  return {
    pathPrefix: "/anylopez-website/",
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
