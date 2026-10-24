// Home "What we make": on a pointer the photo you are on grows and the others step back; on phones the
// row is swiped and the card in the middle is the full size one (the cards beside it shrink and dim).
import type { Feature } from '../core/lifecycle';

export const makeRowFeature: Feature = {
  mount(signal) {
    const row = document.getElementById('makeGrid');
    if (!row) return;
    const items = [...row.children] as HTMLElement[];
    const wide = matchMedia('(min-width: 761px)');

    const open = (i: number | null) => { row.classList.toggle('has', i !== null); items.forEach((el, k) => el.classList.toggle('on', k === i)); };
    items.forEach((el, i) => {
      el.addEventListener('pointerenter', (e) => { if (wide.matches && e.pointerType === 'mouse') open(i); }, { signal });
      el.addEventListener('focus', () => { if (wide.matches) open(i); }, { signal });
    });
    // leaving the row goes back to the card with keyboard focus, if there is one
    row.addEventListener('pointerleave', (e) => {
      if (!wide.matches || e.pointerType !== 'mouse') return;
      const focused = items.findIndex((el) => el.contains(document.activeElement));
      open(focused < 0 ? null : focused);
    }, { signal });
    row.addEventListener('focusout', (e) => { if (wide.matches && !row.contains(e.relatedTarget as Node | null)) open(null); }, { signal });

    // phones: each card's size follows how close it is to the middle of the row
    let raf = 0;
    const swipe = () => {
      raf = 0;
      if (wide.matches) { items.forEach((el) => { el.style.removeProperty('--s'); el.style.removeProperty('--k'); }); return; }
      const box = row.getBoundingClientRect(), mid = box.left + box.width / 2;
      let best = 0, bestD = Infinity;
      items.forEach((el, i) => {
        const r = el.getBoundingClientRect(), d = Math.min(1, Math.abs(r.left + r.width / 2 - mid) / el.offsetWidth);
        el.style.setProperty('--s', (1 - d * 0.14).toFixed(3));
        el.style.setProperty('--k', (1 - d).toFixed(3));
        if (d < bestD) { bestD = d; best = i; }
      });
      items.forEach((el, i) => el.classList.toggle('on', i === best));
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(swipe); };
    row.addEventListener('scroll', queue, { passive: true, signal });
    const change = () => { if (wide.matches) open(null); queue(); };
    wide.addEventListener('change', change, { signal });
    addEventListener('resize', queue, { signal });
    signal.addEventListener('abort', () => cancelAnimationFrame(raf), { once: true });
    swipe();
  },
};
