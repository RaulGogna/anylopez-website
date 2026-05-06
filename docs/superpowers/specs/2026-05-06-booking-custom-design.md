# Booking custom AnyLopez — Design Spec

**Fecha:** 2026-05-06
**Slice:** 5b (sucesor de 5a Cal.com embed)
**Modelo recomendado:** Opus (arquitectura) → Sonnet (implementación)
**Estado:** Diseño aprobado — pendiente plan de implementación

## Objetivo

Sustituir el embed de Cal.com por un sistema de booking propio que:

1. Lee disponibilidad real desde el Google Calendar de la clínica.
2. Muestra los huecos libres en la web con UX similar a Cal.com / crislorente.
3. Cuando el cliente elige un slot, se notifica a la clínica vía WhatsApp + Formspree (lead). La clínica confirma manualmente y crea el evento en GCal.
4. Sin dependencias de terceros (Cal.com, Calendly, etc.), sin OAuth de cliente, sin pagos, sin escritura en GCal.

## Decisión arquitectónica clave

**Opción A (read-only + lead)**: la web NO escribe en Google Calendar. El cliente "pide" un slot; la clínica confirma a mano. Esto elimina toda la complejidad de OAuth de cliente, transacciones, idempotencia y reversibilidad. Coherente con el flujo actual donde el contacto humano por WhatsApp cierra la venta.

## Stack

- **Frontend**: HTML/CSS/JS vanilla integrado en partial Nunjucks (`_includes/booking.njk`). Sin framework. Lazy-load con `IntersectionObserver` (mismo patrón que el Cal.com embed actual).
- **Backend**: Cloudflare Worker. Endpoint `GET /availability?from=...&to=...` devuelve slots libres de 30min. Subdominio `api.anylopez.com` (DNS Cloudflare).
- **Google Calendar**: Service Account con permiso *reader* sobre el calendar de la clínica (ej. `info@anylopez.com`). Se usa la **FreeBusy API** (no Events API) — devuelve solo bloques ocupados, más rápido y privado.
- **Auth Google**: JWT firmado en el Worker para obtener access token (cacheado 1h en KV).
- **Caché disponibilidad**: Cloudflare KV con TTL 5min. Evita rate-limit de FreeBusy y baja latencia P50 a <100ms.
- **Notificación**: dual al confirmar slot → `wa.me/34XXX?text=...` (abierto en cliente) + `POST` a Formspree (mismo endpoint que `lead-strip` actual).

## Arquitectura

```
┌──────────────────┐      HTTPS       ┌──────────────────────┐    OAuth2 SA   ┌──────────────────┐
│  Web Eleventy    │  ──────────────► │  Cloudflare Worker   │ ─────────────► │  Google Calendar │
│  (calendar UI)   │ ◄──────────────  │  api.anylopez.com    │ ◄───────────── │  (clinica@…)     │
│  vanilla JS      │      JSON        │  + KV cache          │   FreeBusy API │                  │
└──────────────────┘                  └──────────────────────┘                └──────────────────┘
        │
        │ submit slot elegido
        ▼
┌──────────────────────────────────────┐
│  wa.me/?text=...  +  Formspree (POST)│  ← notificación dual a clínica
└──────────────────────────────────────┘
```

## Componentes

| Componente | Path | Responsabilidad | LOC est. |
|---|---|---|---|
| `availability.ts` | `worker/src/availability.ts` | Endpoint `GET /availability`. Pide FreeBusy, resta del horario base, devuelve slots | ~150 |
| `google-auth.ts` | `worker/src/google-auth.ts` | Genera JWT firmado para service account → access token (cacheado en KV 1h) | ~80 |
| `booking.njk` | `src/_includes/booking.njk` | Marcado HTML del calendario y modal de confirmación | ~150 |
| `booking.css` | `src/css/booking.css` | Estilos (crema/dorado, responsive) | ~150 |
| `booking.js` | `src/js/booking.js` | Fetch availability, render mes/slots, manejo modal, wa.me + Formspree | ~180 |

**Total estimado: ~710 LOC.** Dentro del rango de un componente medio del sitio.

## Flujo de datos (request típico)

