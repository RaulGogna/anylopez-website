import { chromium, devices } from 'playwright';
import { mkdir } from 'fs/promises';

const url = process.argv[2] || 'https://anylopez.com/';
const out = process.argv[3] || './docs/migracion-screenshots';
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
for (const [name, ctxOpts] of [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['mobile', { ...devices['iPhone 13'] }],
]) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2000);
  const file = `${out}/wp-old-home-${name}.png`;
  await page.screenshot({ path: file, fullPage: true, timeout: 30000 });
  console.log(`✓ ${file}`);
  await ctx.close();
}
await browser.close();
