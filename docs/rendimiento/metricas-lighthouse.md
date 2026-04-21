# Guía de métricas de rendimiento web (Lighthouse)

> Documento pensado para lectura no técnica. Explica qué significa cada número que aparece en los informes de rendimiento del sitio y cómo se usa en el día a día del proyecto.

---

## 1. ¿Qué es un "baseline"?

Un **baseline** es una foto del rendimiento de la web **antes de tocar nada**. Se toma al empezar cualquier trabajo de optimización y sirve para:

- **Comparar**: sin baseline no podemos decir "hemos mejorado 40 puntos", solo "ahora va bien".
- **Detectar regresiones**: si un cambio empeora algo, lo vemos al instante.
- **Priorizar**: el baseline nos dice dónde duele más y ahí atacamos primero.

**Regla de oro:** todas las mediciones tienen que hacerse en el mismo entorno (misma URL, misma red, misma configuración). Si cambiamos de ordenador o de red, los números dejan de ser comparables.

---

## 2. ¿Qué es Lighthouse?

Es una herramienta gratuita de Google que audita una página web y le pone nota en cuatro áreas:

- **Performance** (velocidad) — es la que nos ocupa ahora
- **Accessibility** (accesibilidad)
- **Best Practices** (buenas prácticas)
- **SEO** (posicionamiento)

Genera un informe HTML visual con puntuación, métricas detalladas y recomendaciones ordenadas por impacto.

---

## 3. Las métricas explicadas

### Performance score (0–100)

Es una **nota global** que resume todas las métricas de velocidad en un único número.

- **≥90** → verde, rendimiento bueno
- **50–89** → naranja, mejorable
- **<50** → rojo, mal rendimiento

No es una métrica en sí, es un resumen ponderado. Sirve para saber "de un vistazo" cómo estamos.

---

### LCP — Largest Contentful Paint

**Traducción práctica:** cuánto tarda en aparecer el elemento más grande que ve el usuario (típicamente la foto del hero, un titular grande o un logo).

- Es la métrica que más se acerca a la percepción humana de "ya ha cargado".
- **Target Google: <2.5 segundos**.
- Si LCP es muy alto, el visitante ve una pantalla casi vacía durante mucho tiempo — probabilidad altísima de que se vaya antes de convertir.

> **Curiosidad:** si la imagen principal tarda demasiado, Lighthouse elige "lo siguiente más grande que ve" como elemento LCP. Por eso a veces el elemento LCP resulta ser un logo pequeño: es el único contenido visible durante mucho rato.

---

### FCP — First Contentful Paint

**Traducción práctica:** primer píxel de contenido real que aparece en pantalla — un texto, un logo, un icono. El fondo o el color no cuentan.

- **Target: <1.8 segundos**.
- Si FCP es alto, el problema suele estar en:
  - Red lenta
  - Archivos CSS o JavaScript que bloquean el pintado
  - HTML muy pesado

---

### CLS — Cumulative Layout Shift

**Traducción práctica:** cuánto "salta" la página mientras carga.

Ejemplo típico: estás a punto de pulsar un botón y una imagen que se acaba de cargar empuja el contenido hacia abajo — acabas pulsando otra cosa. Eso es CLS alto.

- Es adimensional (sin unidad). **0 es perfecto**, >0.25 es malo.
- Se evita declarando siempre `width` y `height` en las imágenes y reservando espacio para anuncios o banners.

---

### TBT — Total Blocking Time

**Traducción práctica:** cuánto tiempo el navegador está "congelado" sin poder responder a clics o scroll, porque está ocupado ejecutando JavaScript.

- **Target: <200 ms**.
- Valores altos significan que la página puede verse cargada pero no responde cuando el usuario toca algo.
- Típicamente causado por JS pesado ejecutándose al cargar (sliders, scripts de terceros, etc.).

---

### SI — Speed Index

**Traducción práctica:** a qué velocidad se va llenando visualmente la pantalla, frame a frame.

