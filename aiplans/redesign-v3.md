# Aiplan: Rediseño V3 — Implementación completa

**Proyecto:** anylopez-website
**Rama:** feature/redesign-v3
**Estado:** COMPLETADO (1625d6f — 2026-04-17)
**Modelo:** claude-sonnet-4-6

## Objetivo
Implementar el diseño del prototipo V3 en la web real de Eleventy. Fusión de V1 (hero con video real + servicios con fotos reales + logo real) + V2 (lead strip, trust strip, oferta countdown, por qué, FAQ, Instagram, mobile bar). Aprovechar que el formulario Formspree ya funciona (`xrerbgdw`).

## Pasos
- [x] Crear rama `feature/redesign-v3`
- [x] Crear aiplan
- [x] Reescribir `css/styles.css` con el sistema de diseño V3
- [x] Reescribir `src/_includes/base.njk` con header/footer/WA/mobile-bar V3
- [x] Reescribir `src/index.njk` con todas las secciones V3
- [x] Actualizar `src/contact.njk` con estilos V3 (conservar Formspree) — aliases CSS suficientes
- [x] Revisar `src/about.njk`, `src/services.njk`, `src/radiofrecuencia.njk` con estilos V3
- [x] Build y verificar que compila sin errores
- [x] Commit y push
- [x] Merge a master

## Notas e inconvenientes
- Formspree ya está configurado en contact.njk: `action="https://formspree.io/f/xrerbgdw"` — conservar.
- El video `images/InShot_20240813_141525723.mp4` existe en el proyecto.
- Logo real: `images/logo-color-sin-fondo.png`
- Imágenes tratamientos: `images/fotoscatalogoanylopez/*.png`
- Usar `| url` filter en todos los links internos de Eleventy.
- Fuentes: Cormorant Garamond + Jost (reemplaza Brygada 1918 + Inter).
