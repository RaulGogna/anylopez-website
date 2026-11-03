# AnyLopez Website — Ground Rules

Proyecto: **Sitio web estático de AnyLopez Clínica Estética (Benidorm)**  
Stack: **Eleventy (11ty) v3** · Deploy prod en **Hostalia vía FTPS** (`deploy-hostalia.yml`), con Cloudflare delante  
URL live: https://anylopez.com — GitHub Pages (`deploy.yml`) solo sirve redirects con `PATH_PREFIX=/anylopez-website/`

---

## Reglas críticas (nunca saltarse)

1. **Filtro `| url` obligatorio** en TODOS los links y assets internos:
   ```njk
   href="{{ '/contact/' | url }}"
   src="{{ '/images/logo-color-sin-fondo.png' | url }}"
   ```
   Sin él, los paths se rompen en el build de GH Pages (`PATH_PREFIX=/anylopez-website/`); el pathPrefix es env-aware (`process.env.PATH_PREFIX || "/"`).

2. **Filtro `| bust` obligatorio en CSS y JS**, siempre después de `| url`:
   ```njk
   <link rel="stylesheet" href="{{ '/css/styles.css' | url | bust }}" />
   <script src="{{ '/assets/js/base.js' | url | bust }}" defer></script>
   ```
   Añade `?v=<md5 corto>` del contenido. Sin él, `src/.htaccess` cachea el asset **1 mes** y
   el cambio no llega a quien ya visitó la web (incidente ago-2026: el fix del chat widget se
   quedó atrapado en la caché de Cloudflare 5 días). Solo para CSS/JS; las imágenes no lo
   necesitan porque se sustituyen creando archivos nuevos. Si el filtro no encuentra el asset,
   avisa por consola en el build y lo sirve sin versionar.

3. **Las páginas viven en `src/`**, el output generado en `_site/` (nunca editar `_site/`).

4. **`_site/` está en `.gitignore`** — no comitear archivos generados.

5. **Formspree ID**: `xrerbgdw` — formulario de contacto en `src/contact.njk`.

6. **WhatsApp**: `+34 656 306 167` — URL: `https://wa.me/34656306167?text=...`

---

## i18n — arquitectura multiidioma (refactor sep-2026)

**El sitio ya NO duplica plantillas por idioma.** Antes: ES en `src/`, EN en `src/en/`. Ahora:
**una plantilla por página, paginada sobre `langs`**, con el copy en JSON por idioma.

```
src/_data/
  langs.json                  # fuente unica: code, locale, bcp47, schemaName, dir, name, flag, prefix, hreflang
  pages.json + pagesI18n.js   # rutas/priority por idioma; "only": ["es"] para paginas de un solo idioma
  i18n/<lang>/chrome.json     # nav, header, footer, mobileBar, crumbs (lo comun a todas las paginas)
  i18n/<lang>/<pagina>.json   # copy de cada pagina (home, about, contact, services, svc-*, partials...)
  catalogo/<lang>.json        # 36 tratamientos; precios identicos en todos los idiomas
```

**Anadir un idioma** = 1 entrada en `langs.json` + su carpeta `i18n/<lang>/` + `catalogo/<lang>.json`. Cero cambios en plantillas.

**Patron de plantilla** (ver `src/about.njk` como referencia canonica):
```njk
---
pagination: { data: langs, size: 1, alias: l }
permalink: "{{ l.prefix }}/about/"
eleventyComputed:
  lang: "{{ l.code }}"
  locale: "{{ l.locale }}"
  title: "{{ i18n[l.code].about.title | safe }}"     # el | safe evita doble escape (&amp;amp;)
---
{%- set tx = i18n[l.code].about %}
```

Reglas del patron:
- `| safe` **obligatorio** en `title`/`description` de `eleventyComputed`, o el `&` sale como `&amp;amp;`.
- Texto plano -> campo JSON normal. Markup inline, entidades (`&amp;`, `&rarr;`, `&nbsp;`) o apostrofes
  -> campo con sufijo `_html` emitido con `| safe`.