- **Target: <3.4 segundos**.
- Mide la *percepción* de velocidad: una página que va pintando contenido progresivamente se percibe más rápida que una que está en blanco y aparece de golpe al final.

---

### TTI — Time to Interactive

**Traducción práctica:** cuándo la página responde de forma fiable y rápida al usuario.

- **Target: <3.8 segundos**.
- Una página puede verse completa (LCP bueno) pero aún no ser usable (JavaScript sigue cargando). TTI mide cuándo deja de pasar eso.

---

### Total byte weight (peso total)

**Traducción práctica:** suma de todo lo que el navegador descarga para mostrar la página — HTML, CSS, JavaScript, imágenes, vídeos, fuentes.

- **Presupuesto razonable en móvil: 2–3 MB**.
- Sobrepasar ese presupuesto penaliza directamente a usuarios con conexiones lentas o planes de datos limitados (la mayoría del tráfico móvil).

---

## 4. Opportunities (oportunidades de mejora)

Al final del informe, Lighthouse lista sugerencias **ordenadas por el ahorro estimado** en tiempo o peso. Las más habituales:

- **Properly size images** — servimos imágenes más grandes de lo que se muestran en pantalla (ej. imagen de 2000×2000 px mostrada en un cuadrado de 400×400).
- **Eliminate render-blocking resources** — archivos CSS o JS en la cabecera que impiden al navegador pintar nada hasta que terminen de descargarse.
- **Enable text compression** — usar gzip/brotli en el servidor para comprimir HTML, CSS y JS antes de enviarlos. En desarrollo local suele estar desactivado; en producción (GitHub Pages) está activo.
- **Serve images in next-gen formats** — usar WebP o AVIF en vez de JPG/PNG.
- **Defer offscreen images** — no cargar imágenes hasta que el usuario esté cerca de verlas (lazy loading).

---

## 5. ¿Cómo se usa todo esto en el proyecto?

1. **Baseline**: antes de empezar cualquier optimización se toma un Lighthouse de referencia.
2. **Iteración**: después de cada cambio significativo se vuelve a medir y se compara contra el baseline. El delta se apunta en el `aiplan` correspondiente.
3. **Validación final**: la fase de optimización no se considera terminada hasta alcanzar los objetivos definidos (ejemplo actual: Performance ≥90 y LCP <2.5s).
4. **Evidencia**: el informe final queda guardado junto al código como prueba documental del trabajo realizado.

---

## 6. Cómo ejecutar Lighthouse manualmente

### Opción A — Chrome DevTools (interfaz gráfica)

1. Abrir la web en Chrome.
2. Pulsar `F12` para abrir DevTools.
3. Ir a la pestaña **Lighthouse**.
4. Configurar: *Mode* = Navigation · *Device* = Mobile · *Categories* = Performance.
5. Pulsar **Analyze page load** y esperar unos 30 segundos.
6. Cuando termine, el informe aparece en pantalla. Se puede guardar como HTML.

### Opción B — Línea de comandos (automatizable)

Desde la raíz del proyecto con el servidor local arrancado:

```bash
npx lighthouse http://localhost:8080/anylopez-website/ \
  --form-factor=mobile \
  --screenEmulation.mobile \
  --throttling-method=simulate \
  --only-categories=performance \
  --output=html --output=json \
  --output-path=./lighthouse-baseline-mobile \
  --chrome-flags="--headless=new --no-sandbox"
```

Genera dos archivos: uno HTML (legible visualmente) y uno JSON (para extraer métricas con scripts).

---

## 7. Glosario rápido

| Sigla | Significado | Qué mide |
|---|---|---|
| LCP | Largest Contentful Paint | Cuándo aparece el elemento visible más grande |
| FCP | First Contentful Paint | Primer píxel de contenido real |
| CLS | Cumulative Layout Shift | Cuánto se mueve el contenido al cargar |
| TBT | Total Blocking Time | Tiempo que el navegador está "congelado" |
| SI | Speed Index | Rapidez percibida de la carga visual |
| TTI | Time to Interactive | Cuándo la página responde al usuario |
