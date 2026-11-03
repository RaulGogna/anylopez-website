import { chromium, devices } from "playwright";

// tracking.js no emite en localhost: las páginas se sirven en anylopez.test (mapeado a
// 127.0.0.1) y se bloquea todo lo que no sea ese host, para que ninguna petición salga a la red.
export const HOST = "anylopez.test";

export const lanzarNavegador = () => chromium.launch({ args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });

// iPhone 13: 390×664 útiles (con la barra de Safari), táctil. `defaultBrowserType` no vale en newContext.
const { defaultBrowserType, ...iphone13 } = devices["iPhone 13"];

// window.__eventos recoge lo que tracking.js y los parciales emiten a umami.track.
async function paginaConContexto(browser, opciones) {
  const context = await browser.newContext(opciones);
  await context.route("**/*", (route) => (new URL(route.request().url()).hostname === HOST ? route.continue() : route.abort()));
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__eventos = [];
    window.umami = { track: (nombre, props) => window.__eventos.push({ nombre, props }) };
  });
  return page;
}

export const nuevaPagina = (browser, viewport) => paginaConContexto(browser, { viewport });
export const nuevaPaginaIphone = (browser) => paginaConContexto(browser, iphone13);

export const cerrar = (page) => page.context().close();

// Las secciones con `content-visibility: auto` miden fuera de pantalla su tamaño de reserva, no el real.
export const forzarVisible = (page) => page.addStyleTag({ content: "*{content-visibility:visible !important}" });