- hrefs internos: `{{ (l.prefix + '/ruta/') | url }}`.
- Placeholders dinamicos dentro de `*_html`: `{count}` -> `| replace("{count}", reviews.count)`.
- Catalogo: `{%- set tdata = catalogo[l.code] %}`. Antes del `include` del modal: `{%- set tratamientos = catalogo[l.code] %}`.
- `dir="rtl"` sale solo si `l.dir == 'rtl'` (preparado para el arabe).

**Gate de regresion (usar siempre que se toque i18n o CSS compartido):** build antes -> snapshot de `_site/`
-> cambio -> build -> `diff -r --strip-trailing-cr <snapshot> _site`. Las URLs estan indexadas: el diff
debe salir vacio salvo lo que el cambio pretenda alterar.


**Interpolaciones dentro de un bloque `ld+json`: `| dump | safe`, nunca entre comillas manuales.**
El autoescape de Nunjucks está pensado para HTML y dentro de un JSON-LD mete entidades: 19 páginas
servían `d&#39;expérience` y `INDIBA &amp; Ultherapy` a Google como datos estructurados (sep-2026).

⚠️ **Efecto secundario del arreglo:** si a un idioma le falta la clave, `dump` emite vacío y sale
`"description": ,` — **el `@graph` entero deja de parsear** y las 14 páginas de ese idioma pierden
clínica, reseñas y breadcrumbs de golpe y en silencio. Antes, con comillas manuales, una clave
ausente solo dejaba una cadena vacía: degradaba, no rompía. Por eso toda clave interpolada ahí
lleva fallback (`{{ (t.x or i18n.es.chrome.x) | dump | safe }}`) y **`npm run build` ejecuta
`check-jsonld.mjs`**: un JSON-LD roto para el deploy en vez de publicarse.

**Gate de enlaces cruzados de idioma: `scripts/check-lang-links.mjs`, dentro de `npm run verify`.**
Recorre el `_site` construido y marca todo `<a href>` interno de una página en idioma X que apunte
a otro idioma, deduciendo los prefijos de `langs.json` y las páginas solo-ES de `pages.json`
(excluye el selector de idioma por su `data-lang`). Nació en rojo: el enlace de privacidad de
`contact.njk` y el breadcrumb de `services/depilacion.njk` se habían dejado el `l.prefix` y mandaban
a la página española desde los 6 idiomas no-ES — un bug que vivió desde el refactor i18n de sep-2026
sin que ningún gate lo viera, y que se descubrió navegando `/uk/contact/` a mano.

**Gate de locale del calendario de reservas: `npm run verify:booking`.** Comprueba que `booking.js`
pinta meses/días/horas en el idioma y la zona horaria correctos para los 7 idiomas, abriendo un
Chromium de verdad y haciendo clic. Ningún verificador que lee el HTML generado puede detectarlo:
ese texto lo escribe el JS en el navegador (no existe en el `_site` estático) y la etiqueta del día
solo aparece tras un clic en un hueco del calendario. `verify:booking` no vive dentro de `build` ni
de `verify` porque necesita Chromium instalado y el worker de disponibilidad respondiendo en vivo —
no es apto para CI sin esas dos cosas. Ejecutar manualmente tras tocar `booking.js` o `booking.njk`:
`npm run verify:booking` (que hace `eleventy && node scripts/check-booking-locale.mjs` — el build
delante es obligatorio, o el script mide el `_site` viejo y puede dar verde sobre fuente rota).

**Hub `/services/` = carta filtrable (`css/services.css`, `js/services-filter.js`).** Los objetivos del
filtro viven en `src/_data/catalogo/objetivos.json` (`id` + `slugs`; etiquetas en `i18n/<lang>/services.json`
→ `goals`; **nunca** meter objetivos en `catalogo/es.json`, su sha256 lo vigilan otros sistemas) y el
«desde» sale de `src/_data/preciosDesde.js`: mínimo de los conceptos sueltos del catálogo es, **sin packs
ni retoques** (singular o plural), con «desde» si hay varios importes o el concepto ya lo dice.
`check-objetivos.mjs` (dentro de `build`) falla si un tratamiento queda sin objetivo o un objetivo cita un
slug inexistente. `npm run verify:hub` (`eleventy && node scripts/check-hub.mjs`, Chromium real, no apto
para CI sin él) comprueba, en los 7 idiomas:
- filas, nombres, anclas, enlaces de categoría, y precio y «desde» de cada fila contra una tabla fija;
- filtros por objetivo (filas, `aria-pressed`, recuento anunciado, sin grupos vacíos);
- modal: abre con clic, Enter y `#slug`, sin salir del hub; emite `treatment_modal_opened`, y su
  `<form method="dialog">` no emite `form_*`; los CTA emiten un solo `whatsapp_clicked`/`phone_clicked` con
  `treatment_slug` y sin `outbound_clicked`;
