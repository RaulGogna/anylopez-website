// booking.js — lazy-load aware, vanilla JS
(function () {
  const root = document.querySelector(".booking-section");
  if (!root) return;

  const TXT = window.__BOOKING_TXT__;
  const LOCALE = window.__BOOKING_LOCALE__ || "es-ES";
  // La cita es presencial en Benidorm: toda fecha/hora de cara a la paciente se formatea
  // en Europe/Madrid, nunca en la zona horaria del dispositivo que abre la web.
  const CLINIC_TZ = "Europe/Madrid";
  const API = root.getAttribute("data-api");
  const FORMSPREE_ID = root.getAttribute("data-formspree") || "PLACEHOLDER_FORMSPREE_ID";
  const WA_NUMBER = (root.getAttribute("data-wa") || "34XXXXXXXXX").replace(/\D/g, "");
  const capFirst = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  const els = {
    body:      root.querySelector(".booking-body"),
    loading:   root.querySelector('[data-bind="loading"]'),
    error:     root.querySelector('[data-bind="error"]'),
    days:      root.querySelector('[data-bind="days"]'),
    monthLbl:  root.querySelector('[data-bind="month-label"]'),
    dayLbl:    root.querySelector('[data-bind="day-label"]'),
    slotList:  root.querySelector('[data-bind="slots"]'),
    noSlots:   root.querySelector('[data-bind="no-slots"]'),
    modal:     root.querySelector('[data-bind="modal"]'),
    form:      root.querySelector('[data-bind="form"]'),
    formSlot:  root.querySelector('[data-bind="form-slot"]'),
    modalTtl:  root.querySelector('[data-bind="modal-title"]'),
    success:   root.querySelector('[data-bind="success"]'),
  };

  let state = {
    cursor: startOfMonth(new Date()),
    selectedDay: null,
    slotsByDay: new Map(), // "YYYY-MM-DD" -> [{start, end}, ...]
    loadedRange: null,
  };

  // Lazy-load: solo arrancar cuando la sección entra en viewport.
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        boot();
      }
    }, { rootMargin: "300px" });
    io.observe(root);
  } else {
    boot();
  }

  async function boot() {
    try {
      await loadAvailability();
      els.loading.hidden = true;
      els.body.hidden = false;
      renderMonth();
      bindNav();
      bindForm();
    } catch (err) {
      console.error("[booking] boot failed", err);
      els.loading.hidden = true;
      els.error.hidden = false;
    }
  }

  async function loadAvailability() {
    const from = isoDate(startOfMonth(state.cursor));
    const toDate = endOfMonthPlusBuffer(state.cursor);
    const to = isoDate(toDate);
    if (state.loadedRange === `${from}:${to}`) return;
    const url = `${API}?from=${from}&to=${to}`;
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.slotsByDay.clear();
    for (const s of data.slots || []) {
      // s.start es un instante UTC del servidor: la clave del dia se calcula en
      // Europe/Madrid, o un hueco de tarde puede caer en otro dia del calendario.
      const d = DIA_CLINICA.format(new Date(s.start));
      if (!state.slotsByDay.has(d)) state.slotsByDay.set(d, []);
      state.slotsByDay.get(d).push(s);
    }
    state.loadedRange = `${from}:${to}`;
  }

  function bindNav() {
    root.querySelectorAll(".booking-nav-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const dir = btn.getAttribute("data-action") === "prev" ? -1 : 1;
        state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + dir, 1);
        state.selectedDay = null;
        state.loadedRange = null;
        els.loading.hidden = false;
        els.body.hidden = true;
        try {
          await loadAvailability();
          els.loading.hidden = true;
          els.body.hidden = false;
          renderMonth();
          renderSlots();
        } catch {
          els.loading.hidden = true;
          els.error.hidden = false;
        }
      });
    });
  }

  function renderMonth() {
    const monthStart = startOfMonth(state.cursor);
    // monthStart es un dia de calendario (no un instante real): se ancla a mediodia UTC
    // antes de formatear en Europe/Madrid, o el label podria mostrar el mes anterior/siguiente
    // en dispositivos con desfase horario extremo (ver isoDate mas abajo, mismo problema).
    const monthLabelDate = new Date(Date.UTC(monthStart.getFullYear(), monthStart.getMonth(), 1, 12));
    els.monthLbl.textContent = capFirst(monthLabelDate.toLocaleDateString(LOCALE, {
      month: "long", year: "numeric", numberingSystem: "latn", timeZone: CLINIC_TZ,
    }));

    els.days.innerHTML = "";
    const firstDow = (monthStart.getDay() + 6) % 7; // L=0
    for (let i = 0; i < firstDow; i++) {
      const empty = document.createElement("span");
      els.days.appendChild(empty);
    }
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
      const iso = isoDate(date);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "booking-day";
      btn.textContent = String(d);
      const slots = state.slotsByDay.get(iso) || [];
      const isPast = date < today;
      if (slots.length === 0 || isPast) {
        btn.disabled = true;
      } else {
        btn.classList.add("has-slots");
        btn.addEventListener("click", () => selectDay(iso));
      }
      if (date.getTime() === today.getTime()) btn.classList.add("today");
      if (state.selectedDay === iso) btn.classList.add("selected");
      els.days.appendChild(btn);
    }
  }

  function selectDay(iso) {
    state.selectedDay = state.selectedDay === iso ? null : iso;
    renderMonth();
    renderSlots();
  }

  function renderSlots() {
    els.slotList.innerHTML = "";
    if (!state.selectedDay) {
      els.dayLbl.textContent = TXT.pickDay;
      els.noSlots.hidden = true;
      return;
    }
    const slots = state.slotsByDay.get(state.selectedDay) || [];
    // state.selectedDay es "YYYY-MM-DD" (dia de calendario, no instante): ancla a mediodia UTC
    // por la misma razon que monthLabelDate, antes de formatear en Europe/Madrid.
    const date = new Date(`${state.selectedDay}T12:00:00Z`);
    els.dayLbl.textContent = capFirst(date.toLocaleDateString(LOCALE, {
      weekday: "long", day: "numeric", month: "long", numberingSystem: "latn", timeZone: CLINIC_TZ,
    }));
    if (slots.length === 0) {
      els.noSlots.hidden = false;
      return;
    }
    els.noSlots.hidden = true;
    for (const s of slots) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "booking-slot";
      const t = new Date(s.start);
      btn.textContent = t.toLocaleTimeString(LOCALE, {
        hour: "2-digit", minute: "2-digit", hour12: false, numberingSystem: "latn", timeZone: CLINIC_TZ,
      });
      btn.addEventListener("click", () => openModal(s));
      li.appendChild(btn);
      els.slotList.appendChild(li);
    }
  }

  function openModal(slot) {
    els.formSlot.value = slot.start;
    const t = new Date(slot.start);
    els.modalTtl.textContent = capFirst(t.toLocaleString(LOCALE, {
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false, numberingSystem: "latn", timeZone: CLINIC_TZ,
    }));
    els.success.hidden = true;
    els.form.hidden = false;
    if (typeof els.modal.showModal === "function") els.modal.showModal();
    else els.modal.setAttribute("open", "");
  }

  function bindForm() {
    root.querySelector('[data-action="cancel"]').addEventListener("click", () => {
      els.modal.close ? els.modal.close() : els.modal.removeAttribute("open");
    });
    els.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(els.form);
      const payload = {
        slot: fd.get("slot"),
        name: fd.get("name"),
        phone: fd.get("phone"),
        treatment: fd.get("treatment"),
        notes: fd.get("notes") || "",
        source: "booking-custom",
      };
      // La clinica es de recepcion espanola: si la paciente escribe en otro idioma,
      // el select trae el nombre del tratamiento en espanol via data-es (ver booking.njk).
      const optSel = els.form.querySelector('select[name="treatment"] option:checked');
      const treatmentEs = (optSel && optSel.dataset.es) || payload.treatment;
      const t = new Date(payload.slot);
      const fechaTxt = t.toLocaleDateString(LOCALE, {
        weekday: "long", day: "numeric", month: "long", numberingSystem: "latn", timeZone: CLINIC_TZ,
      });
      const horaTxt = t.toLocaleTimeString(LOCALE, {
        hour: "2-digit", minute: "2-digit", hour12: false, numberingSystem: "latn", timeZone: CLINIC_TZ,
      });
      // Fallback ES simetrico al de waTpl: si faltara waNotes, unas notas con alergias/avisos
      // no debe desaparecer del mensaje sin que nadie se entere.
      const waNotesTpl = TXT.waNotes || " Notas: {notes}.";
      const notesFragment = payload.notes ? fill(waNotesTpl, { notes: payload.notes }) : "";
      // Fallback ES si el diccionario aún no trae waTemplate, para no romper la reserva.
      const waTpl = TXT.waTemplate || "Hola, acabo de reservar el {date} a las {time} para {treatment}. Mi nombre: {name}.{notes} Espero vuestra confirmación, ¡gracias!";
      let msg = fill(waTpl, {
        date: fechaTxt, time: horaTxt, treatment: payload.treatment, name: payload.name, notes: notesFragment,
      });
      // Recepcion siempre lee en espanol: si la paciente escribe en otro idioma, el mensaje
      // sigue en el suyo y se le añade una linea final en espanol con fecha/hora/tratamiento
      // para que la clinica pueda leer su propia reserva. Deliberadamente monolingue y fuera
      // de los diccionarios: meterla ahi repetiria el mismo espanol en los 7 archivos y el
      // verificador de paridad marcaria como sospechosa una cadena identica a la espanola.
      if (!LOCALE.startsWith("es")) {
        const fechaEs = t.toLocaleDateString("es-ES", {
          weekday: "long", day: "numeric", month: "long", numberingSystem: "latn", timeZone: CLINIC_TZ,
        });
        const horaEs = t.toLocaleTimeString("es-ES", {
          hour: "2-digit", minute: "2-digit", hour12: false, numberingSystem: "latn", timeZone: CLINIC_TZ,
        });
        msg += `\n\n— Cita: ${fechaEs} a las ${horaEs} · ${treatmentEs}`;
      }
      const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;

      // Lead a Formspree (no bloquear si falla)
      try {
        await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.warn("[booking] formspree failed", err);
      }

      window.open(waUrl, "_blank", "noopener");
      els.form.hidden = true;
      els.success.hidden = false;
    });
  }

  // Helpers
  // Clave de dia en Europe/Madrid ("YYYY-MM-DD", mismo formato que isoDate) para agrupar
  // huecos que llegan como instante UTC del servidor.
  const DIA_CLINICA = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  });
  function fill(tpl, vars) {
    if (typeof tpl !== "string") console.warn("[booking] fill(): plantilla no es una cadena", tpl);
    return String(tpl || "").replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  }
  function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonthPlusBuffer(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 7); // 7 días extra para mostrar inicio del mes siguiente
  }
})();
