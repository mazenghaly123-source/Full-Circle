// Reveal on scroll and count-up numbers. As in the prototype (one document whose pages were hidden
// and shown again): an element reveals and counts once per session, and a page you come back to
// replays the reveal of what had already risen (CSS animations restart when a page reappears),
// while numbers stay at their final value.
import type { Feature } from '../core/lifecycle';
import { pad, rm } from '../core/util';

const REVEAL = '.sh,.facts>div,.who-card,.cat,.step,.howring,.vs,.portal,.proof>.ph,.q,.summary,.faq details,.contact>div,.logos,.srow2,.catpanel,.techs>div,.enter>div,.chain>div,.team>div,.rules>div,.next3>div';
/** Seen by the observer (done either way), and of those, the ones that played the rise. */
const revealed = new Set<string>(), risen = new Set<string>(), counted = new Set<string>();
const keyOf = new WeakMap<Element, string>();
const pageOf = (doc: Document) => doc.body.dataset.page;

export const revealFeature: Feature = {
  prepare(doc) {
    if (rm) return;
    const pg = pageOf(doc);
    doc.querySelectorAll(REVEAL).forEach((el, i) => { if (risen.has(`${pg}|${i}`)) el.classList.add('rv', 'in'); });
  },
  mount(signal) {
    if (!('IntersectionObserver' in window)) return;
    const pg = pageOf(document);
    if (!rm) {
      const io = new IntersectionObserver((es) => es.forEach((en) => {
        if (!en.isIntersecting) return;
        const k = keyOf.get(en.target)!;
        revealed.add(k);
        if (en.boundingClientRect.top > 0) { en.target.classList.add('rv', 'in'); risen.add(k); }
        io.unobserve(en.target);
      }), { threshold: 0.12 });
      document.querySelectorAll(REVEAL).forEach((el, i) => {
        const k = `${pg}|${i}`; if (revealed.has(k)) return;
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
      const k = `${pg}|c${i}`; if (counted.has(k)) return;
      keyOf.set(el, k); cio.observe(el);
    });
    signal.addEventListener('abort', () => cio.disconnect(), { once: true });
  },
};
