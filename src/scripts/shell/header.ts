// Header: hides on scroll down, full-screen menu on phones.
import type { Feature } from '../core/lifecycle';
import { $ } from '../core/util';
import { updBar } from './mbar';

let hdr: HTMLElement | null = null, burger: HTMLElement | null = null;

export function setMenu(o: boolean) {
  if (!hdr || !burger) return;
  hdr.classList.toggle('open', o); hdr.classList.remove('up');
  burger.setAttribute('aria-expanded', String(o)); burger.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
  document.body.style.overflow = o ? 'hidden' : '';
  updBar();
}

addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  if (hdr && !hdr.classList.contains('open')) {
    if (y > lastY + 6 && y > 140) hdr.classList.add('up'); else if (y < lastY - 6 || y < 140) hdr.classList.remove('up');
  }
  lastY = y; updBar();
}, { passive: true });

// A link to the page you are on does nothing but close the menu, as in the prototype (where it
// changed nothing in the address bar).
document.addEventListener('click', (e) => {
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || a.target || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const to = new URL(a.href, location.href);
  if (to.origin !== location.origin || to.pathname !== location.pathname || to.hash) return;
  e.preventDefault(); setMenu(false);
}, true);

export const headerFeature: Feature = {
  mount(signal) {
    hdr = $('hdr'); burger = $('burger');
    burger.addEventListener('click', () => setMenu(!hdr!.classList.contains('open')), { signal });
    document.querySelectorAll('.mmenu a[target]').forEach((a) => a.addEventListener('click', () => setMenu(false), { signal }));
  },
};
