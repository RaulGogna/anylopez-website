/**
 * Verificación de layout y tipografía de un idioma servido.
 *
 * Deriva de verificadores-multiidioma/rtl-768.mjs (usado para el árabe) y añade
 * lo que el cirílico necesita y el árabe no: comprobar que los glifos se pintan
 * con la familia real y no con el fallback del sistema. Un woff2 que no trae el
 * subconjunto se ve "bien" en una captura y es otra tipografía.
 *
 * Uso:
 *   node scripts/check-lang-layout.mjs <prefijo> [ancho] [--base=http://localhost:8087]
 *   node scripts/check-lang-layout.mjs /ru 768
 *   node scripts/check-lang-layout.mjs ""  375     (español, referencia)
 */
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const PREFIX = (argv[0] ?? "").replace(/\/$/, "");
const W = Number(argv.find((a) => /^\d+$/.test(a)) || 768);
const BASE = (argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:8087").slice(7);

const SUFFIXES = [
  "/", "/about/", "/contact/", "/radiofrecuencia/", "/services/",
  "/services/limpiezas-faciales/", "/services/tratamientos-faciales/",
  "/services/lifting-antiaging/", "/services/inyectables/", "/services/corporal/",
  "/services/masajes/", "/services/estetica-decorativa/", "/services/depilacion/",
  "/privacidad/",
];
const PAGES = SUFFIXES.map((s) => `${PREFIX}${s}`);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: 1000 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();

const missing = [];
p.on("response", (r) => {
  if (r.url().includes("/assets/fonts/") && r.status() >= 400) missing.push(`${r.status()} ${r.url()}`);
});

const probe = () =>
  p.evaluate(() => {
    const de = document.documentElement;
    const over = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const st = getComputedStyle(el);
      if (st.position === "fixed" || st.visibility === "hidden" || st.display === "none") continue;
      if (r.right > de.clientWidth + 1 || r.left < -1) {
        const cls = el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
        over.push({ path: el.tagName.toLowerCase() + cls, left: Math.round(r.left), right: Math.round(r.right) });
      }
    }
    // Texto recortado por overflow hidden / nowrap: lo que parte botones y selects.
    const clipped = [];
    for (const el of document.querySelectorAll("button, a.btn, .btn, select, option, .badge, .chip, h1, h2, h3, nav a, .breadcrumb a, .breadcrumb span, label")) {
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") continue;
      if (el.scrollWidth > el.clientWidth + 1 && (st.overflow === "hidden" || st.textOverflow === "ellipsis" || st.whiteSpace === "nowrap")) {
        const cls = el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
        clipped.push(`${el.tagName.toLowerCase()}${cls} sw=${el.scrollWidth} cw=${el.clientWidth} "${(el.textContent || "").trim().slice(0, 40)}"`);
      }
    }
    return {
      docOverflow: de.scrollWidth - de.clientWidth,
      over: over.slice(0, 10),
      clipped: [...new Set(clipped)].slice(0, 8),
    };
  });

// ── PRUEBA POSITIVA del probe: debe detectar un overflow inyectado ───────────
await p.goto(BASE + (PREFIX || "") + "/", { waitUntil: "networkidle" });
const before = await probe();
await p.evaluate(() => {
  const d = document.createElement("div");
  d.id = "__probe";
  d.style.cssText = "width:3000px;height:10px;background:red";
  document.body.appendChild(d);
});
const after = await probe();
await p.evaluate(() => document.getElementById("__probe")?.remove());
const sane = after.docOverflow > before.docOverflow;
console.log(`PROBE SANITY @${W}px: sin inyección=${before.docOverflow} con inyección=${after.docOverflow} -> ${sane ? "OK detecta" : "FALLA — el probe no sirve"}`);
if (!sane) { await b.close(); process.exit(2); }
console.log("---");

let problems = 0;

