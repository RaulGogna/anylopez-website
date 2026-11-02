const { tratamientos } = require("./catalogo/es.json");

// Los precios son iguales en todos los idiomas y `concepto` solo es fiable en es:
// el "desde" sale siempre del catalogo espanol. Los packs no cuentan.
const IMPORTE = /\d+(?:[.,]\d+)?/;
const importe = (precio) => parseFloat(precio.match(IMPORTE)[0].replace(",", "."));

function precioDesde({ precios = [] }) {
  const sueltos = precios.filter(
    (p) => !/^pack/i.test(p.concepto) && IMPORTE.test(p.precio)
  );
  if (!sueltos.length) return null;
  const minimo = sueltos.reduce((a, b) => (importe(b.precio) < importe(a.precio) ? b : a));
  const hayVarios = sueltos.some((p) => importe(p.precio) !== importe(minimo.precio));
  return { precio: minimo.precio, desde: hayVarios || /^desde/i.test(minimo.concepto) };
}

module.exports = Object.fromEntries(tratamientos.map((t) => [t.slug, precioDesde(t)]));
