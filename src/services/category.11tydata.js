module.exports = {
  eleventyComputed: {
    permalink: (data) => data.catPage.url,
    l: (data) => data.catPage.l,
    lang: (data) => data.catPage.l.code,
    locale: (data) => data.catPage.l.locale,
    title: (data) => data.i18n[data.catPage.l.code][`svc-${data.catPage.cat.id}`].title,
    description: (data) => data.i18n[data.catPage.l.code][`svc-${data.catPage.cat.id}`].description,
  },
};
