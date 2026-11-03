// Medidas a 390×664 en emulación de iPhone 13 (ver IPHONE_13 en browser.mjs).
export const TACTIL = 44;

// Enlaces de texto en párrafos, migas y pie: no son objetivos táctiles que medir.
export const EXCLUIDOS_TACTIL = ["p a", ".breadcrumb", "footer"];

// Dónde acaba el primer elemento `selector` y dónde empieza la barra móvil, en px de viewport sin
// desplazar. El elemento cabe si `fondo <= barra`.
export const primeraPantalla = (page, selector) =>
  page.evaluate((sel) => ({
    fondo: document.querySelector(sel).getBoundingClientRect().bottom,
    barra: document.querySelector(".mobile-bar").getBoundingClientRect().top,
  }), selector);

// Controles interactivos visibles dentro de `ambitos` con menos de TACTIL px de alto, salvo los
// que caen en EXCLUIDOS_TACTIL. Devuelve «selector (alto px)».
export const controlesPequenos = (page, ambitos) =>
  page.evaluate(([zonas, excluidos, min]) => {
    const sel = "a[href], button, summary, input, select, textarea, [role='button'], [tabindex]:not([tabindex='-1'])";
    const nombre = (el) => `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).trim().split(/\s+/)[0] : ""}`;
    const pequenos = new Set();
    for (const zona of zonas) {
      for (const el of document.querySelectorAll(`${zona} :is(${sel})`)) {
        const alto = el.getBoundingClientRect().height;
        if (!alto || el.closest(excluidos.join(","))) continue;
        if (alto < min - 0.5) pequenos.add(`${nombre(el)} (${Math.round(alto)} px)`);
      }
    }
    return [...pequenos];
  }, [ambitos, EXCLUIDOS_TACTIL, TACTIL]);

// Abre con un toque el selector de idioma y el menú de la cabecera, mide sus enlaces y los cierra.
export async function controlesPequenosDeLaCabecera(page) {
  const salida = [];
  for (const [boton, zona] of [["#langBtn", "#langDropdown"], ["#menuToggle", "#navMenu"]]) {
    await page.tap(boton);
    salida.push(...(await controlesPequenos(page, [zona])));
    await page.tap(boton);
  }
  return salida;
}
