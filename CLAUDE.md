# AnyLopez Website — Ground Rules

Proyecto: **Sitio web estático de AnyLopez Clínica Estética (Benidorm)**  
Stack: **Eleventy (11ty) v3** · Deploy en **GitHub Pages** vía GitHub Actions  
URL live: https://raulgogna.github.io/anylopez-website/

---

## Reglas críticas (nunca saltarse)

1. **Filtro `| url` obligatorio** en TODOS los links y assets internos:
   ```njk
   href="{{ '/contact/' | url }}"
   src="{{ '/images/logo-color-sin-fondo.png' | url }}"
   ```
   Sin él, los paths se rompen en producción por `pathPrefix: "/anylopez-website/"`.

2. **Las páginas viven en `src/`**, el output generado en `_site/` (nunca editar `_site/`).

3. **`_site/` está en `.gitignore`** — no comitear archivos generados.

4. **Formspree ID**: `xrerbgdw` — formulario de contacto en `src/contact.njk`.

5. **WhatsApp**: `+34 656 306 167` — URL: `https://wa.me/34656306167?text=...`

---

## Estructura

```
anylopez-website/
├── src/
│   ├── _includes/base.njk     # Layout único (header, footer, WA, mobile-bar)
│   ├── _data/tratamientos.json # 35 tratamientos · 8 categorías
│   ├── index.njk              # Homepage
│   ├── about.njk
│   ├── services.njk           # Catálogo (usa byCategory filter + tratamientos.json)
│   ├── radiofrecuencia.njk    # Página INDIBA
│   └── contact.njk            # Formspree xrerbgdw
├── css/styles.css             # Sistema de diseño V3 (ver .claude/css-variables.md)
├── images/
│   ├── logo-color-sin-fondo.{png,webp}  # Logo (WebP para web, PNG fallback)
│   ├── InShot_20240813_141525723.mp4    # Video hero homepage (pendiente optimizar)
│   ├── fotoscatalogoanylopez/ # 6 fotos hero index.njk (PNG originales + WebP servidas)
│   └── tratamientos/          # Imágenes catálogo services.njk (PNG + WebP, algunas con overlays — revisar calidad en aiplan futuro)
├── js/
├── .eleventy.js               # pathPrefix + byCategory filter
└── scripts/optimize-images.sh # PNG→WebP batch (ver offload-deterministic)
```

---

## Comandos

```bash
cd anylopez-website
npm run serve    # dev server en localhost
npm run build    # output a _site/
```

---

## Sistema de diseño V3 — Lumière Méditerranée

Fuentes: **Cormorant Garamond** (serif, headings) + **Jost** (sans-serif, body/UI)  
Para CSS variables completas: `.claude/css-variables.md`

---

## Gotchas conocidos

- `byCategory` filter está en `.eleventy.js` — necesario para `services.njk`
- `images/fotoscatalogoanylopez/` contiene las **fotos hero reales** usadas en la homepage (`src/index.njk`). Servir siempre la versión `.webp` vía `<picture>` con fallback PNG. Las imágenes de `images/tratamientos/` son las del catálogo (`services.njk`) y algunas tienen overlays/compresión — pendiente auditoría de calidad en aiplan futuro.
- El video hero solo existe en formato `.mp4` (no WebP/optimizado)
- Las imágenes de `images/tratamientos/` existen en PNG y WebP — usar WebP en HTML
- `rel="noopener noreferrer"` en todos los `target="_blank"`
- `scroll-margin-top` necesario en secciones ancladas (ver catálogo con nav sticky)

---

## Workflow de features

Seguir el proceso completo del CLAUDE.md del workspace padre:  
rama → aiplan → develop → gaps → docs → push/merge → cerrar aiplan