1. Usuario carga la home. Sección booking visible al hacer scroll.
2. `IntersectionObserver` dispara fetch: `GET https://api.anylopez.com/availability?from=2026-05-06&to=2026-06-05`.
3. Worker mira KV `cache:availability:2026-05-06:2026-06-05` → si miss:
   - Worker pide token a Google (KV `auth:google:token` o genera nuevo JWT).
   - Worker llama `POST https://www.googleapis.com/calendar/v3/freeBusy` con rango y calendar ID.
   - Worker recibe lista `busy[] = [{start, end}, …]`.
   - Worker calcula horario base L-V 10-14 / 16-20 menos `busy[]` → array `freeSlots[] = ["2026-05-06T10:00", "2026-05-06T10:30", …]`.
   - Worker guarda en KV con TTL 300s.
4. JS pinta calendario mes (días con ≥1 slot libre = clicables; días sin slots o no laborables = grises).
5. Usuario click en día → muestra slots del día en columna lateral (desktop) o debajo (mobile).
6. Usuario click en slot → modal con form: nombre, teléfono, tratamiento (select 6 opciones), notas opcional.
7. Usuario confirma → JS hace en paralelo:
   - `window.open("https://wa.me/34XXX?text=Hola, quiero reservar el {fecha} a las {hora} para {tratamiento}. Mi nombre: {nombre}. Notas: {notas}")`
   - `fetch("https://formspree.io/f/XXX", { method: "POST", body: JSON.stringify({...}) })`
8. UI muestra confirmación: "Te hemos abierto WhatsApp para confirmar tu cita".

**Side effects**: cero en Google Calendar. La clínica recibe notificación, confirma manualmente, crea el evento en GCal nativo. La fuente de verdad es siempre GCal.

## UI/UX

Layout estilo Cal.com / crislorente:

- **Desktop**: dos columnas. Izquierda mes con navegación `◀ Mayo 2026 ▶`. Derecha listado vertical de slots del día seleccionado.
- **Mobile**: una columna. Calendario arriba, slots abajo apilados.
- **Estados visuales**:
  - Día con slots libres: clicable, color base.
  - Día sin slots o pasado o no laborable: gris, no clicable.
  - Día seleccionado: highlight con dorado AnyLopez.
  - Slot horario: botón rectangular con hora `10:00`. Hover sutil.
- **Branding**: cero terceros. Crema (`#FAF7F0`) + dorado AnyLopez. Tipografías del sitio.
- **Modal de confirmación**: 5 campos máx, sin scroll. CTA único "Confirmar y abrir WhatsApp".

## Datos del formulario

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| Nombre | text | Sí | Min 2 chars |
| Teléfono | tel | Sí | Validación regex España (móvil/fijo) |
| Tratamiento | select | Sí | ~6 opciones: Consulta general, INDIBA, Diagnóstico facial, Limpieza facial, Depilación, Otro |
| Notas | textarea | No | Max 300 chars |
| Slot elegido | hidden | Sí | ISO 8601, populado automático |

## Configuración (constantes)

```typescript
// worker/src/config.ts
export const CONFIG = {
  CALENDAR_ID: 'info@anylopez.com', // o calendar específico
  TIMEZONE: 'Europe/Madrid',
  WORKING_HOURS: {
    1: [['10:00', '14:00'], ['16:00', '20:00']], // Lunes
    2: [['10:00', '14:00'], ['16:00', '20:00']],
    3: [['10:00', '14:00'], ['16:00', '20:00']],
    4: [['10:00', '14:00'], ['16:00', '20:00']],
    5: [['10:00', '14:00'], ['16:00', '20:00']],
    // 6, 0: cerrado
  },
  SLOT_MINUTES: 30,
  MIN_LEAD_HOURS: 2,           // no mostrar slots para dentro de <2h
  WINDOW_DAYS: 30,             // mostrar próximos 30 días
  CACHE_TTL_SECONDS: 300,      // 5min
};
```

## Defaults asumidos

1. Notificación a clínica: dual WhatsApp + Formspree.
2. Antelación mínima: 2h.
3. Ventana visualización: 30 días.
4. Slot duration: 30min fijo.
5. Subdominio Worker: `api.anylopez.com`.
6. Ubicación en web: reemplaza la sección Cal.com actual (entre hero y trust-strip).
7. Idiomas: ES + EN (mismo Worker, misma API; UI traducida en partial).

## Lo que NO hacemos (postponed)