- clics con modificador (Ctrl, Shift, botón central, Meta) abren pestaña y no el modal;
- foco: Tab y Shift+Tab a 390 y 1440 px, sin nada enfocado bajo la cabecera, la fila de categorías ni la
  barra móvil, y orden de Tab entre objetivos, filas y chips;
- desborde horizontal a 320–1440 px y ≤ 8,5 pantallas a 390×844.

**Al cambiar precios del catálogo, `verify:hub` falla a propósito:** la tabla `PRECIO_ESPERADO` de
`scripts/check-hub.mjs` está escrita a mano (no se deriva de `preciosDesde.js`, para que un error de esa
regla no pase en los dos lados). Revisa el catálogo, actualiza la tabla a mano y vuelve a pasar el gate.

**CSS por página: front matter `pageCss: <nombre>`** enlaza `css/<nombre>.css` (con `| url | bust`) desde
`base.njk`. Lo usan `services/category.njk` (`category`) y `services.njk` (`services`).

**El «deploy doble» del chat widget no es automático.** `wrangler deploy` solo hace falta si
cambió `src/` del worker o el snapshot `content/tratamientos.json`. Un cambio solo en `widget/`
(UI, i18n) viaja en el `dist/widget.min.js` que se copia a `src/assets/chat/` y se publica con la
web. Comprobar `git diff <base>..HEAD -- src/ content/` antes de desplegar el worker: en sep-2026
se anunció el deploy del worker como pendiente y resultó innecesario, porque el worker ni siquiera
recibe el idioma.

**Páginas de categoría (`/services/<cat>/`): una sola plantilla, `src/services/category.njk`.**
Para añadir una categoría: entrada en `src/_data/serviceCategories.json` (solo lo que difiere de
`defaults`), `pages.json`, `i18n/<lang>/svc-<id>.json`, los tratamientos en `catalogo/` y el
enlace en `footer.servicesLinks` de `i18n/<lang>/chrome.json` (las 8 categorías, en los 7 idiomas). Lo que cambia de
verdad respecto al resto va en `serviceCategories.json` (xsellHref, crossHrefs, linkedTreatments); no hay overrides de CSS por categoría.
**Orden fijo de secciones, igual para las 8:** hero, tratamientos (tarjeta compacta, un solo tamaño), venta cruzada (`cross` si hay
`crossHrefs`, si no `xsell`), dolor y por qué (`pain-why`), testimonios (scroll-snap en móvil), FAQ, proceso (`<details>`) y cierre.
`npm run verify:categories` (Chromium real, 56 páginas; `--base <_site de master>` compara cabeceras y JSON-LD) vigila tarjetas, precios y anclas contra el hub,
copy íntegro, primer tratamiento ≤ 1,3 (móvil) / 1,1 (escritorio) pantallas, ≤ 9,5 pantallas a 390×844 y desborde.
Tarjeta: el «Qué incluye» es un `<details>` cuyo panel va en el flujo (la tarjeta crece; Escape y uno solo abierto, en `category/scripts.njk`).
**`.btn` pinta su propia flecha (`::after`): el copy de lo que va dentro de un `.btn` no termina en → ni ←** (ni `&rarr;`); los `.btn[href^="tel:"]` no la pintan (CSS).
La altura de la barra móvil vive en `--mobile-bar-h` (`styles.css`) y de ella salen `scroll-padding-bottom` y el relleno del pie.
`scripts/compare-sites.mjs <baseline> <actual>` es una
herramienta puntual para refactors de estas páginas: compara contra una baseline construida antes
del cambio, no es un gate permanente.

## Estructura

