# Modal de tratamiento + páginas individuales — anylopez-website

## Context

La página `src/services.njk` muestra 35 tratamientos en grid pero la card solo expone descripción corta + bullets + duración. El catálogo completo (`docs/info/tratamientos-catalogo.md`) tiene "¿Cómo funciona?", beneficios detallados, "ideal para", recomendaciones y precios — información que hoy no llega al usuario.

El cliente quiere que al pulsar un servicio aparezca un **pop-up llamativo** donde el visitante pueda curiosear sin salir de la página. Decisión consensuada (panel Hormozi+Kennedy+Godin):
- **Modal en services + página estática indexable por tratamiento** (UX rápida + SEO long-tail).
- **Precios completos visibles** (Hormozi/Kennedy: ocultarlos es debilidad de oferta).
- **Hero con imagen + estructura Godin**: Para quién → Beneficios → Cómo funciona → Precios (pack hero) → Garantía → CTA.

Resultado esperado: más transparencia, mejor conversión a WhatsApp, indexación por tratamiento ("mesoterapia virtual benidorm precio"), y diferenciación con tipografía Lumière Méditerranée.

---

## Modelo y workflow

- Arquitectura/copy enriquecido (paso 1, 4): **Opus**
- Implementación HTML/CSS/JS Eleventy (paso 2, 3, 5): **Sonnet**
- Imágenes/assets, redirects (paso 6): **Haiku**
- Rama `feature/tratamientos-modal-y-paginas` desde `master`.
- Aiplan vivo en `aiplans/anylopez-tratamientos-modal-y-paginas.md` (mover este al merge).

---

## Pasos

### 1. Enriquecer `src/_data/tratamientos.json` (Opus) — ✅ COMPLETADO

Estado: 35 tratamientos enriquecidos con `paraQuien`, `comoFunciona[]`, `beneficios[]`, `idealPara`, `recomendaciones`, `packDestacado`. Campo `garantiaDefault` a nivel raíz (validar copy con cliente). Build OK.


Añadir a cada uno de los 35 tratamientos los campos:
- `paraQuien`: 1 frase con avatar específico (ej. "Para mujeres 40–55 con manchas solares acumuladas tras veranos en la costa").
- `comoFunciona`: array 2–4 párrafos cortos extraídos del `.md`.
- `beneficios`: array detallado (sustituye al `incluye` corto cuando el .md tenga más).
- `idealPara`: string del .md (sección 🌿 Ideal para).
- `recomendaciones`: string opcional (💡 Recomendaciones del .md).
- `garantia`: string corto. Si el .md no la tiene, default: *"Valoración sin compromiso. Si la primera sesión no se ajusta a tus necesidades, te asesoramos sobre la alternativa adecuada sin coste."* — validar con cliente antes de publicar.
- `packDestacado`: índice del array `precios` que debe mostrarse como hero del bloque precio (default 0 = sesión, override en tratamientos con pack atractivo).

Fuente: `docs/info/tratamientos-catalogo.md`. Sanear duplicados (Diamond/Elite/Dermaplaning aparecen dobles en el .md). Mantener `precios[]` actual (ya correcto).

### 2. Modal `<dialog>` en `src/services.njk` (Sonnet) — ✅ COMPLETADO

Estado: card clicable con `data-slug` + CTA `Ver detalles →` (botón). `<dialog id="trat-modal">` con plantilla data-field. JSON inline (`<script id="trat-data">`). Variables PATH desde Nunjucks. Nuevo `js/treatment-modal.js` (hidratación, deep-link por hash, ESC/backdrop close, tracking `?src=modal-{slug}`).


- Hacer la `.trat-card` entera clicable (botón overlay con `aria-label`, `data-slug`). Mantener "Reservar cita" como CTA secundaria abajo.
- Al final del template, un único `<dialog id="trat-modal">` con plantilla vacía (slots con `data-field`).
- Inyectar JSON del catálogo enriquecido al pie de página vía `<script type="application/json" id="trat-data">{{ tratamientos.tratamientos | dump | safe }}</script>` (Eleventy ya lo serializa).
- Script `js/treatment-modal.js` (nuevo): al click → busca slug → rellena slots → `dialog.showModal()`. Cierre con `<form method="dialog">`, ESC nativo, click en `::backdrop`.
- Deep-linking: si `location.hash` matchea un slug al cargar, abrir el modal. Cerrar limpia el hash con `history.replaceState`.

