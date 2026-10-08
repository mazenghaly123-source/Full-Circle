// Reveal on scroll and count-up numbers. Each element plays once per session, as in the prototype
// (where a page you came back to was still the same document).
import type { Feature } from '../core/lifecycle';
import { pad, rm } from '../core/util';

const REVEAL = '.sh,.facts>div,.who-card,.cat,.step,.howring,.vs,.portal,.proof>.ph,.q,.summary,.faq details,.contact>div,.logos,.srow2,.catpanel,.techs>div,.enter>div,.chain>div,.team>div,.rules>div,.next3>div,.ord';
const revealed = new Set<string>(), counted = new Set<string>();
const keyOf = new WeakMap<Element, string>();

export const revealFeature: Feature = {
  mount(signal) {
    if (!('IntersectionObserver' in window)) return;
    const path = location.pathname;
    if (!rm) {
      const io = new IntersectionObserver((es) => es.forEach((en) => {
        if (!en.isIntersecting) return;
        revealed.add(keyOf.get(en.target)!);
        if (en.boundingClientRect.top > 0) en.target.classList.add('rv', 'in');
        io.unobserve(en.target);
      }), { threshold: 0.12 });
      document.querySelectorAll(REVEAL).forEach((el, i) => {
        const k = path + '|' + i; if (revealed.has(k)) return;
        keyOf.set(el, k); io.observe(el);
      });
      signal.addEventListener('abort', () => io.disconnect(), { once: true });
    }
    const cio = new IntersectionObserver((es) => es.forEach((en) => {
      if (!en.isIntersecting) return;
      cio.unobserve(en.target); counted.add(keyOf.get(en.target)!);
      const el = en.target as HTMLElement, to = +el.dataset.count!; if (rm) return;
      const t0 = performance.now();
      const tick = (now: number) => { const q = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - q, 3); el.textContent = pad(Math.round(to * e)); if (q < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }), { threshold: 0.6 });
    document.querySelectorAll('[data-count]').forEach((el, i) => {
      const k = path + '|c' + i; if (counted.has(k)) return;
      keyOf.set(el, k); cio.observe(el);
    });
    signal.addEventListener('abort', () => cio.disconnect(), { once: true });
  },
};
