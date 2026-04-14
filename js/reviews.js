/**
 * ReviewsRotator
 * Single Responsibility: rotate review cards with fade transition.
 * Configuration is injected via options — no hardcoded magic numbers.
 */
class ReviewsRotator {
  constructor(containerSelector, options = {}) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) return;

    this.delay     = options.delay     ?? 4500;
    this.fadeDuration = options.fadeDuration ?? 500;

    this.cards   = Array.from(this.container.querySelectorAll('[data-review]'));
    this.dots    = Array.from(this.container.querySelectorAll('[data-dot]'));
    this.current = 0;
    this.timer   = null;

    this._bindControls();
    this._start();
  }

  _show(index) {
    const prev = this.current;
    this.current = (index + this.cards.length) % this.cards.length;

    this.cards[prev].classList.remove('is-active');
    this.cards[prev].classList.add('is-leaving');
    this.dots[prev]?.classList.remove('active');

    setTimeout(() => this.cards[prev].classList.remove('is-leaving'), this.fadeDuration);

    this.cards[this.current].classList.add('is-active');
    this.dots[this.current]?.classList.add('active');
  }

  _next()  { this._show(this.current + 1); }
  _prev()  { this._show(this.current - 1); }

  _start() {
    this.timer = setInterval(() => this._next(), this.delay);
  }

  _reset() {
    clearInterval(this.timer);
    this._start();
  }

  _bindControls() {
    this.container.querySelector('[data-prev]')
      ?.addEventListener('click', () => { this._prev(); this._reset(); });

    this.container.querySelector('[data-next]')
      ?.addEventListener('click', () => { this._next(); this._reset(); });

    this.dots.forEach((dot, i) =>
      dot.addEventListener('click', () => { this._show(i); this._reset(); })
    );

    /* Pause on hover / touch */
    this.container.addEventListener('mouseenter', () => clearInterval(this.timer));
    this.container.addEventListener('mouseleave', () => this._start());
    this.container.addEventListener('touchstart', () => clearInterval(this.timer), { passive: true });
    this.container.addEventListener('touchend',   () => this._reset(),              { passive: true });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ReviewsRotator('#reviewsSection', { delay: 4500 });
});
