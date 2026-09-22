// Verificacion del selector de idioma con banderas SVG (AnyLopez).
// Uso: node verify-flags.mjs
// Comprueba, en los 7 idiomas: que cada <use> del dropdown resuelve a un
// <symbol> existente y que el SVG renderizado tiene ancho/alto > 0. Tambien
// captura screenshots del selector abierto a 1280px y 375px, y comprueba
// que /ar/ muestra el globo (no una bandera) y que el layout RTL no solapa.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "flag-screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE = "http://localhost:8087";
const LANGS = [
  { code: "es", prefix: "" },
  { code: "en", prefix: "/en" },
  { code: "fr", prefix: "/fr" },
  { code: "de", prefix: "/de" },
  { code: "ar", prefix: "/ar" },
  { code: "ru", prefix: "/ru" },
  { code: "uk", prefix: "/uk" },
];

const EXPECTED_CODES = ["es", "en", "fr", "de", "ar", "ru", "uk"];

async function checkPage(browser, viewport, lang) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const url = `${BASE}${lang.prefix}/`;
  await page.goto(url, { waitUntil: "networkidle" });

  const btn = page.locator("#langBtn");
  await btn.click();
  await page.waitForTimeout(300);

  const dropdown = page.locator("#langDropdown");
  const isOpen = await dropdown.evaluate((el) => el.classList.contains("open"));

  // Recoge, para cada <use> dentro de #langDropdown y del boton, el id
  // referenciado, si el symbol existe en el documento, y el bounding box
  // del <svg> contenedor (ancho/alto > 0 = el sprite se ha renderizado).
  const report = await page.evaluate(() => {
    const results = [];
    const uses = document.querySelectorAll("#langDropdown use, #langBtn use");
    uses.forEach((useEl) => {
      const href = useEl.getAttribute("href") || useEl.getAttribute("xlink:href");
      const id = (href || "").replace("#", "");
      const symbol = document.getElementById(id);
      const svg = useEl.closest("svg");
      const rect = svg ? svg.getBoundingClientRect() : { width: 0, height: 0 };
      results.push({
        href,
        symbolExists: !!symbol,
        symbolTag: symbol ? symbol.tagName.toLowerCase() : null,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      });
    });
    return results;
  });

  // Comprueba tambien que el globo (ar) no es una bandera: el symbol
  // flag-ar debe existir y no contener <rect> tipo bandera de pais (heuristico:
  // debe contener un <circle>, marca de globo).
  const arGlobeCheck =
    lang.code === "ar"
      ? await page.evaluate(() => {
          const sym = document.getElementById("flag-ar");
          return sym ? !!sym.querySelector("circle") : false;
        })
      : null;

  // Overlap check en RTL: bounding boxes del svg de bandera y del texto
  // del idioma no deben solaparse, y ninguno debe salirse del contenedor.
  let overlapInfo = null;
  if (lang.dir === "rtl" || lang.code === "ar") {
    overlapInfo = await page.evaluate(() => {
      const link = document.querySelector('#langDropdown li a[data-lang="ar"]');
      if (!link) return null;
      const svg = link.querySelector("svg");
      const linkBox = link.getBoundingClientRect();
      const svgBox = svg.getBoundingClientRect();
      const overflowsLeft = svgBox.left < linkBox.left - 1;
      const overflowsRight = svgBox.right > linkBox.right + 1;
      return {
        linkBox: { left: linkBox.left, right: linkBox.right },
        svgBox: { left: svgBox.left, right: svgBox.right },
        overflowsLeft,
        overflowsRight,
      };
    });
  }

  const shotPath = path.join(
    OUT_DIR,
    `${lang.code}_${viewport.width}x${viewport.height}.png`
  );
  // El dropdown es position:absolute y desborda la caja de .lang-switcher:
  // un screenshot del locator lo recortaria. Se calcula el clip como la
  // union de #langBtn y #langDropdown, con margen.
  const clip = await page.evaluate(() => {
    const btn = document.getElementById("langBtn").getBoundingClientRect();
    const dd = document.getElementById("langDropdown").getBoundingClientRect();
    const left = Math.min(btn.left, dd.left) - 12;
    const top = Math.min(btn.top, dd.top) - 12;
    const right = Math.max(btn.right, dd.right) + 12;
    const bottom = Math.max(btn.bottom, dd.bottom) + 12;
    return { x: left, y: top, width: right - left, height: bottom - top };
  });
  await page.screenshot({ path: shotPath, clip });

  await context.close();
  return { lang: lang.code, url, isOpen, report, arGlobeCheck, overlapInfo, shotPath };
}

async function main() {
  const browser = await chromium.launch();
  const viewports = [
    { width: 1280, height: 900 },
    { width: 375, height: 800 },
  ];

  let allOk = true;
  const summary = [];

  for (const viewport of viewports) {
    for (const lang of LANGS) {
      const result = await checkPage(browser, viewport, lang);
      summary.push({ viewport, ...result });

      const expectedUses = EXPECTED_CODES.length + 1; // 7 dropdown + 1 boton
      const gotUses = result.report.length;
      const brokenRefs = result.report.filter(
        (r) => !r.symbolExists || r.width <= 0 || r.height <= 0
      );

      console.log(
        `\n[${viewport.width}x${viewport.height}] /${lang.code}/ dropdown.open=${result.isOpen} uses=${gotUses}/${expectedUses}`
      );
      result.report.forEach((r) => {
        const status = r.symbolExists && r.width > 0 && r.height > 0 ? "OK" : "FAIL";
        console.log(
          `   ${status}  ${r.href}  symbol=${r.symbolTag}  ${r.width}x${r.height}`
        );
      });

      if (result.arGlobeCheck !== null) {
        console.log(`   ar globe (circle presente)= ${result.arGlobeCheck}`);
        if (!result.arGlobeCheck) allOk = false;
      }
      if (result.overlapInfo) {
        console.log(
          `   RTL overlap check: overflowsLeft=${result.overlapInfo.overflowsLeft} overflowsRight=${result.overlapInfo.overflowsRight}`
        );
        if (result.overlapInfo.overflowsLeft || result.overlapInfo.overflowsRight) {
          allOk = false;
        }
      }

      if (!result.isOpen || gotUses !== expectedUses || brokenRefs.length > 0) {
        allOk = false;
      }
    }
  }

  await browser.close();

  console.log("\n=== RESUMEN ===");
  console.log(allOk ? "TODO OK" : "HAY FALLOS — revisar arriba");
  console.log(`Screenshots en: ${OUT_DIR}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
