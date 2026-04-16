# Aiplan: catalogo-tratamientos

**Proyecto:** anylopez-website
**Rama:** feature/catalogo-tratamientos
**Estado:** COMPLETADO (5a16f5f — 2026-04-15)
**Modelo:** Opus 4.6

## Objetivo
Rediseñar la sección de servicios/tratamientos usando como fuente el catálogo e-commerce de WhatsApp Business de la clínica. Extraer contenido (título, descripción, beneficios, duración, precio) de 35 fichas y rediseñar `services.njk` con cards nativas web. El usuario aporta recortes limpios de las imágenes de portada de cada tratamiento.

## Pasos
- [x] Extraer contenido de las 35 fichas del catálogo → `src/_data/tratamientos.json` con 35 tratamientos en 8 categorías (verificado y corregido con tratamientos.md)
- [x] Recibir del usuario los recortes limpios de las imágenes de portada (22 PNGs en `images/tratamientos/`)
- [x] Colocar imágenes en `images/tratamientos/` y optimizar (WebP) — WebP descartado: lazy loading ya presente, PNGs 122–200 KB no justifican dependencia adicional
- [x] Rediseñar `services.njk` con grid de cards alimentado por el JSON de datos (filtro `byCategory` en `.eleventy.js`, 35 tratamientos en 8 categorías, nav sticky, grid 3/2/1 col)
- [x] Decidir estructura: página única con nav sticky por categoría (ya implementado)
- [x] Actualizar enlaces/navegación si es necesario — todos los links correctos, añadido `noreferrer` al CTA de WhatsApp
- [x] Build + test local — build limpio 0.96s, página carga y se ve perfecta
- [x] Revisar gaps — SEO ✓, a11y ✓, lazy loading ✓, alt texts ✓, h1→h2→h3 ✓. Solo gap: `rel="noopener noreferrer"` corregido
- [x] Commit + push + merge a master

## Notas e inconvenientes
- Las fotos originales en `images/fotoscatalogoanylopez/` son screenshots completos con chrome de WhatsApp — no usables tal cual. Solo sirve el contenido textual y (tras recorte manual del usuario) la imagen de portada.
