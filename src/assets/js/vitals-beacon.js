/* Web Vitals beacon — sample 25%, sendBeacon a anylopez-rum Worker
 * No cookies, no localStorage. Datos anónimos agregados.
 * Skip en localhost para no contaminar el dataset.
 */
(function() {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

  // Sample rate 25% — decisión por sesión
  if (Math.random() >= 0.25) return;

  var ENDPOINT = 'https://anylopez-rum.anylopez.workers.dev/vitals';

  function detectDevice() {
    var w = window.innerWidth || document.documentElement.clientWidth;
    var ua = navigator.userAgent || '';
    if (/iPad|tablet/i.test(ua) || (w >= 768 && w < 1024)) return 'tablet';
    if (/Mobi|Android|iPhone/i.test(ua) || w < 768) return 'mobile';
    return 'desktop';
  }

  var navType = (function() {
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      return nav && nav.type ? nav.type : 'navigate';
    } catch (e) { return 'navigate'; }
  })();

  function send(metric) {
    var payload = {
      url: location.href,
      metric: metric.name,
      value: metric.value,
      rating: metric.rating || 'good',
      device: detectDevice(),
      navigation_type: navType
    };
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(ENDPOINT, blob);
      } else {
        fetch(ENDPOINT, { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
      }
    } catch (e) { /* ignore */ }
  }

  // Carga web-vitals desde unpkg (~3KB gzipped)
  var s = document.createElement('script');
  s.src = 'https://unpkg.com/web-vitals@4.2.4/dist/web-vitals.iife.js';
  s.async = true;
  s.onload = function() {
    if (!window.webVitals) return;
    window.webVitals.onLCP(send);
    window.webVitals.onCLS(send);
    window.webVitals.onINP(send);
    window.webVitals.onFCP(send);
    window.webVitals.onTTFB(send);
  };
  document.head.appendChild(s);
})();
