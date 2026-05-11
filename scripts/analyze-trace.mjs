// Analiza un trace de Chrome DevTools (output de perf-trace.mjs).
// Resume: dónde se va el tiempo de main thread, qué eventos dominan,
// forced reflows, recalc styles costosos, layouts top 10.

import { readFileSync } from 'fs';

const traceFile = process.argv[2] || './trace-home.json';
const raw = JSON.parse(readFileSync(traceFile, 'utf8'));
const events = raw.traceEvents || raw;
console.log(`Eventos cargados: ${events.length}`);

// Filtrar por categoría devtools.timeline
const tl = events.filter(e => (e.cat||'').includes('devtools.timeline') || (e.cat||'').includes('blink.user_timing'));
console.log(`Eventos timeline: ${tl.length}`);

// Agrupar por nombre y sumar duración (X events tienen dur en microsegundos)
const sumByName = new Map();
for (const e of tl) {
  if (e.ph !== 'X' || !e.dur) continue;
  const k = e.name;
  sumByName.set(k, (sumByName.get(k) || 0) + e.dur);
}

console.log('\n=== Top 20 categorías por tiempo total (ms) ===');
[...sumByName.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([k,v]) => {
  console.log('  ', (v/1000).toFixed(1).padStart(8), 'ms  ', k);
});

// Eventos de Layout / UpdateLayoutTree top 10
const layouts = tl.filter(e => e.ph==='X' && e.dur && (e.name==='Layout' || e.name==='UpdateLayoutTree' || e.name==='UpdateLayout'))
                  .sort((a,b)=>b.dur-a.dur).slice(0,15);
console.log('\n=== Top 15 Layout/UpdateLayoutTree events (ms) ===');
layouts.forEach(e => {
  const a = e.args || {};
  const elements = a.beginData?.elementCount ?? a.elementCount ?? '?';
  const dirty = a.beginData?.dirtyObjects ?? '?';
  const partial = a.beginData?.partialLayout ?? '?';
  console.log('  ', (e.dur/1000).toFixed(1).padStart(7), 'ms ', e.name.padEnd(20), 'elements=', elements, 'partial=', partial);
});

// ParseAuthorStyleSheet costosos
const parseCSS = tl.filter(e => e.ph==='X' && e.dur && e.name==='ParseAuthorStyleSheet')
                   .sort((a,b)=>b.dur-a.dur).slice(0,5);
console.log('\n=== Top ParseAuthorStyleSheet (ms) ===');
parseCSS.forEach(e => console.log('  ', (e.dur/1000).toFixed(1), 'ms  url:', e.args?.data?.styleSheetUrl?.slice(0,80) || '(inline)'));

// Recalcular estilos
const recalc = tl.filter(e => e.ph==='X' && e.dur && (e.name==='ScheduleStyleRecalculation' || e.name==='RecalcStyle' || e.name==='UpdateLayoutTree'))
                 .sort((a,b)=>b.dur-a.dur).slice(0,15);
console.log('\n=== Top 15 RecalcStyle/UpdateLayoutTree (ms) ===');
recalc.forEach(e => {
  const els = e.args?.beginData?.elementCount ?? e.args?.elementCount ?? '?';
  console.log('  ', (e.dur/1000).toFixed(1).padStart(7), 'ms  ', e.name.padEnd(20), 'elements=', els);
});

// Tareas largas (RunTask > 50ms)
const runTask = tl.filter(e => e.ph==='X' && e.dur && (e.name==='RunTask' || e.name==='Task') && e.dur > 50000)
                  .sort((a,b)=>b.dur-a.dur).slice(0,10);
console.log('\n=== Long RunTask (>50ms), top 10 ===');
runTask.forEach(e => console.log('  ', (e.dur/1000).toFixed(1).padStart(7), 'ms at', (e.ts/1000).toFixed(0), 'ms'));

// Forced reflows (Layout dentro de Function event)
console.log('\n=== Resumen ejecutivo ===');
const total = [...sumByName.values()].reduce((a,b)=>a+b,0)/1000;
const layoutTotal = (sumByName.get('Layout')||0)/1000;
const recalcTotal = (sumByName.get('UpdateLayoutTree')||0)/1000;
const parseHTML = (sumByName.get('ParseHTML')||0)/1000;
const parseCSSt = (sumByName.get('ParseAuthorStyleSheet')||0)/1000;
const paint = (sumByName.get('Paint')||0)/1000;
console.log(`Total timeline:        ${total.toFixed(0)} ms`);
console.log(`Layout (reflow):       ${layoutTotal.toFixed(0)} ms`);
console.log(`UpdateLayoutTree:      ${recalcTotal.toFixed(0)} ms`);
console.log(`ParseAuthorStyleSheet: ${parseCSSt.toFixed(0)} ms`);
console.log(`ParseHTML:             ${parseHTML.toFixed(0)} ms`);
console.log(`Paint:                 ${paint.toFixed(0)} ms`);
