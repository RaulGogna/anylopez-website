// Filas de la carta del hub tal como las pinta el navegador, por slug.
export const filasDelHub = (page) =>
  page.$$eval(".svc-row", (rows) =>
    rows.map((r) => ({
      slug: r.dataset.slug,
      href: r.getAttribute("href"),
      nombre: r.querySelector(".svc-row-name")?.textContent.trim(),
      precio: r.querySelector(".price-from bdi")?.textContent.trim() ?? null,
      marcaDesde: r.querySelector(".price-from-label")?.textContent.trim() ?? null,
    }))
  );