### 3. Estructura del modal (Sonnet) — ✅ COMPLETADO

Estado: bloque CSS añadido a `css/styles.css`. Hero con imagen + gradient overlay, título Cormorant, paraQuien cursiva. Beneficios grid 2col con ✓ accent. Pack hero destacado con borde accent. Lista precios secundarios con border-bottom. Garantía callout. CTAs duales (WhatsApp + Tel) + permalink. ::backdrop blur, animación slide-up cubic-bezier, mobile fullscreen, prefers-reduced-motion respetado.


Orden visible (estructura Godin → Hormozi):
1. **Hero**: imagen tratamiento (picture WebP+PNG), badge categoría, título Cormorant, `paraQuien` como subtítulo cursiva.
2. **Beneficios** (lista con ✓ accent).
3. **¿Cómo funciona?** (párrafos serif).
4. **Precios** — pack destacado en card grande con badge "AHORRA X €" si aplica; resto de tarifas en lista compacta. Sin "Consultar precio".
5. **Ideal para** + **Recomendaciones** (collapsible si es largo).
6. **Garantía** (callout suave).
7. **CTAs duales**: `Reservar por WhatsApp` (primario) → `wa.me/...?text=...&src=modal-{slug}` · `Llamar 656 306 167` (secundario).

CSS nuevo en `css/styles.css` bajo bloque `/* ─── TREATMENT MODAL ─── */`:
- `dialog::backdrop` con `backdrop-filter: blur(8px)` + `rgba(28,26,24,.55)`.
- `max-width: 720px`, `max-height: 90vh`, scroll interno.
- Animación `transform: translateY(20px) → 0` con `opacity 0 → 1`, `cubic-bezier(.16,1,.3,1)`, 280 ms.
- Sticky header dentro del dialog con título + botón cerrar.
- `prefers-reduced-motion` → sin animación.
- Mobile (≤640px): full-screen, esquinas a 0.

### 4. Páginas individuales por tratamiento (Sonnet) — ❌ DESCARTADO

Razón (complexity-review + decisión usuario 2026-04-29): el modal ya muestra TODA la información (paraQuien, beneficios, cómo funciona, precios, garantía, CTAs). Crear 35 páginas finas con el mismo template fragmenta autoridad SEO y duplica mantenimiento. El SEO local (Benidorm) se gana con Google Business + reseñas + schema MedicalClinic — no con 35 long-tail flacos. Si en el futuro 1-2 tratamientos hero (Ultherapy HIFU, INDIBA) merecen landing dedicada, hacer en aiplan separado.

Implicaciones aplicadas: removido `<a class="trat-modal-permalink">` del modal, removida lógica `PERMA_BASE` del JS y la inyección desde Nunjucks. CSS `.trat-modal-permalink` removido.

### 4-bis. (Plan original conservado para referencia futura)
- Crear `src/tratamientos.njk` con frontmatter Eleventy de paginación:
  ```yaml
  pagination:
    data: tratamientos.tratamientos
    size: 1
    alias: trat
  permalink: "/tratamientos/{{ trat.slug }}/"
  ```
- Reutilizar la **misma plantilla visual del modal** pero como página completa (extiende `base.njk`):
  - Hero ampliado (más imagen).
  - Misma estructura: Para quién → Beneficios → Cómo funciona → Precios → Ideal para → Recomendaciones → Garantía → CTAs.
  - Breadcrumb: Inicio › Servicios › {Categoría} › {Nombre}.
  - **JSON-LD `MedicalProcedure` + `Offer`** con precios, duración, dirección de la clínica (mejora SEO local).
  - Sección final "Otros tratamientos en {Categoría}" con 3 cards relacionadas.
- En el grid de `services.njk`, mantener clic → modal (UX rápida). Añadir bajo el modal un enlace pequeño `Ver ficha completa →` que lleve a `/tratamientos/{slug}/` para shareability.

