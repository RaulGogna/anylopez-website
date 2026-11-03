import { chromium } from "playwright";

// tracking.js no emite en localhost: las páginas se sirven en anylopez.test (mapeado a
// 127.0.0.1) y se bloquea todo lo que no sea ese host, para que ninguna petición salga a la red.
export const HOST = "anylopez.test";

export const lanzarNavegador = () => chromium.launch({ args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });

// window.__eventos recoge lo que tracking.js y los parciales emiten a umami.track.
export async function nuevaPagina(browser, viewport) {
  const context = await browser.newContext({ viewport });
  await context.route("**/*", (route) => (new URL(route.request().url()).hostname === HOST ? route.continue() : route.abort()));
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__eventos = [];
    window.umami = { track: (nombre, props) => window.__eventos.push({ nombre, props }) };
  });
  return page;
}

export const cerrar = (page) => page.context().close();
