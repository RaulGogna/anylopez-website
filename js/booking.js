// booking.js — lazy-load aware, vanilla JS
(function () {
  const root = document.querySelector(".booking-section");
  if (!root) return;

  const TXT = window.__BOOKING_TXT__;
  const LANG = window.__BOOKING_LANG__ || "es";
  const API = root.getAttribute("data-api");
  const FORMSPREE_ID = root.getAttribute("data-formspree") || "PLACEHOLDER_FORMSPREE_ID";
  const WA_NUMBER = (root.getAttribute("data-wa") || "34XXXXXXXXX").replace(/\D/g, "");

  const $ = (sel) => root.querySelector(sel);
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
      const d = isoDate(new Date(s.start));
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
    els.monthLbl.textContent = monthStart.toLocaleDateString(LANG === "en" ? "en-GB" : "es-ES", {
      month: "long", year: "numeric",
    });

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
      if (state.selectedDay === iso) btn.classList.add("selected");
      els.days.appendChild(btn);
    }
  }

  function selectDay(iso) {
    state.selectedDay = iso;
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
    const date = new Date(state.selectedDay + "T00:00:00");
    els.dayLbl.textContent = date.toLocaleDateString(LANG === "en" ? "en-GB" : "es-ES", {
      weekday: "long", day: "numeric", month: "long",
    });
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
      btn.textContent = t.toLocaleTimeString(LANG === "en" ? "en-GB" : "es-ES", {
        hour: "2-digit", minute: "2-digit",
      });
      btn.addEventListener("click", () => openModal(s));
      li.appendChild(btn);
      els.slotList.appendChild(li);
    }
  }

  function openModal(slot) {
    els.formSlot.value = slot.start;
    const t = new Date(slot.start);
    els.modalTtl.textContent = t.toLocaleString(LANG === "en" ? "en-GB" : "es-ES", {
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    });
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
      const t = new Date(payload.slot);
      const fechaTxt = t.toLocaleDateString(LANG === "en" ? "en-GB" : "es-ES", {
        weekday: "long", day: "numeric", month: "long",
      });
      const horaTxt = t.toLocaleTimeString(LANG === "en" ? "en-GB" : "es-ES", {
        hour: "2-digit", minute: "2-digit",
      });
      const msg = LANG === "en"
        ? `Hi! I'd like to book ${fechaTxt} at ${horaTxt} for ${payload.treatment}. My name: ${payload.name}. Notes: ${payload.notes}`
        : `Hola, quiero reservar el ${fechaTxt} a las ${horaTxt} para ${payload.treatment}. Mi nombre: ${payload.name}. Notas: ${payload.notes}`;
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
  function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonthPlusBuffer(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 7); // 7 días extra para mostrar inicio del mes siguiente
  }
})();