### 5. Tracking y CTAs (Sonnet)
- Cada CTA WhatsApp construye URL con `?src=modal-{slug}` o `?src=page-{slug}`. Permite ver en logs cuál convierte.
- Texto WhatsApp prepoblado: `"Hola, vengo de {nombre tratamiento}. Querría reservar / consultar disponibilidad."` urlencoded.
- Sustituir el texto genérico actual `"...consultar el precio de..."` por el reserva-orientado.

### 6. SEO (Haiku) — ✅ COMPLETADO

Estado: añadido JSON-LD `ItemList` en `services.njk` con los 35 tratamientos. Cada item es `MedicalProcedure` con name, description, url (deep-link `#slug`), procedureType=NoninvasiveProcedure, provider conectado al `MedicalClinic` existente vía `@id`, y `Offer` con precio limpio (sin "€"/"Desde") y EUR. Validado: JSON parsea correctamente, 35 items generados desde `tratamientos.json`. Habilita rich snippets de servicios en SERPs y mejor comprensión por IAs.

### 7. Verificación end-to-end
1. `npm run build` sin errores → revisar `_site/tratamientos/<slug>/index.html` para 5 tratamientos muestra (Mesoterapia Virtual, Ultherapy HIFU facial, Bótox, IPL, Limpieza GOLD).
2. `npm run serve` → abrir `/services/`:
   - Click en card → modal abre, contenido correcto, ESC cierra, click backdrop cierra, focus trap activo.
   - Hash `#mesoterapia-virtual` → modal abre al cargar.
   - Mobile (DevTools 375px): modal full-screen, scroll interno OK.
   - Lighthouse Performance ≥ 80, Accessibility 100, SEO 100.
3. Validar JSON-LD con [Schema Markup Validator](https://validator.schema.org/).
4. Probar 1 CTA WhatsApp → URL contiene `?src=modal-...` y texto correcto.
5. Sin imágenes nuevas: reutilizar `images/tratamientos/*.webp` existentes.

---

## Archivos a crear / modificar

| Acción | Ruta |
|---|---|
| Modificar | `anylopez-website/src/_data/tratamientos.json` (enriquecer 35 entradas) |
| Modificar | `anylopez-website/src/services.njk` (card clicable + dialog + JSON inline) |
| Modificar | `anylopez-website/css/styles.css` (bloque modal + página tratamiento) |
| Modificar | `anylopez-website/src/sitemap.njk` |
| Crear | `anylopez-website/js/treatment-modal.js` |
| Crear | `anylopez-website/src/tratamientos.njk` (paginación Eleventy + JSON-LD) |
| Mover | este plan → `anylopez-website/aiplans/anylopez-tratamientos-modal-y-paginas.md` al iniciar implementación |

---

## Funciones/utilidades existentes a reutilizar

- `byCategory` filter en `.eleventy.js:??` — ya usada en services.njk.
- Filtro `| url` con pathPrefix (obligatorio en TODOS los enlaces internos).
- Sistema CSS V3 `var(--primary)`, `var(--accent)`, `var(--bg-cream)`, `var(--text-mid)` — todos en `css/styles.css`.
- Tipografía Cormorant Garamond + Jost ya cargada en `base.njk`.
- Patrón `<picture>` WebP+PNG ya usado en services.njk:285-297 — replicar en modal y página.

---

## Inconvenientes y decisiones pendientes

- **Garantía**: el catálogo .md no la documenta. Texto provisional incluido en paso 1. **Validar con el cliente** antes de publicar — riesgo legal si prometemos algo no acordado.
- **Imágenes hero**: actuales son fotos de aparatos/genéricas. Godin recomienda "imagen del resultado emocional". Marcar como **mejora futura** (otro aiplan); no bloquear este lanzamiento.
- **Tamaño JSON inline**: 35 tratamientos × ~1.2 KB enriquecido ≈ 42 KB en el HTML. Aceptable; si crece, mover a fetch lazy.
- **Páginas individuales y canónico**: el modal y la página individual mostrarán el mismo contenido. Riesgo SEO menor de duplicación interna. Mitigación: el modal NO renderiza HTML server-side (es JSON inline + JS), la página sí — Google indexa solo la página. No hace falta canónico.
- **Tests**: el proyecto no tiene suite. Verificación manual conforme paso 7.
