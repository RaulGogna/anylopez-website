# CSS Variables — Sistema de Diseño V3 · Lumière Méditerranée

Cargar este doc solo cuando se toque `css/styles.css` o se añadan estilos.

---

## Paleta de color

```css
--ivory:      #F8F3ED   /* background principal */
--sand:       #EDE4D8   /* secciones alternas (.section--bg) */
--sand-mid:   #D9CCBE   /* bordes, separadores */
--terra:      #B87254   /* accent principal (CTAs, eyebrows) */
--terra-dk:   #8C5238   /* hover de terra */
--gold:       #C9A870   /* accent secundario (detalles premium) */
--dark:       #1A1208   /* headings, secciones oscuras */
--dark-mid:   #2D2016   /* footer background */
--text:       #2A1F14   /* body text */
--text-mid:   #6B5540   /* subtítulos, texto secundario */
--text-light: #9B8573   /* placeholder, notas */
--border:     #DDD0C2   /* bordes de cards, separadores */
```

## Aliases (compatibilidad páginas internas)

```css
--primary:   var(--dark)
--secondary: var(--text-mid)
--accent:    var(--terra)
--bg-light:  var(--sand)
--bg-cream:  var(--ivory)
--bg-white:  #ffffff
--text-dark: var(--text)
```

## Layout y efectos

```css
--radius:     2px
--shadow:     0 4px 24px rgba(26,18,8,.10)
--shadow-lg:  0 8px 48px rgba(26,18,8,.16)
--transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)
--ease:       cubic-bezier(0.25, 0.46, 0.45, 0.94)
--header-h:   88px
```

---

## Tipografía

| Uso | Fuente | Pesos cargados |
|-----|--------|----------------|
| Headings (h1–h5) | Cormorant Garamond, serif | 300, 400, 600, 700 (+ itálica) |
| Body, UI, botones | Jost, sans-serif | 300, 400, 500, 600 (**no 700** — fontes/fonts.css) |

### Variables de familia

```css
--font-display: 'Cormorant Garamond', 'Georgia', serif;  /* headings serif */
--font-body:    'Jost', sans-serif;                       /* body/UI */
```

### Escala modular (Wave 0 / 2 — feature/sistema-tipografico)

Perfect fourth, ratio 1.2, base 16px. Aplicada progresivamente; los componentes refactorizados deben usar SOLO tokens, no valores px/rem literales.

```css
--fs-3xs:     0.694rem  /* 11.1px — eyebrow/labels uppercase */
--fs-2xs:     0.833rem  /* 13.3px — meta, hint, footer link */
--fs-xs:      1rem      /* 16px   — body */
--fs-sm:      1.2rem    /* 19.2px — lead, intro */
--fs-md:      1.44rem   /* 23px   — h4, card titles */
--fs-lg:      1.728rem  /* 27.6px — h3 */
--fs-xl:      2.074rem  /* 33.2px — h2 */
--fs-2xl:     2.488rem  /* 39.8px — h1 sección */
--fs-display: clamp(2.5rem, 6vw, 4.3rem) /* hero — TODAVÍA NO APLICADO */
```

### Letter-spacing

```css
--tracking-tight:   -0.02em  /* headings grandes */
--tracking-normal:  0        /* body */
--tracking-wide:    0.08em   /* labels uppercase, CTAs */
--tracking-widest:  0.2em    /* eyebrows, micro-labels */
```

### Pesos

```css
--weight-light:  300
--weight-body:   400
--weight-strong: 500
```

### Outliers fuera de escala (intencionales)

Números decorativos y elementos editoriales que NO deben mapearse a la escala:

| Selector | Tamaño | Razón |
|---|---|---|
| `.hero-title` | clamp(58px, 7vw, 100px) | Hero principal — no tocado en piloto, será `--fs-display` futuro |
| `.testi-section::before` | 480px | Marca de agua de cita (decorativo) |
| `.oferta-section::before` | clamp(100px, 16vw, 200px) | Marca de agua "INDIBA" (decorativo) |
| `.p-num`, `.because-num` | 64px / 48px | Números de paso editorial |
| `.stat-number`, `.g-rating-big` | 56px / 44px | Estadísticas grandes |
| `.scroll-hint-label` | 9px | Micro-label sub-rango |
| `.faq-icon::after` | 16px | Ornamental `+` |

### Componentes ya migrados a tokens (Wave 2)

- Footer (`styles.css`): `.footer-brand p`, `.footer-col h4`/`.footer-heading`, `.footer-col ul li a`, `.footer-bottom`, `.footer-google-link`
- Breadcrumb (`styles.css`): `.breadcrumb a`, `.breadcrumb span`
- Booking modal (`booking.css`): TODO el archivo migrado + bugs corregidos

### Pendiente de migrar (futuras waves)

Hero, secciones generales (.section-*), testimonials, CTA, FAQ, donde-*, porque-*, paso-*, services, index, radiofrecuencia, about, legal.css.

### Reglas para nuevo CSS

1. Siempre `var(--fs-*)`, nunca px/rem literal en `font-size` salvo outliers documentados arriba.
2. Si necesitas un tamaño nuevo entre dos tokens, **no inventes valores intermedios** — usa el más cercano. Si el caso es legítimo, propón un token nuevo y documéntalo aquí.
3. Letter-spacing: 4 tokens disponibles, no inventes valores nuevos.
4. Pesos: 3 tokens. Si necesitas 600/700, **revisa si carga la fuente** (Jost no carga 700) y prefiere 500 + tamaño/tracking para enfatizar.

```css
.section-title    { font-size: clamp(28px, 4vw, 56px); }
.eyebrow          { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--terra); }
.section-subtitle { font-size: 16px; color: var(--text-mid); max-width: 600px; }
```

**Nota:** las 3 reglas de ejemplo de arriba aún usan valores literales — se migrarán en próxima wave junto con el resto del sitio.

---

## Clases de sección

```css
.section          /* padding: 120px 0 */
.section--bg      /* background: var(--sand) */
.section--dark    /* background: var(--dark); color: #fff */
.container        /* max-width: 1280px; padding: 0 48px */
```

---

## Botones

```css
.btn              /* base — padding: 14px 32px; font 11px; letter-spacing 0.18em */
.btn-primary      /* alias de btn-terra */
.btn-terra        /* background: terra; color: #fff */
.btn-accent       /* alias de btn-terra */
.btn-outline      /* border: terra; color: terra */
.btn-white        /* background: #fff; color: dark */
.btn-ghost        /* background: transparent; color: terra; border: border */
.btn-no-arrow     /* elimina el → automático */
```

---

## Scroll reveal

```css
.rv               /* opacity: 0; translateY(24px) — aplicar a elementos animados */
.rv.visible       /* activa la animación (via IntersectionObserver en js/) */
.d1 / .d2 / .d3 / .d4   /* delays: 0.12s / 0.24s / 0.36s / 0.48s */
```

---

## Grain overlay

`body::before` — SVG de ruido fractal inline, z-index 9990, opacity 0.022.  
Efecto visual de textura fina sobre toda la página. No tocar.
