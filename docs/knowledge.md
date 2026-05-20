# Knowledge — AnyLopez Website

Doc vivo: inconvenientes resueltos y decisiones permanentes.  
A diferencia de los aiplans de feature (que se cierran), este se actualiza continuamente.

---

## Eleventy / Build

| # | Hecho | Detalle |
|---|-------|---------|
| K1 | **`pathPrefix` rompe paths sin `\| url`** | Todo link/asset interno DEBE usar el filtro Nunjucks `\| url`. Sin él, los paths son relativos y se rompen en producción (`/anylopez-website/` prefix). |
| K2 | **`byCategory` filter en `.eleventy.js`** | Filtra `tratamientos.json` por `categoria`. Si se mueve o renombra el archivo de datos, actualizar también este filter. |
| K3 | **Build limpio en ~1s** | Si el build tarda más de 5s, hay un problema (suele ser un archivo grande en passthrough). |
| K4 | **`_site/` nunca se commitea** | Está en `.gitignore`. GitHub Actions genera `_site/` en el deploy. |

---

## Imágenes

| # | Hecho | Detalle |
|---|-------|---------|
| K5 | **PNG + WebP en `images/tratamientos/`** | Cada imagen existe en ambos formatos. Usar WebP en HTML (`<img src="...webp">`). La conversión se hace con `scripts/optimize-images.sh`. |
| K6 | **Fotos de WhatsApp no usables** | Las imágenes originales en `images/fotoscatalogoanylopez/` son screenshots completos con chrome de WhatsApp. Solo sirven para referencia de contenido textual. |
| K7 | **PNG→WebP redujo ~92% el peso** | Optimización aplicada en commit `20dfab8`. Siempre optimizar imágenes nuevas antes de commitear. |
| K8 | **Video hero solo en `.mp4`** | `images/InShot_20240813_141525723.mp4` — no existe en otros formatos. No intentar convertir sin confirmar con el usuario. |

---

## CSS / Diseño

| # | Hecho | Detalle |
|---|-------|---------|
| K9 | **`--header-h: 88px`** | El header es sticky; `body` tiene `padding-top: var(--header-h)`. Secciones ancladas necesitan `scroll-margin-top: var(--header-h)`. |
| K10 | **Aliases CSS para páginas internas** | `--primary`, `--secondary`, `--accent`, `--bg-light`, `--bg-cream`, `--bg-white`, `--text-dark` son aliases definidos en `:root` para compatibilidad. Las variables V3 nativas son `--terra`, `--ivory`, `--sand`, etc. |
| K11 | **Grain overlay en `body::before`** | SVG inline de ruido fractal, z-index 9990, opacity 0.022. No tocar a menos que se rediseñe. |
| K12 | **Fuentes desde Google Fonts** | Cormorant Garamond + Jost. Cargadas en `base.njk` con `preconnect`. Sin ellas el fallback es serif/sans-serif genérico. |

---

## Accesibilidad / SEO

| # | Hecho | Detalle |
|---|-------|---------|
| K13 | **`rel="noopener noreferrer"`** | Todos los `target="_blank"` deben tenerlo. Error detectado en catálogo (corregido en review de `feature/catalogo-tratamientos`). |
| K14 | **Jerarquía de headings: h1→h2→h3** | Verificado en todas las páginas. No romper el orden al añadir secciones nuevas. |
| K15 | **Lazy loading en imágenes del catálogo** | `loading="lazy"` en cards de tratamientos. No añadirlo en imágenes above-the-fold (hero, logo). |

---

## Historial de decisiones

| Fecha | Decisión | Motivo |
|-------|----------|--------|
| 2026-04-15 | WebP descartado para catálogo inicialmente, luego aplicado | PNGs de 122–200 KB → con WebP se redujo 92%. Vale la dependencia del script. |
| 2026-04-15 | Página única con nav sticky para catálogo | Mejor UX que múltiples páginas; evita duplicar layout. |
| 2026-04-17 | Fusión V1+V2 en V3 | V1 tenía activos reales (video, logo, fotos); V2 tenía secciones de conversión (countdown, FAQ, trust strip). V3 combina ambos. |
| 2026-04-17 | Formspree `xrerbgdw` conservado desde V1 | Ya funcionaba; no migrar a otro servicio sin necesidad. |
