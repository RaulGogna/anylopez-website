(function () {
  'use strict';

  /* ── Header scroll ── */
  var header = document.getElementById('siteHeader');
  if (header) {
    window.addEventListener('scroll', function () {
      header.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
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

  /* ── Testimonios carousel (compat) ── */
  (function () {
    var carousel = document.getElementById('reviewsCarousel');
    if (!carousel) return;
    var prev = document.querySelector('.carousel-prev');
    var next = document.querySelector('.carousel-next');
    var dotsContainer = document.getElementById('carouselDots');
    if (!prev || !next || !dotsContainer) return;
    var cards = carousel.querySelectorAll('.testimonial');
    var AUTOPLAY_DELAY = 5000;
    var autoplayTimer = null;
    var currentIndex = 0;
    var total = cards.length;

    var goTo = function (index) {
      currentIndex = (index + total) % total;
      cards.forEach(function (c, i) { c.classList.toggle('is-active', i === currentIndex); });
      dotsContainer.querySelectorAll('.carousel-dot').forEach(function (d, i) {
        d.classList.toggle('active', i === currentIndex);
      });
    };

    var startAutoplay = function () {
      autoplayTimer = setInterval(function () { goTo(currentIndex + 1); }, AUTOPLAY_DELAY);
    };
    var resetAutoplay = function () { clearInterval(autoplayTimer); startAutoplay(); };

    cards.forEach(function (_, i) {
      var dot = document.createElement('button');
      dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Reseña ' + (i + 1));
      dotsContainer.appendChild(dot);
      dot.addEventListener('click', function () { goTo(i); resetAutoplay(); });
    });

    prev.addEventListener('click', function () { goTo(currentIndex - 1); resetAutoplay(); });
    next.addEventListener('click', function () { goTo(currentIndex + 1); resetAutoplay(); });

    carousel.addEventListener('mouseenter', function () { clearInterval(autoplayTimer); });
    carousel.addEventListener('mouseleave', startAutoplay);
    carousel.addEventListener('touchstart', function () { clearInterval(autoplayTimer); }, { passive: true });
    carousel.addEventListener('touchend', resetAutoplay, { passive: true });

    startAutoplay();
  })();

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
