// Encuentra qué disparó los Layout gigantes:
// - Busca eventos justo antes de cada Layout >500ms
// - Identifica scripts/funciones en la stack
// - Reporta forced reflows (Layout sincrónico dentro de FunctionCall)

import { readFileSync } from 'fs';

const traceFile = process.argv[2] || './trace-home.json';
const raw = JSON.parse(readFileSync(traceFile, 'utf8'));
const events = raw.traceEvents || raw;

// Encontrar t0 = TracingStartedInPage / navigationStart
const nav = events.find(e => e.name === 'navigationStart' || e.name === 'TracingStartedInBrowser');
const t0 = nav?.ts || events[0].ts;

const layouts = events.filter(e =>
  e.ph === 'X' && e.dur > 500_000 && e.name === 'Layout'
).sort((a,b) => a.ts - b.ts);

console.log(`\n=== ${layouts.length} Layouts > 500ms ===\n`);

for (const L of layouts) {
  const startMs = (L.ts - t0) / 1000;
  const endMs = startMs + L.dur/1000;
  console.log(`\n>>> Layout ${(L.dur/1000).toFixed(0)}ms — desde ${startMs.toFixed(0)}ms hasta ${endMs.toFixed(0)}ms`);
  console.log('   args:', JSON.stringify(L.args).slice(0, 300));

  const windowBefore = 200_000;
  const before = events.filter(e =>
    e.ph === 'X' && e.dur && e.ts < L.ts && e.ts > L.ts - windowBefore
    && e.tid === L.tid
    && e.name !== 'RunTask'
  ).sort((a,b) => b.dur - a.dur).slice(0, 10);

  console.log('   --- Top 10 eventos en los 200ms previos:');
  before.forEach(e => {
    const rel = ((e.ts - L.ts) / 1000).toFixed(1);
    const dur = (e.dur/1000).toFixed(1);
    const extra = e.name === 'FunctionCall'
      ? ` ${e.args?.data?.functionName || ''} ${(e.args?.data?.url || '').slice(-50)}`
      : e.name === 'EvaluateScript'
      ? ` ${(e.args?.data?.url || '').slice(-60)}`
      : e.name === 'ResourceFinish' || e.name === 'ResourceReceiveResponse'
      ? ` ${(e.args?.data?.url || '').slice(-60)}`
      : '';
    console.log(`     ${rel.padStart(7)}ms  ${dur.padStart(7)}ms  ${e.name.padEnd(28)}${extra}`);
  });

  const enclosing = events.find(e =>
    e.ph === 'X' && e.dur && e.tid === L.tid &&
    e.ts < L.ts && e.ts + e.dur > L.ts + L.dur &&
    (e.name === 'FunctionCall' || e.name === 'EvaluateScript' || e.name === 'RunMicrotasks' || e.name === 'EventDispatch' || e.name === 'TimerFire')
  );
  if (enclosing) {
    console.log(`   --- ENCLOSING ${enclosing.name} ${(enclosing.dur/1000).toFixed(0)}ms`);
    console.log('       args:', JSON.stringify(enclosing.args).slice(0, 250));
  } else {
    console.log('   --- No enclosing FunctionCall/EventDispatch → Layout es del browser propio, no de JS');
  }
}

console.log('\n=== Resumen forced reflows (Layout dentro de Script) ===');
const xLayouts = events.filter(e => e.ph === 'X' && e.dur && e.name === 'Layout');
let forcedCount = 0;
let forcedTotal = 0;
for (const L of xLayouts) {
  const enc = events.find(e =>
    e.ph === 'X' && e.dur && e.tid === L.tid &&
    e.ts < L.ts && e.ts + e.dur > L.ts + L.dur &&
    (e.name === 'FunctionCall' || e.name === 'EvaluateScript')
  );
  if (enc) {
    forcedCount++;
    forcedTotal += L.dur;
  }
}
console.log(`Forced reflows (Layout dentro de JS): ${forcedCount}, total ${(forcedTotal/1000).toFixed(0)}ms`);
console.log(`Naturales (Layout fuera de JS):       ${xLayouts.length - forcedCount}, total ${((xLayouts.reduce((s,e)=>s+e.dur,0) - forcedTotal)/1000).toFixed(0)}ms`);
