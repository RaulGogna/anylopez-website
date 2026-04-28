(function () {
  'use strict';

  const dataEl = document.getElementById('trat-data');
  const dialog = document.getElementById('trat-modal');
  if (!dataEl || !dialog || typeof dialog.showModal !== 'function') return;

  let DATA;
  try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }

  const TRATS = DATA.tratamientos || [];
  const CATS = DATA.categorias || [];
  const GARANTIA_DEFAULT = DATA.garantiaDefault || '';

  const WA_NUMBER = '34656306167';
  const IMG_BASE = window.__TRAT_IMG_BASE || '/images/tratamientos/';
  const PERMA_BASE = window.__TRAT_PERMA_BASE || '/tratamientos/';

  const catById = Object.fromEntries(CATS.map((c) => [c.id, c]));
  const tratBySlug = Object.fromEntries(TRATS.map((t) => [t.slug, t]));

  function fillSlot(field, value) {
    dialog.querySelectorAll('[data-field="' + field + '"]').forEach((el) => {
      el.textContent = value || '';
    });
  }

  function hydrate(trat) {
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
    fillSlot('duracion', trat.duracion || '');
    fillSlot('garantia', trat.garantia || GARANTIA_DEFAULT);

    // Beneficios
    const benUl = dialog.querySelector('[data-field="beneficios"]');
    benUl.innerHTML = '';
    (trat.beneficios || trat.incluye || []).forEach((b) => {
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

    const perma = dialog.querySelector('[data-field="permalink"]');
    perma.href = PERMA_BASE + trat.slug + '/';
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

  function open(slug) {
    const trat = tratBySlug[slug];
    if (!trat) return;
    hydrate(trat);
    if (!dialog.open) dialog.showModal();
    if (location.hash !== '#' + slug) {
      history.replaceState(null, '', '#' + slug);
    }
    dialog.scrollTop = 0;
  }

  function close() {
    if (dialog.open) dialog.close();
    if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  // Click delegation: abre modal cuando se pulsa una card o el botón "Ver detalles"
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-slug]');
    if (!trigger) return;
    if (dialog.contains(trigger)) return; // ignorar clicks dentro del propio modal
    e.preventDefault();
    open(trigger.dataset.slug);
  });

  // Click en backdrop cierra (los clicks fuera de .trat-modal-body)
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  // El form method=dialog ya gestiona ESC y submit del botón close,
  // pero limpiamos el hash al cerrar.
  dialog.addEventListener('close', () => {
    if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  });

  // Deep-link al cargar
  function openFromHash() {
    const slug = (location.hash || '').replace(/^#/, '');
    if (slug && tratBySlug[slug]) open(slug);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openFromHash);
  } else {
    openFromHash();
  }
  window.addEventListener('hashchange', openFromHash);
})();
