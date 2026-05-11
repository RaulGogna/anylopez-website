// Mide alturas steady-state de <section> en mobile Moto G4 (DPR 3).
// Usa Playwright para emular el viewport, espera networkidle + scroll completo
// para que: JS reveal + font swap + lazy images terminen → altura final estable.
// El resultado sirve para calibrar `contain-intrinsic-size` sin generar CLS.
//
// Uso:
//   node scripts/measure-sections.mjs [url] [selector?]
//   Default url:      http://localhost:8080/anylopez-website/
//   Default selector: section[class]
//
// Salida: tabla con className → height(px), copiable a CSS.

import { chromium, devices } from 'playwright';

const url = process.argv[2] || 'http://localhost:8080/anylopez-website/';
const selector = process.argv[3] || 'section[class]';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['Moto G4'] });
const page = await ctx.newPage();

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Scroll al final y vuelta — fuerza JS-reveal, font-swap y lazy images a resolverse
await page.evaluate(async () => {
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y <= h; y += 400) {
    window.scrollTo(0, y);
    await new Promise((r) => requestAnimationFrame(r));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 500));
});
await page.waitForTimeout(800);

const data = await page.$$eval(selector, (els) =>
  els.map((el) => ({
    className: el.className,
    height: Math.round(el.getBoundingClientRect().height),
  }))
);

console.log('\nSteady-state heights (Moto G4 viewport):\n');
console.log('  Class                              | Height (px)');
console.log('  ---------------------------------- | -----------');
data.forEach((d) =>
  console.log(`  ${d.className.padEnd(34)} | ${String(d.height).padStart(11)}`)
);
console.log('\n-- CSS-ready --\n');
data.forEach((d) => {
  const cls = d.className.split(' ').slice(-1)[0];
  console.log(`.${cls.padEnd(28)} { contain-intrinsic-size: auto ${d.height}px; }`);
});

await browser.close();
