// What we make: the category buttons jump to their panel.
import type { Feature } from '../core/lifecycle';
import { rm } from '../core/util';

export const makeFeature: Feature = {
  mount(signal) {
    document.querySelectorAll<HTMLElement>('[data-cat]').forEach((b) => b.addEventListener('click', () => document.getElementById('cat-' + b.dataset.cat)!.scrollIntoView({ behavior: rm ? 'auto' : 'smooth' }), { signal }));
  },
};
