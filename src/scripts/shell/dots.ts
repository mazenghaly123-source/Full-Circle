// Snap carousels on phones: dots follow the scroll position.
import type { Feature } from '../core/lifecycle';
import { $ } from '../core/util';

export const dotsFeature: Feature = {
  mount(signal) {
    document.querySelectorAll<HTMLElement>('.dots').forEach((d) => {
      const row = $(d.dataset.for!); const n = row.children.length;
      if (!d.children.length) d.innerHTML = '<i></i>'.repeat(n);
      const upd = () => {
        const c = row.children[0].getBoundingClientRect().width + 10; if (!c) return;
        const i = Math.min(n - 1, Math.round(row.scrollLeft / c));
        [...d.children].forEach((x, k) => x.classList.toggle('on', k === i));
      };
      row.addEventListener('scroll', upd, { passive: true, signal });
      upd();
    });
  },
};
