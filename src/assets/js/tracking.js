/* Tracking bridge — AnyLopez (Umami Cloud)
 * Eventos custom emitidos via umami.track(). Sin cookies, sin consentimiento.
 * Atributos HTML: data-event="name" data-event-props='{"key":"value"}'
 * Eventos auto: outbound_clicked, form_started, form_submitted, scroll_depth.
 * Eventos custom escuchados: anylopez-chat { type: 'opened' | 'message_sent' }.
 */
(function () {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

  function track(name, props) {
    if (typeof window.umami === 'undefined') return;
    if (typeof window.umami.track === 'function') {
      props ? window.umami.track(name, props) : window.umami.track(name);
    }
  }

  window.addEventListener('anylopez-chat', function (e) {
    var type = e.detail && e.detail.type;
    if (type === 'opened') track('chat_opened');
    if (type === 'message_sent') track('chat_message_sent');
  });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('a, [data-event]');
    if (!el) return;
    var name = el.getAttribute('data-event');
    if (name) {
      var props = {};
      var raw = el.getAttribute('data-event-props');
      if (raw) { try { props = JSON.parse(raw); } catch (err) {} }
      if (el.tagName === 'A' && el.hostname && el.hostname !== location.hostname && !props.url) {
        props.url = el.href;
        props.hostname = el.hostname;
      }
      track(name, props);
      return;
    }
    if (el.tagName === 'A' && el.hostname && el.hostname !== location.hostname && el.protocol.indexOf('http') === 0) {
      track('outbound_clicked', { url: el.href, hostname: el.hostname });
    }
  }, true);

  var formsStarted = new WeakSet();
  document.addEventListener('focusin', function (e) {
    var form = e.target.closest('form');
    if (!form || formsStarted.has(form)) return;
    formsStarted.add(form);
    var formName = form.dataset.formName || form.id || 'unknown';
    track('form_started', { form: formName });
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var formName = form.dataset.formName || form.id || 'unknown';
    track('form_submitted', { form: formName });
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
          track('scroll_depth', { depth: m });
        }
      });
      if (fired.size === milestones.length) {
        window.removeEventListener('scroll', onScroll);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  })();
})();
