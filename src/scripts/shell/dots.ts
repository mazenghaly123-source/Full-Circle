// Snap carousels on phones: dots follow the scroll position, and a row you scrolled is where you
// left it when its page comes back (as in the one-document prototype).
import type { Feature } from '../core/lifecycle';
import { $ } from '../core/util';

const scrolled = new Map<string, number>();

export const dotsFeature: Feature = {
  mount(signal) {
    const pg = document.body.dataset.page;
    document.querySelectorAll<HTMLElement>('.dots').forEach((d) => {
      const row = $(d.dataset.for!); const n = row.children.length, key = `${pg}|${row.id}`;
      if (!d.children.length) d.innerHTML = '<i></i>'.repeat(n);
      const upd = () => {
        const c = row.children[0].getBoundingClientRect().width + 10; if (!c) return;
        const i = Math.min(n - 1, Math.round(row.scrollLeft / c));
        [...d.children].forEach((x, k) => x.classList.toggle('on', k === i));
      };
      if (scrolled.has(key)) row.scrollLeft = scrolled.get(key)!;
      row.addEventListener('scroll', () => { scrolled.set(key, row.scrollLeft); upd(); }, { passive: true, signal });
      upd();
    });
  },
};