- ❌ OAuth de cliente (login Google)
- ❌ Escritura en GCal (Events API)
- ❌ Multi-profesional / multi-cabina
- ❌ Pago Stripe
- ❌ Recordatorios SMS automáticos
- ❌ Cancelación auto desde web
- ❌ DB propia (sin estado en el Worker)
- ❌ Buffer time configurable
- ❌ Time zones múltiples (hardcoded Europe/Madrid)
- ❌ Backend admin panel (la clínica usa GCal nativo)

Cualquiera de estos puede añadirse después si hay datos que justifiquen el coste basal.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| FreeBusy API caída | KV cache 5min absorbe caídas cortas; si miss + error, UI muestra fallback "Llámanos al 96X XXX XXX" + lead-strip |
| Service account credenciales filtradas | Secret en `wrangler secret put`, nunca en repo; rotar credenciales 1×/año |
| Mostrar slot que ya no está libre (race con cita en clínica) | TTL 5min limita ventana de inconsistencia; mensaje "Te confirmamos en menos de 24h" gestiona expectativa |
| LCP penalty | Lazy-load con `IntersectionObserver` rootMargin 300px (mismo patrón Cal.com actual) |
| Coste Workers / KV | Plan free 100k req/día sobra; alerta a 80% via Workers analytics |
| Doble CTA (WhatsApp directo vs booking) | Booking se posiciona como "ver hueco real" diferenciado del WhatsApp libre |

## Basal cost

| Item | Coste continuo (% capacidad equipo) |
|---|---|
| Worker + KV | ~3% (wrangler integrado, deploys automáticos) |
| Service account GCal | ~1% (rotar 1×/año) |
| Frontend booking | ~5% (tests Playwright, mantenimiento UI) |
| **Total** | **~9%** |

Cal.com actual: 0% técnico, pero coste oculto = branding de terceros + dependencia política free tier + datos del cliente fuera de Formspree. El delta de 9% compra: control total UX, datos del cliente en Formspree, ausencia de marca de terceros, y reusabilidad para otros clientes (playbook).

## Estrategia de tests

- **Unit (Worker)**: dado `busy[]` y `workingHours`, `computeFreeSlots()` devuelve resultado correcto. Casos:
  - Día completamente libre (16 slots).
  - Día completamente ocupado por un único evento de 8h (0 slots).
  - Día con evento que parte el horario en 3 huecos.
  - Slot a caballo de la frontera 14:00-16:00 (no debe generarse).
  - Día pasado o fin de semana (0 slots).
  - Slot dentro de la ventana MIN_LEAD_HOURS (excluido).
- **Integration (Worker)**: mock de FreeBusy API con respuestas grabadas; verificar end-to-end del endpoint con `wrangler dev`.
- **E2E (Playwright)**: cargar home, scroll a sección booking, lazy-load se dispara, click día, click slot, rellenar form, click confirmar, verificar `window.open` recibe URL `wa.me` correcta y POST a Formspree con payload esperado.

## Plan de slices (alto nivel)

| Slice | Alcance | Duración est. |
|---|---|---|
| **A** | Worker + GCal: endpoint `/availability` con tests, sin UI | ~1 día |
| **B** | UI calendar contra mock local: partial + JS + CSS | ~1 día |
| **C** | Integración: UI → Worker prod, lazy-load, Playwright E2E | ~0.5 día |
| **D** | Rollout: feature flag, A/B 1 semana vs Cal.com, decidir retirada | 1 semana validación |

**Total código: ~2.5 días.** Validación: 1 semana adicional.

## Criterios de éxito

- [ ] Endpoint `/availability` p50 < 200ms con caché caliente.
- [ ] Calendar UI sin penalización LCP en home (Lighthouse ≥ 80 móvil).
- [ ] Todos los tests unit + integration verdes.
- [ ] E2E Playwright cubre el flujo completo hasta `wa.me`.
- [ ] Conversión booking custom ≥ Cal.com en periodo A/B 1 semana.
- [ ] Cero logs de error en Workers en las primeras 72h post-deploy.

## Criterios para volver atrás (kill switch)

- Tasa de error Worker > 1% durante 24h → activar feature flag para volver a Cal.com embed.
- LCP móvil cae más de 10 puntos vs línea base → idem.
- Conversión cae más de 30% en A/B → idem.
