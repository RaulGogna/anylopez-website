// Recorre la página con Tab y con Shift+Tab. Por cada tecla devuelve cuántos elementos recorrió y,
// si alguno queda bajo una de las zonas fijas `cubiertas` (selectores), su nombre y esa zona.
export async function recorrerFoco(page, cubiertas) {
  // Devuelve null al salir de la página, "repetido" al cerrar el ciclo, o el nombre del elemento
  // (con " queda bajo <selector>" si algo lo tapa).
  const siguiente = () =>
    page.evaluate(async (zonas) => {
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      window.__recorridos ??= new WeakSet();
      if (window.__recorridos.has(el)) return "repetido";
      window.__recorridos.add(el);
      const caja = el.getBoundingClientRect();
      const nombre = el.dataset.slug || el.getAttribute("href") || el.textContent.trim().slice(0, 30);
      for (const sel of zonas) {
        const cubierta = document.querySelector(sel);
        if (!cubierta || cubierta.contains(el) || getComputedStyle(cubierta).display === "none") continue;
        const c = cubierta.getBoundingClientRect();
        const solapeV = Math.min(caja.bottom, c.bottom) - Math.max(caja.top, c.top);
        const solapeH = Math.min(caja.right, c.right) - Math.max(caja.left, c.left);
        if (solapeV > 1 && solapeH > 1) return `${nombre} queda bajo ${sel}`;
      }
      return nombre;
    }, cubiertas);

  const resultado = [];
  for (const tecla of ["Tab", "Shift+Tab"]) {
    await page.evaluate(() => { window.__recorridos = new WeakSet(); document.activeElement?.blur(); });
    let recorridos = 0;
    let tapado = null;
    for (let i = 0; i < 400; i++) {
      await page.keyboard.press(tecla);
      const visto = await siguiente();
      if (visto === null || visto === "repetido") break;
      recorridos++;
      if (visto.includes(" queda bajo ")) { tapado = visto; break; }
    }
    resultado.push({ tecla, recorridos, tapado });
  }
  return resultado;
}
