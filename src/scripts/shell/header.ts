// Header: hides on scroll down, full-screen menu on phones.
import type { Feature } from '../core/lifecycle';
import { $, rm } from '../core/util';
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

// A link to the page you are on, as the prototype's hash router behaved for the same URL: from an
// anchor (/what-we-make#cat-denim) or on Home (where the prototype's address had no hash) it goes
// back to the top; on an inner page it does nothing. The menu closes either way; no wipe.
document.addEventListener('click', (e) => {
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || a.target || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const to = new URL(a.href, location.href);
  if (to.origin !== location.origin || to.pathname !== location.pathname || to.hash) return;
  e.preventDefault(); setMenu(false);
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  else if (location.pathname !== '/') return;
  scrollTo({ top: 0, behavior: rm ? 'auto' : 'smooth' });
}, true);

export const headerFeature: Feature = {
  mount(signal) {
    hdr = $('hdr'); burger = $('burger');
    burger.addEventListener('click', () => setMenu(!hdr!.classList.contains('open')), { signal });
    document.querySelectorAll('.mmenu a[target]').forEach((a) => a.addEventListener('click', () => setMenu(false), { signal }));
  },
};
