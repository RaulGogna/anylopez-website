# Landing copy rework — borrador v2 (FINAL)

Versión final tras consejo Hormozi + Kennedy + Godin (2026-04-26).
Lista para integrar en `src/index.njk`.

---

## 0. Cambios estructurales

- **Eliminar** sección "Oferta del mes" (`-30%` + "Solo 8 plazas" = deadline fabricado, prohibido por Kennedy).
- **Rediseñar** "Servicios destacados": INDIBA protagonista total con Offer Stack. Resto = tira inferior compacta.
- **Insertar** sección nueva "Legado + Equipo" (Gogna Kumar como rostro).
- **Mantener** lead-strip Formspree como vía secundaria con promesa diferenciada.
- **CTA principal** = WhatsApp en hero, footer y sección INDIBA.

---

## 1. HERO

**Eyebrow:** `Benidorm · Clínica estética desde 2018`

**H1:**
> Piel más firme.
> Más luminosa.
> *En pocas sesiones.*

**Subhead:**
> Radiofrecuencia INDIBA con protocolo personalizado. Heredamos 35 años de oficio en el cuidado de la piel y los aplicamos a cada sesión.

**CTA principal:** `Pídenos tu valoración por WhatsApp` (gratis, sin compromiso)
**CTA secundario:** `Ver pack INDIBA` (ancla a `#pack-indiba`)

**Microgarantía bajo CTAs:**
> Si tras tu Pack 10 INDIBA no notas mejora, tu sesión 11 es gratis.

---

## 2. LEAD-STRIP (mantener Formspree, diferenciar promesa)

**Label:**
> ¿No es horario de WhatsApp? Déjanos tus datos y te llamamos en menos de 24h.

(El form actual se mantiene tal cual — solo cambia el texto de la izquierda.)

---

## 3. TRUST STRIP (mantener pero corregir)

Cambiar "35 años de experiencia" → "35 años de oficio heredado".

---

## 4. INDIBA — Tratamiento estrella + Offer Stack

(Reemplaza la sección "Servicios destacados" completa + elimina "Oferta del mes")

**Etiqueta:** `Tratamiento estrella`

**Título:**
> Pack INDIBA Anti-Edad
> *10 sesiones por 400 €*

**Subtítulo:**
> Reafirma rostro o cuerpo con la tecnología que más recomendamos. Resultados visibles desde las primeras sesiones, sin cirugía y sin recuperación.

**Bloque "Qué incluye":**
- 10 sesiones de radiofrecuencia INDIBA de 30 minutos
- Diagnóstico inicial y plan personalizado por zona (rostro o corporal)
- Seguimiento de evolución sesión a sesión
- Recomendaciones de cuidado en casa para sostener el resultado
- **Garantía:** si al terminar las 10 sesiones no notas mejora, la sesión 11 es gratis

**Tabla comparativa:**

| Opción | Precio | Por sesión |
|---|---|---|
| Sesión suelta (45 min) | 65 € | 65 € |
| Pack 5 (30 min/sesión) | 225 € | 45 € |
| **Pack 10 (30 min/sesión)** | **400 €** | **40 €** |

**Nota honesta bajo tabla:**
> Las sesiones del pack son de 30 minutos; las sueltas, de 45. En la mayoría de protocolos antiedad, 30 minutos repetidos 10 veces dan mejor resultado que 5 sesiones largas espaciadas. Por eso el pack está pensado así.

**Damn Good Reason Why (Kennedy):**
> ¿Por qué exactamente 10 sesiones a 400 €? Porque es el protocolo completo. Por debajo de 10, INDIBA no consolida resultado. Lo que cobramos es lo que tu piel necesita — ni una sesión más, ni una menos.

**Valor apilado (Hormozi):**
> Valor entregado: 10 sesiones (650 €) + diagnóstico personalizado + plan de cuidado en casa + garantía sesión 11 gratis = más de 690 €.
> **Tu inversión: 400 €.**

**CTA:**
> Reservar mi Pack INDIBA por WhatsApp

---

## 5. OTROS TRATAMIENTOS (tira inferior compacta)