```
anylopez/website/
├── src/
│   ├── _includes/base.njk     # Layout unico (header, footer, WA, mobile-bar) — 100% i18n, sin if-lang
│   ├── _data/langs.json       # idiomas activos (es, en, fr, de)
│   ├── _data/i18n/<lang>/     # copy por idioma (chrome + una entrada por pagina)
│   ├── _data/catalogo/<lang>.json # 36 tratamientos · 8 categorias, por idioma
│   ├── index.njk              # Homepage (paginada sobre langs)
│   ├── about.njk              # ← referencia canonica del patron i18n
│   ├── services.njk           # Hub del catalogo (byCategory + catalogo[l.code])
│   ├── radiofrecuencia.njk    # Pagina INDIBA
│   ├── contact.njk            # Formspree xrerbgdw
│   └── privacidad{,-en,-fr,-de}.md  # legales (aviso-legal solo ES)
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
cd anylopez/website
npm run serve    # dev server en localhost
npm run build    # output a _site/
```

---

## Sistema de diseño V3 — Lumière Méditerranée

Fuentes: **Cormorant Garamond** (serif, headings) + **Jost** (sans-serif, body/UI)  
Para CSS variables completas: `.claude/css-variables.md`

---

## Gotchas conocidos

- `byCategory` filter está en `.eleventy.js` — necesario para `services.njk`. Junto a él viven `langByCode` y `entryByUrl` (i18n) y `bust`
- `images/fotoscatalogoanylopez/` contiene las **fotos hero reales** usadas en la homepage (`src/index.njk`). Servir siempre la versión `.webp` vía `<picture>` con fallback PNG. Las imágenes de `images/tratamientos/` son las del catálogo (`services.njk`) y algunas tienen overlays/compresión — pendiente auditoría de calidad en aiplan futuro.
- El video hero solo existe en formato `.mp4` (no WebP/optimizado)
- Las imágenes de `images/tratamientos/` existen en PNG y WebP — usar WebP en HTML
- `rel="noopener noreferrer"` en todos los `target="_blank"`
- `scroll-margin-top` necesario en secciones ancladas (ver catálogo con nav sticky)
- **GitHub Actions: secrets vs vars.** Datos sensibles (API keys) → `secrets.NOMBRE` (`${{ secrets.X }}`). Datos no sensibles configurables (IDs, flags) → `vars.NOMBRE` (`${{ vars.X }}`). Mezclarlos (crear un ID como secret e intentar leerlo con `vars.`) devuelve string vacío silenciosamente → el script falla con "variable no definida".
- **Nunjucks en front matter no se renderiza.** Si un campo YAML necesita `{{ reviews.count }}` u otra variable dinámica, moverlo a `eleventyComputed:` dentro del mismo front matter. Ejemplo: `ogDescription` en `en/index.njk`. El build no avisa — produce `{{ reviews.count }}` literal en el HTML generado.
- **Animaciones CSS: no cambiar `transform-origin` dentro de un `@keyframes`.** Aunque solo se anime `transform`, si `transform-origin` cambia a mitad de la animación (ej. de `top` a `bottom`) el navegador saca la animación del compositor y la ejecuta en el hilo principal (Lighthouse: "Evita las animaciones no compuestas"). Fix: fijar `transform-origin` como propiedad estática en la regla base del elemento, no dentro del keyframe. Incidente: jul-2026, `.scroll-hint-line`.
- **Redimensionar un WebP existente sin PNG original:** `scripts/optimize-images.sh` solo convierte PNG/JPG→WebP, no cubre reescalar un WebP ya generado. En Windows sin ImageMagick, usar Python+PIL vía PowerShell:
  ```powershell
  python -c @'
  from PIL import Image
  im = Image.open("images/foo.webp")
  im.resize((W,H), Image.LANCZOS).save("images/foo.webp", "webp", quality=82, method=6)
  '@
  ```
  Ajustar `quality` si el resultado pesa más que el original (puede pasar con `quality` alto en imágenes ya comprimidas). `libwebp` (`cwebp`/`dwebp`) también disponible en `~/.local/tools/libwebp-*/bin/` como alternativa.
