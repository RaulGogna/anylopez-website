/**
 * Capturas de un idioma a varios anchos, para mirarlas.
 *
 * Los probes de overflow no ven un hero descuadrado, un titular que tapa una
 * foto o una barra inferior apretada: eso solo se ve en la imagen. En el árabe,
 * el fallo del hero no lo detectó ningún script.
 *
 * Uso: node scripts/shots-lang.mjs <lang|""> [carpeta-salida]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const raw = process.argv[2] ?? "";
function normalizePrefix(r) {
  if (!r || r === "es") return "";
  let v = String(r).replace(/\\/g, "/").replace(/\/$/, "");
  if (/^[A-Za-z]:/.test(v) || v.includes("Git/")) v = v.split("/").pop();
  return !v || v === "es" ? "" : "/" + v.replace(/^\/+/, "");
}
const PREFIX = normalizePrefix(raw);
const TAG = PREFIX.replace("/", "") || "es";
const OUT = process.argv[3] || `C:/Users/RAL~1/AppData/Local/Temp/claude/C--Users-Ra-l-Documents-proyectos-claude-ai/54911c53-ba50-4bd3-b773-06c9b35b2f74/scratchpad/shots`;
const BASE = "http://localhost:8087";

mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["home", "/"],
  ["services", "/services/"],
  ["radiofrecuencia", "/radiofrecuencia/"],
  ["contact", "/contact/"],
];
const WIDTHS = [375, 768];

const b = await chromium.launch();
for (const w of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  for (const [name, path] of PAGES) {
    await p.goto(BASE + PREFIX + path, { waitUntil: "networkidle" });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(700);

    // El hero, SIN scrollear antes. Bajar al fondo para asentar el lazy-load
    // y volver no funciona: la página crece al cargar y el navegador no
    // devuelve el scroll a 0 (se midió scrollY=3626 en la home a 768), así que
    // la "captura del hero" salía por la mitad del documento.
    const y = await p.evaluate(() => window.scrollY);
    if (y > 2) console.log(`   ⚠️ ${path} no está arriba (scrollY=${y})`);
    const file = `${OUT}/${TAG}-${name}-${w}.png`;
    await p.screenshot({ path: file });
    console.log(file);

    // Y la página entera, ya con el lazy-load asentado, para ver lo de abajo.
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(1200);
    const full = `${OUT}/${TAG}-${name}-${w}-full.png`;
    await p.screenshot({ path: full, fullPage: true });
  }
  await ctx.close();
}
await b.close();
