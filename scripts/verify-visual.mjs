// Verifica CLS y screenshots de scroll en mobile Moto G4.
// Útil tras aplicar `content-visibility:auto` o cambios que afecten layout.
//
// Uso: node scripts/verify-visual.mjs [url] [out-prefix?]
//   Default url:        http://localhost:8080/anylopez-website/
//   Default out-prefix: ./visual
//
// Genera <prefix>-fold.png, <prefix>-mid.png, <prefix>-bottom.png
// e imprime CLS total y top shifts.

import { chromium, devices } from 'playwright';

const url = process.argv[2] || 'http://localhost:8080/anylopez-website/';
const prefix = process.argv[3] || './visual';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['Moto G4'] });
const page = await ctx.newPage();

await page.addInitScript(() => {
  window.__shifts = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.hadRecentInput) window.__shifts.push({ value: e.value, ts: e.startTime });
    }
  }).observe({ type: 'layout-shift', buffered: true });
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

await page.screenshot({ path: `${prefix}-fold.png`, fullPage: false });

const height = await page.evaluate(() => document.documentElement.scrollHeight);
await page.evaluate(async (h) => {
  for (let y = 0; y <= h; y += 600) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 400));
  }
}, height);

await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
await page.waitForTimeout(500);
await page.screenshot({ path: `${prefix}-mid.png`, fullPage: false });

await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(500);
await page.screenshot({ path: `${prefix}-bottom.png`, fullPage: false });

const shifts = await page.evaluate(() => window.__shifts);
const total = shifts.reduce((s, x) => s + x.value, 0);
const top = shifts.sort((a, b) => b.value - a.value).slice(0, 5);

console.log(`\nCLS total: ${total.toFixed(4)}  (target <0.1, ideal <0.05)`);
console.log(`Shifts capturados: ${shifts.length}`);
if (top.length) {
  console.log('\nTop 5 shifts:');
  top.forEach((s, i) =>
    console.log(`  ${i + 1}. value=${s.value.toFixed(4)} @ t=${Math.round(s.ts)}ms`)
  );
}
console.log(`\nScreenshots: ${prefix}-fold.png · ${prefix}-mid.png · ${prefix}-bottom.png`);

await browser.close();
