# Aiplan: conversions

**Proyecto:** anylopez-website
**Rama:** feature/conversions
**Estado:** COMPLETADO (50f4b9f — 2026-04-14)
**Modelo:** Opus 4.6

## Objetivo
Añadir funcionalidades de conversión al sitio: formulario de contacto operativo, sección de reseñas de Google, y otros elementos que impulsen la conversión de visitantes a clientes.

## Pasos
- [x] Sección de Google Reviews con diseño editorial oscuro (commit `1775991`)
- [x] Script rotador de reviews `js/reviews.js` (commit `6bd7c06`)
- [x] Integración de Formspree en formulario de contacto — envío AJAX, honeypot anti-spam, estado de carga (commit `5bf3531`)
- [x] Configurar email destino info@anylopez.com en panel de Formspree (hecho por el usuario)
- [x] Revisión completa de cambios y detección de gaps (commit `50f4b9f` — eliminado `js/reviews.js` muerto)
- [x] Push al repositorio remoto
- [x] Merge a master y eliminación de rama feature/conversions

## Notas e inconvenientes
- **Formspree email destino:** Se configura en el panel de Formspree (Settings > Email Recipients), no en el código. El endpoint del formulario es `https://formspree.io/f/xrerbgdw`.
- **js/reviews.js quedó sin commitear** inicialmente junto con la sección de reviews — recordar siempre commitear los archivos JS asociados a nuevas secciones HTML.
