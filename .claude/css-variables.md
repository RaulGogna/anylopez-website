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

| Uso | Fuente | Pesos |
|-----|--------|-------|
| Headings (h1–h5) | Cormorant Garamond, serif | 300, 400, 600, 700 (+ itálica) |
| Body, UI, botones | Jost, sans-serif | 300, 400, 500, 600 |

```css
.section-title    { font-size: clamp(28px, 4vw, 56px); }
.eyebrow          { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--terra); }
.section-subtitle { font-size: 16px; color: var(--text-mid); max-width: 600px; }
```

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
