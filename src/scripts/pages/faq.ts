// Home FAQ: questions left open are still open when Home comes back.
import type { Feature } from '../core/lifecycle';

const open = new Set<number>();

export const faqFeature: Feature = {
  prepare(doc) {
    doc.querySelectorAll<HTMLDetailsElement>('#faqList details').forEach((d, i) => { d.open = open.has(i); });
  },
  mount(signal) {
    document.querySelectorAll<HTMLDetailsElement>('#faqList details').forEach((d, i) => {
      d.addEventListener('toggle', () => { if (d.open) open.add(i); else open.delete(i); }, { signal });
    });
  },
};
