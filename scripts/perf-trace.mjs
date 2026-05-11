// Chrome DevTools Performance trace · Playwright + CDP Tracing
// Uso: node scripts/perf-trace.mjs [url] [outfile]
// Default: http://localhost:8080/anylopez-website/ → ./trace-home.json
//
// Throttling: mobile Moto G4 viewport, CPU 4x slowdown, Slow 4G network.
// El JSON resultante se carga en DevTools → Performance → Load profile.

import { chromium, devices } from 'playwright';
import { writeFileSync } from 'fs';

const url = process.argv[2] || 'http://localhost:8080/anylopez-website/';
const out = process.argv[3] || './trace-home.json';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['Moto G4'] });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);

await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});

const traceEvents = [];
cdp.on('Tracing.dataCollected', (params) => {
  if (params.value) traceEvents.push(...params.value);
});
const traceComplete = new Promise((resolve) => {
  cdp.once('Tracing.tracingComplete', resolve);
});

await cdp.send('Tracing.start', {
  transferMode: 'ReportEvents',
  categories: [
    'devtools.timeline',
    'v8.execute',
    'disabled-by-default-devtools.timeline',
    'disabled-by-default-devtools.timeline.frame',
    'toplevel',
    'blink.console',
    'blink.user_timing',
    'latencyInfo',
    'disabled-by-default-devtools.timeline.stack',
    'disabled-by-default-v8.cpu_profiler',
    'disabled-by-default-v8.cpu_profiler.hires',
    'loading',
    'navigation',
  ].join(','),
});

const t0 = Date.now();
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
const wall = Date.now() - t0;

await cdp.send('Tracing.end');
await traceComplete;

writeFileSync(out, JSON.stringify({ traceEvents }));

const metrics = await page.evaluate(() => {
  const lcpList = performance.getEntriesByType('largest-contentful-paint');
  const lcp = lcpList[lcpList.length - 1];
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  const nav = performance.getEntriesByType('navigation')[0];
  return {
    LCP_ms: lcp ? Math.round(lcp.renderTime || lcp.startTime) : null,
    LCP_element: lcp?.element ? lcp.element.tagName + '.' + ((lcp.element.className||'').split(' ')[0]) : null,
    FCP_ms: fcp ? Math.round(fcp.startTime) : null,
    DCL_ms: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    load_ms: nav ? Math.round(nav.loadEventEnd) : null,
  };
});

console.log('--- Page metrics ---');
console.log(JSON.stringify(metrics, null, 2));
console.log(`Wall time: ${wall} ms`);
console.log(`Trace events: ${traceEvents.length}`);
console.log(`Trace saved: ${out}`);

await browser.close();
