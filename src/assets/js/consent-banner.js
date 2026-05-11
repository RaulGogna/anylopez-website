/* Consent banner — AnyLopez
 * Banner inferior. Aparece si no hay decisión previa.
 * Persiste en localStorage.gaConsent = 'granted' | 'denied'
 * Dispara evento 'anylopez-consent-update' { granted: bool } para analytics.js
 */
(function () {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
  if (localStorage.getItem('gaConsent')) return;

  var lang = document.documentElement.lang || 'es';
  var isEN = lang.indexOf('en') === 0;

  var T = isEN ? {
    text: 'We use cookies for anonymous analytics to improve the site. ',
    link: 'Read more',
    accept: 'Accept',
    reject: 'Reject'
  } : {
    text: 'Usamos cookies para analítica anónima y mejorar el sitio. ',
    link: 'Más info',
    accept: 'Aceptar',
    reject: 'Rechazar'
  };

  var privacyHref = isEN ? '/en/privacy/' : '/privacidad/';
  var pathPrefix = document.documentElement.dataset.pathPrefix || '';
  privacyHref = pathPrefix.replace(/\/$/, '') + privacyHref;

  var banner = document.createElement('div');
  banner.id = 'consent-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', isEN ? 'Cookie consent' : 'Consentimiento de cookies');
  banner.innerHTML = ''
    + '<div class="consent-banner__inner">'
    + '<p class="consent-banner__text">'
    + T.text
    + '<a href="' + privacyHref + '" class="consent-banner__link">' + T.link + '</a>'
    + '</p>'
    + '<div class="consent-banner__actions">'
    + '<button type="button" class="consent-banner__btn consent-banner__btn--reject" data-consent="denied">' + T.reject + '</button>'
    + '<button type="button" class="consent-banner__btn consent-banner__btn--accept" data-consent="granted">' + T.accept + '</button>'
    + '</div>'
    + '</div>';

  function decide(value) {
    localStorage.setItem('gaConsent', value);
    window.dispatchEvent(new CustomEvent('anylopez-consent-update', {
      detail: { granted: value === 'granted' }
    }));
    banner.classList.add('consent-banner--hidden');
    setTimeout(function () { banner.remove(); }, 300);
  }

  banner.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-consent]');
    if (!btn) return;
    decide(btn.getAttribute('data-consent'));
  });

  document.body.appendChild(banner);
})();