**Frase Godin antes del listado:**
> Nuestra especialidad es INDIBA. También hacemos HIFU, Botox y rellenos, Dermapen, Limpieza Platinum, Maderoterapia y Presoterapia. Si vienes por uno de estos, te atendemos igual de bien — pero si pudieras venir por uno solo, te diríamos INDIBA.

**Listado:** chips/links pequeños horizontales, cada uno enlaza a `/services/#<slug>`.

---

## 6. POR QUÉ ELEGIRNOS (corregir narrativa)

Cambiar primera tarjeta:
- ~~"Desde 1989 transformando pieles…"~~
- → **35 años de oficio, clínica desde 2018.** "Heredamos un saber argentino de 35 años en el cuidado de la piel. Hoy lo aplicamos cada día en Benidorm, con la misma exigencia."

(Resto de las 4 tarjetas se mantienen, solo se ajusta esta primera.)

---

## 7. LEGADO + EQUIPO (sección NUEVA)

Insertar después de "Por qué elegirnos", antes de "Proceso".

### Bloque A — Legado

**Etiqueta:** `Nuestra historia`

**Título:**
> 35 años de oficio.
> Una clínica fiel a ese legado.

**Cuerpo (en presente, voz Godin):**
> Esta clínica empezó en 2018, heredando 35 años de oficio de una esteticista argentina que entendía algo: la piel no se maltrata, se escucha. Hoy seguimos haciéndolo así.
>
> No vendemos sesiones de más. No tratamos lo que no necesitas. Si tu piel no necesita INDIBA, te lo diremos.
>
> Cada persona es única y cada piel tiene sus propias necesidades. Por eso no aplicamos protocolos en serie: hablamos contigo, valoramos tu piel y diseñamos un plan a tu medida.

### Bloque B — Equipo

**Etiqueta:** `Quién está hoy detrás de la clínica`

**Tarjeta principal:**
- **Foto:** `/images/kumar-gafas-fondo-blanco-hombro.png`
- **Nombre:** Gogna Kumar
- **Rol:** Director de la clínica
- **Bio (en primera persona):**
> Asumí la dirección de AnyLopez para que el cuidado que define a esta clínica siga aquí, en Benidorm, con las mismas manos expertas y la misma tecnología certificada.
>
> No vendo paquetes más largos de lo que tu piel necesita. No empiezo un tratamiento sin valoración. Si tienes dudas antes de empezar, escríbeme tú directamente al WhatsApp de la clínica — prefiero perder una venta a que llegues sin todas tus preguntas resueltas.
- **CTA dentro de la tarjeta:** `Escribir directamente a Kumar`

---

## 8. TESTIMONIOS (mantener bloque, ajustar criterio)

El bloque actual tiene 3 reseñas. **Mantener las 3 actuales** (Cris, Pedro, María — son reales) y **ampliar a 6 cuando se identifiquen 3 más** que cumplan criterio del consejo:
- Recientes (últimos 12 meses)
- Mencionar INDIBA + resultado concreto, o trato personalizado
- Foto de perfil de Google visible
- Nombre real

**Pendiente:** identificar 3 reseñas más concretas (Raúl/Kumar pueden seleccionarlas de Google).

**Subtítulo del bloque (cambio menor):**
> Más de 216 personas confían en nosotras. Estas son algunas de sus historias — todas reales, todas en nuestro perfil de Google.

---

## 9. CTA FINAL (reescribir)

**Título:**
> ¿Empezamos por una valoración?

**Subtítulo:**
> Cuéntanos qué te preocupa de tu piel. Te respondemos por WhatsApp en horario de clínica, sin compromiso y sin formularios largos.

**CTA principal:** `Escríbenos por WhatsApp`
**Microcopy bajo el botón:**
> Lun–Vie · 10:00–14:00 / 16:00–20:00 · C/ Marqués de Comillas 4, Benidorm

(Mantener teléfonos a la derecha como ahora.)

---

## Avatar — para SEO/microcopy interno

Mujer 35-55, residente en Benidorm o comarca (Marina Baixa), con primeros signos de flacidez facial o corporal, que rechaza pasar por quirófano y prefiere tratamientos no invasivos. (No se menciona literal en la landing — guía el tono.)
