import { chromium, devices } from "playwright";

// tracking.js no emite en localhost: las páginas se sirven en anylopez.test (mapeado a
// 127.0.0.1) y se bloquea todo lo que no sea ese host, para que ninguna petición salga a la red.
export const HOST = "anylopez.test";

export const lanzarNavegador = () => chromium.launch({ args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });

// iPhone 13: 390×664 útiles (con la barra de Safari), táctil. `defaultBrowserType` no vale en newContext.
const { defaultBrowserType, ...iphone13 } = devices["iPhone 13"];
export const IPHONE_13 = iphone13;

// window.__eventos recoge lo que tracking.js y los parciales emiten a umami.track.
// `contexto` añade opciones de contexto (emulación de dispositivo) a las del viewport.
export async function nuevaPagina(browser, viewport, contexto = {}) {
  const context = await browser.newContext({ viewport, ...contexto });
  await context.route("**/*", (route) => (new URL(route.request().url()).hostname === HOST ? route.continue() : route.abort()));
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__eventos = [];
    window.umami = { track: (nombre, props) => window.__eventos.push({ nombre, props }) };
  });
  return page;
}

export const cerrar = (page) => page.context().close();

export const nuevaPaginaIphone = (browser) => nuevaPagina(browser, IPHONE_13.viewport, IPHONE_13);
