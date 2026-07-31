# Compliance AI Act — chatbot IA (anylopez-chat)

**Estado:** 🟡 PENDIENTE — anotado 2026-07-31, sin implementar


## Context

El **Reglamento (UE) 2024/1689 de IA (AI Act)** entra en aplicación general el **2 de agosto de 2026** (Art. 113) — es decir, en 2 días. El **Art. 50.1** obliga a que los sistemas de IA destinados a interactuar directamente con personas físicas estén diseñados para que el usuario sea informado de que está interactuando con una IA, salvo que resulte evidente para una persona razonablemente informada. Aplica directamente al widget `<anylopez-chat>` (`src/assets/chat/widget.min.js` + backend `anylopez-chat.anylopez.workers.dev`).

**Estado actual del widget** (revisado 2026-07-31):
- El header del panel ya dice "AnyLopez — Asistente virtual" (`#header-title`).
- El disclaimer explícito de IA ("Este chat usa IA para responder tus dudas...") solo aparece en el **consent banner**, que se muestra la primera vez que el usuario pulsa el bubble/greeting — es decir, **después** de que ya vio el saludo inicial (`#greeting`: "Hola, ¿tienes alguna duda sobre nuestros tratamientos?"), que no menciona IA.
- No está claro si "Asistente virtual" por sí solo cumple el estándar de "evidente para una persona razonablemente informada" que exige el Art. 50, o si hace falta un disclosure más explícito antes/en el primer contacto.

## Gaps a evaluar (sin decidir aún)

1. **Disclosure en el primer contacto**: si el saludo inicial (`#greeting`) o el propio bubble deben mencionar explícitamente "IA"/"asistente automatizado" en vez de dejarlo solo en el consent banner.
2. **Alcance del consentimiento vs. mera información**: Art. 50 pide *informar*, no necesariamente pedir consentimiento — revisar si el consent banner actual (enfocado a privacidad/RGPD) cubre también la obligación de transparencia de IA o si son cosas distintas que conviene separar en el copy.
3. **Ubicación del código fuente del widget**: `src/assets/chat/widget.min.js` en este repo es el **bundle minificado**; el código fuente (sin minificar) no vive en `anylopez-website` — hay que localizarlo (probablemente junto al repo del Worker `anylopez-chat`) antes de poder editar copy con seguridad.
4. **Alcance más amplio**: confirmar si aplica algo más del AI Act al resto del sitio (no parece — solo el chatbot es un sistema de IA con interacción directa) y si el Worker backend tiene sus propias obligaciones (p. ej. logging/documentación como "provider" del sistema de IA).

## Siguiente paso

Pendiente de decisión con el cliente/negocio sobre alcance exacto antes de tocar código. No se ha implementado ningún cambio todavía.