- **CSS no crítico (widgets/secciones fuera del LCP): patrón loadCSS.** Para no bloquear el render con un `<link rel="stylesheet">` de una sección que no forma parte del contenido inicial visible (ej. `booking.css`), cargarlo como:
  ```html
  <link rel="stylesheet" href="{{ '/css/foo.css' | url }}" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="{{ '/css/foo.css' | url }}"></noscript>
  ```
  El navegador no bloquea el render por un stylesheet `media="print"`; el `onload` lo activa (`media='all'`) una vez descargado. El `<noscript>` cubre navegadores sin JS. Verificar siempre visualmente que no hay FOUC en la sección afectada. Incidente: jul-2026, `booking.njk`.
- **Imágenes de catálogo llevan el nombre rotulado dentro.** Las de `images/tratamientos/` tienen el nombre del tratamiento horneado en la imagen. Al añadir un tratamiento nuevo, NUNCA reutilizar la imagen de otro (mostraría el rótulo equivocado): generar variante con PIL — banda crema translúcida `(246,242,237,242)` de ~44px sobre el rótulo viejo + texto nuevo en mayúsculas letterspaced (Arial 15, tracking 5px, color `(120,113,103)`) — y exportar PNG+WebP. Ejemplo: `triple-accion-anticelulitica.png` (2026-08-30).
- **Precios del pack INDIBA duplicados en 4+ sitios.** `tratamientos.json` (ES+EN), `radiofrecuencia.njk` (HTML + 2 bloques JSON-LD + metas), `index.njk` (sección pack + Product schema + title/OG) y `services.njk` (hub) — todos con espejo EN. Al cambiar una tarifa, grep del precio/ahorro viejo en TODO `src/` (texto visible Y JSON-LD) antes de dar el cambio por cerrado: schema.org con precio distinto al visible es penalizable por Google (structured data price mismatch). Incidente: ago-2026, el claim "350 €/ahorras 525 €" sobrevivió en home, hub y un JSON-LD tras actualizar la página INDIBA.
- **Footer = las 8 categorías de servicio.** El `footer-col` "Servicios/Treatments" en `base.njk` es el único enlace site-wide a las páginas de `/services/`. Si lista menos de las 8 categorías, las omitidas quedan huérfanas (solo enlazadas desde el hub) → Google las marca "Duplicada: canónica diferente" en GSC. Al crear una categoría nueva, añadirla SIEMPRE al footer (ES+EN). Incidente: jun-2026, masajes/corporal/estetica-decorativa quedaron fuera y cayeron en indexación.

---

## Convención de copy — certificaciones

**No afirmar certificaciones en el copy** ("certificada", "con certificación médica", "certified") — retiradas por decisión del cliente ago-2026. Los badges "Certified" del hero se mantienen por ahora; ante la duda, describir la tecnología sin alegar certificación.

## Convención de copy — marca INDIBA

**La palabra INDIBA SIEMPRE va precedida de "Radiofrecuencia"** en texto visible ES ("Radiofrecuencia INDIBA"); en EN se empareja como "INDIBA Radiofrequency". Nunca "INDIBA" a secas ni "INDIBA Activ" (nombre retirado ago-2026). Excepciones: atributos no visibles (`value="INDIBA"`), slugs/anchors (`pack-indiba`, `radiofrecuencia-indiba`) y la variante "Radiofrecuencia profunda INDIBA". En URLs de WhatsApp usar `%20` (`Pack%20Radiofrecuencia%20INDIBA`). Regla dictada por el cliente 2026-08-31.

⚠️ Al alargar labels/options, revisar responsive: los `<option>` largos ensanchan el `<select>` y los grid items sin `min-width:0` desbordan el track `1fr` (incidente lead-strip ago-2026); los badges/nav con textos largos necesitan comprobación a 375/768/1024.

## Convención de copy — negaciones

En zonas de oferta/pricing/garantía, evitar negaciones de DUDA: el cerebro
procesa el marco antes que la negación ("no es tomar fotos" evoca tomar fotos;
"si algo no funciona" instala la duda del fracaso). Reescribir en positivo o
en certeza.

Sí conservar negaciones de CONTRASTE/posicionamiento fuera del pricing
("No vendemos sesiones de más", "No tratamos lo que no necesitas") — crean
diferenciación anti-franquicia, no duda.

Origen: feedback asesora 2026-05-13, auditado con billion-dollar-ai-team.

---

## Workflow de features

Seguir el proceso completo del CLAUDE.md del workspace padre:  
rama → aiplan → develop → gaps → docs → push/merge → cerrar aiplan