for (const path of PAGES) {
  const resp = await p.goto(BASE + path, { waitUntil: "networkidle" });
  if (!resp || resp.status() !== 200) {
    console.log(`HTTP ${resp && resp.status()} :: ${path}`);
    problems++;
    continue;
  }
  // Asentar lazy-load, swap de fuentes y reveals por JS antes de medir.
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(700);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);
  await p.evaluate(() => document.fonts.ready);

  const r = await probe();

  const typo = await p.evaluate(() => {
    const g = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const c = getComputedStyle(e);
      return {
        fam: c.fontFamily.split(",")[0].replace(/['"]/g, ""),
        ratio: +(parseFloat(c.lineHeight) / parseFloat(c.fontSize)).toFixed(2),
      };
    };
    return { h1: g("h1"), h2: g("h2"), body: g("body") };
  });

  // ¿Se pinta con la familia real o con el fallback del sistema?
  //
  // Dos comprobaciones, porque ninguna basta sola:
  //  1. document.fonts.check() con el peso y estilo REALES del elemento. Con el
  //     descriptor por defecto (16px/400) da falsos positivos: /privacidad/ solo
  //     carga la cara 600 y la 400 figura como "unloaded".
  //  2. Medida de ancho real contra un fallback forzado. check() se fía del
  //     unicode-range declarado en el CSS, así que un woff2 que declara cirílico
  //     pero no trae los glifos pasaría igual. Si el ancho con la familia coincide
  //     con el del fallback, es que no se está usando la familia.
  const fonts = await p.evaluate(() => {
    const targets = [
      { sel: "h1", el: document.querySelector("h1") },
      { sel: "body", el: document.body },
    ].filter((t) => t.el);

    const out = [];
    for (const { sel, el } of targets) {
      const cs = getComputedStyle(el);
      const family = cs.fontFamily.split(",")[0].replace(/['"]/g, "");
      const sample = (el === document.body ? el.textContent : el.textContent || "").trim().slice(0, 40);
      if (!sample) continue;

      const covers = document.fonts.check(
        `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} "${family}"`,
        sample
      );

      const measure = (fam) => {
        const s = document.createElement("span");
        s.textContent = sample;
        s.style.cssText = `position:absolute;left:-9999px;white-space:pre;font-size:${cs.fontSize};font-weight:${cs.fontWeight};font-style:${cs.fontStyle};font-family:${fam}`;
        document.body.appendChild(s);
        const w = s.getBoundingClientRect().width;
        s.remove();
        return w;
      };
      const wReal = measure(`"${family}"`);
      const wFallback = measure(`"__NoSuchFont__ZZZ"`);

      out.push({
        sel, family, covers,
        sample: sample.slice(0, 22),
        usesFamily: Math.abs(wReal - wFallback) > 0.5,
        wReal: Math.round(wReal), wFallback: Math.round(wFallback),
      });
    }
    return out;
  });

  const tag = `${path}`;
  const bad = [];
  if (r.docOverflow > 1) bad.push(`OVERFLOW-X ${r.docOverflow}px  ${r.over.map((o) => o.path).join(", ")}`);
  if (r.clipped.length) bad.push(`CLIPPED (${r.clipped.length})\n      ${r.clipped.join("\n      ")}`);
  for (const f of fonts) {
    if (!f.usesFamily) {
      bad.push(`FUENTE FALLBACK en ${f.sel}: "${f.family}" mide igual que un fallback inexistente (${f.wReal}px vs ${f.wFallback}px) para "${f.sample}" — no se está usando la familia`);
    } else if (!f.covers) {
      bad.push(`FUENTE SIN COBERTURA en ${f.sel}: "${f.family}" no declara cubrir "${f.sample}"`);
    }
  }
  // El hero de la home usa line-height 1 a propósito; por debajo de eso sí es error.
  for (const [k, v] of Object.entries(typo)) {
    if (v && (v.ratio < 1 || v.ratio > 2.2)) bad.push(`LINE-HEIGHT raro en ${k}: ratio=${v.ratio} (${v.fam})`);
  }

  if (bad.length) {
    problems += bad.length;
    console.log(`❌ ${tag}`);
    for (const x of bad) console.log(`   ${x}`);
  } else {
    console.log(`✅ ${tag}  docOverflow=0  h1=${typo.h1?.fam}(${typo.h1?.ratio})  body=${typo.body?.fam}(${typo.body?.ratio})`);
  }
}

if (missing.length) {
  problems += missing.length;
  console.log(`\n❌ Fuentes que no cargaron (${missing.length}):`);
  for (const m of [...new Set(missing)]) console.log(`   ${m}`);
}

await b.close();
console.log(`\nTOTAL PROBLEMAS: ${problems}`);
process.exit(problems ? 1 : 0);
