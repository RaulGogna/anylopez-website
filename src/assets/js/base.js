(function () {
  'use strict';

  /* ── Header scroll ── */
  var header = document.getElementById('siteHeader');
  if (header) {
    var syncHeader = function () {
      header.classList.toggle('scrolled', window.scrollY > 60);
    };
    syncHeader();
    window.addEventListener('scroll', syncHeader, { passive: true });
    window.addEventListener('pageshow', syncHeader);
  }

  /* ── Mobile hamburger ── */
  var toggle = document.getElementById('menuToggle');
  var menu = document.getElementById('navMenu');
  if (toggle && menu) {
    var setMenu = function (open) {
      menu.classList.toggle('open', open);
      toggle.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
    };
    toggle.addEventListener('click', function () {
      setMenu(!menu.classList.contains('open'));
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
  }

  /* ── Lang switcher dropdown ── */
  (function () {
    var btn = document.getElementById('langBtn');
    var dropdown = document.getElementById('langDropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', function () {
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });

    dropdown.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        var chosenLang = a.getAttribute('data-lang');
        localStorage.setItem('anylopez-lang', chosenLang);
      });
    });
  })();

  /* ── Scroll reveal ── */
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.rv').forEach(function (el) { observer.observe(el); });
  }

  /* ── Language auto-detect ──
   * Lee el mapa ES↔EN inyectado como <script id="pages-i18n-map" type="application/json"> */
  (function () {
    var stored = localStorage.getItem('anylopez-lang');
    if (stored) return;
    var lang = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
    if (!lang.startsWith('en')) return;
    var isEnPage = location.pathname.indexOf('/en/') !== -1;
    if (isEnPage) { localStorage.setItem('anylopez-lang', 'en'); return; }
    var mapEl = document.getElementById('pages-i18n-map');
    if (!mapEl) return;
    var map = {};
    try { map = JSON.parse(mapEl.textContent || '{}'); } catch (e) { return; }
    var target = map[location.pathname];
    if (target) {
      localStorage.setItem('anylopez-lang', 'en');
      location.replace(target);
    }
  })();
})();
