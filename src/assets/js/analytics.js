/* Google Analytics 4 + Consent Mode v2 — AnyLopez
 * Cumple AEPD: pings cookieless por defecto, cookies solo tras consent.
 * Eventos custom V1: whatsapp_clicked, phone_clicked, form_started, form_submitted,
 *   chat_opened, chat_message_sent, treatment_modal_opened, scroll_depth, lang_switched, outbound_clicked.
 */
(function () {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

  var MEASUREMENT_ID = document.documentElement.dataset.gaId;
  if (!MEASUREMENT_ID) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };

  var consent = localStorage.getItem('gaConsent');

  gtag('consent', 'default', {
    analytics_storage: consent === 'granted' ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
  document.head.appendChild(s);

  window.addEventListener('anylopez-consent-update', function (e) {
    var granted = e.detail && e.detail.granted;
    gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied'
    });
  });

  window.addEventListener('anylopez-chat', function (e) {
    var type = e.detail && e.detail.type;
    if (type === 'opened') gtag('event', 'chat_opened');
    if (type === 'message_sent') gtag('event', 'chat_message_sent');
  });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('a, [data-ga-event]');
    if (!el) return;
    var name = el.getAttribute('data-ga-event');
    if (name) {
      var props = {};
      var raw = el.getAttribute('data-ga-props');
      if (raw) { try { props = JSON.parse(raw); } catch (err) {} }
      if (el.tagName === 'A' && el.hostname && el.hostname !== location.hostname && !props.url) {
        props.url = el.href;
        props.hostname = el.hostname;
      }
      gtag('event', name, props);
      return;
    }
    if (el.tagName === 'A' && el.hostname && el.hostname !== location.hostname && el.protocol.indexOf('http') === 0) {
      gtag('event', 'outbound_clicked', { url: el.href, hostname: el.hostname });
    }
  }, true);

  var formsStarted = new WeakSet();
  document.addEventListener('focusin', function (e) {
    var form = e.target.closest('form');
    if (!form || formsStarted.has(form)) return;
    formsStarted.add(form);
    var formName = form.dataset.formName || form.id || 'unknown';
    gtag('event', 'form_started', { form: formName });
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var formName = form.dataset.formName || form.id || 'unknown';
    gtag('event', 'form_submitted', { form: formName });
  });

  (function initScrollDepth() {
    var milestones = [25, 50, 75, 100];
    var fired = new Set();
    function onScroll() {
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      var pct = Math.round((window.scrollY / docHeight) * 100);
      milestones.forEach(function (m) {
        if (pct >= m && !fired.has(m)) {
          fired.add(m);
          gtag('event', 'scroll_depth', { depth: m });
        }
      });
      if (fired.size === milestones.length) {
        window.removeEventListener('scroll', onScroll);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  })();
})();
