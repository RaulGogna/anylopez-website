(function () {
  'use strict';

  const dialog = document.getElementById('trat-modal');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const WA_NUMBER = dialog.dataset.waNumber;
  const PHONE_NUMBER = dialog.dataset.phone;
  const IMG_BASE = window.__TRAT_IMG_BASE || '/images/tratamientos/';

  // El catálogo se pide al primer uso; si la petición falla se vuelve a intentar en el siguiente.
  let catalogo = null;
  function cargarCatalogo() {
    if (!catalogo) {
      catalogo = fetch(dialog.dataset.catalog)
        .then((res) => {
          if (!res.ok) throw new Error('catalogo ' + res.status);
          return res.json();
        })
        .then((data) => ({
          garantiaDefault: data.garantiaDefault || '',
          catById: Object.fromEntries(data.categorias.map((c) => [c.id, c])),
          tratBySlug: Object.fromEntries(data.tratamientos.map((t) => [t.slug, t])),
        }));
      catalogo.catch(() => { catalogo = null; });
    }
    return catalogo;
  }

  function fillSlot(field, value) {
    dialog.querySelectorAll('[data-field="' + field + '"]').forEach((el) => {
      el.textContent = value || '';
    });
  }

  function hydrate(trat, { catById, garantiaDefault }) {
    const cat = catById[trat.categoria] || {};
    const png = IMG_BASE + trat.imagen;
    const webp = png.replace('.png', '.webp');

    const sourceEl = dialog.querySelector('[data-field="imagen-webp"]');
    const imgEl = dialog.querySelector('[data-field="imagen-png"]');
    if (sourceEl) sourceEl.srcset = webp;
    if (imgEl) {
      imgEl.src = png;
      imgEl.alt = trat.nombre;
    }

    fillSlot('categoria', cat.nombre || '');
    fillSlot('nombre', trat.nombre);
    fillSlot('paraQuien', trat.paraQuien || '');
    fillSlot('descripcion', trat.descripcion);
    fillSlot('duracion', trat.duracion || '');
    fillSlot('garantia', trat.garantia || garantiaDefault);

    // Beneficios
    const benUl = dialog.querySelector('[data-field="beneficios"]');
    benUl.innerHTML = '';
    (trat.beneficios || []).forEach((b) => {
      const li = document.createElement('li');
      li.textContent = b;
      benUl.appendChild(li);
    });

    // ¿Cómo funciona?
    const comoDiv = dialog.querySelector('[data-field="comoFunciona"]');
    comoDiv.innerHTML = '';
    (trat.comoFunciona || []).forEach((p) => {
      const para = document.createElement('p');
      para.textContent = p;
      comoDiv.appendChild(para);
    });

    // Precios — pack hero + lista
    const packIdx = typeof trat.packDestacado === 'number' ? trat.packDestacado : 0;
    const precios = trat.precios || [];
    const heroBox = dialog.querySelector('[data-field="packDestacado"]');
    const precioList = dialog.querySelector('[data-field="precios"]');
    heroBox.innerHTML = '';
    precioList.innerHTML = '';
    if (precios.length) {
      const hero = precios[packIdx] || precios[0];
      const heroEl = document.createElement('div');
      heroEl.className = 'precio-hero';
      heroEl.innerHTML =
        '<span class="precio-hero-concepto">' + escapeHtml(hero.concepto) + '</span>' +
        '<span class="precio-hero-precio">' + escapeHtml(hero.precio) + '</span>';
      heroBox.appendChild(heroEl);

      precios.forEach((p, i) => {
        if (i === packIdx) return;
        const li = document.createElement('li');
        li.innerHTML =
          '<span>' + escapeHtml(p.concepto) + '</span>' +
          '<span class="precio-monto">' + escapeHtml(p.precio) + '</span>';
        precioList.appendChild(li);
      });
    }

    // Ideal para / Recomendaciones (collapsible si vacío)
    setOptional('idealPara', 'idealPara-wrap', trat.idealPara);
    setOptional('recomendaciones', 'recomendaciones-wrap', trat.recomendaciones);

    // CTAs
    const wa = dialog.querySelector('[data-field="cta-wa"]');
    const text = 'Hola, vengo de la web. Me interesa ' + trat.nombre + ' — ¿podríais ayudarme a reservar?';
    wa.href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text) + '&src=modal-' + trat.slug;
    setEventProps(wa, trat.slug, {});
    setEventProps(dialog.querySelector('.trat-modal-cta-tel'), trat.slug, { number: PHONE_NUMBER });
  }

  // tracking.js lee data-event-props en cada clic: aquí se fija a qué tratamiento corresponde.
  function setEventProps(el, slug, extra) {
    el.dataset.eventProps = JSON.stringify(Object.assign({ location: 'treatment-modal', treatment_slug: slug }, extra));
  }

  function setOptional(field, wrapField, value) {
    const wrap = dialog.querySelector('[data-field="' + wrapField + '"]');
    if (!wrap) return;
    if (value && value.trim()) {
      wrap.hidden = false;
      fillSlot(field, value);
    } else {
      wrap.hidden = true;
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  async function open(slug) {
    const datos = await cargarCatalogo();
    const trat = datos.tratBySlug[slug];
    if (!trat) return;
    hydrate(trat, datos);
    if (!dialog.open) dialog.showModal();
    if (location.hash !== '#' + slug) {
      history.replaceState(null, '', '#' + slug);
    }
    const body = dialog.querySelector('.trat-modal-body');
    if (body) body.scrollTop = 0;
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track('treatment_modal_opened', { treatment_slug: slug });
    }
  }

  function close() {
    if (dialog.open) dialog.close();
    if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-slug]');
    if (!trigger) return;
    if (dialog.contains(trigger)) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const slug = trigger.dataset.slug;
    open(slug).catch(() => location.assign(trigger.href || '#' + slug));
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  dialog.addEventListener('close', () => {
    if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  });

  function openFromHash() {
    const slug = (location.hash || '').replace(/^#/, '');
    if (slug) open(slug).catch(() => {});
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openFromHash);
  } else {
    openFromHash();
  }
  window.addEventListener('hashchange', openFromHash);
})();
