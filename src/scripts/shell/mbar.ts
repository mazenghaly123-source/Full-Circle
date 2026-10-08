// Phone bar: Request a sample + WhatsApp. On the request page the main button walks you through it.
import { navigate } from 'astro:transitions/client';
import type { Feature } from '../core/lifecycle';
import { $, page, rm, vib } from '../core/util';
import { picked, request, yo } from '../core/state';
import { ROUTES } from '../../data/site';

const mbar = $('mbar'), goBtn = $<HTMLButtonElement>('mbarGo');

export function updGo() {
  const n = picked();
  if (page() === 'start') goBtn.textContent = request.sent ? 'Request sent' : n < 4 ? `Continue / ${n} of 4 picked` : 'Add your details';
  else goBtn.textContent = 'Request a sample';
}

export function updBar() {
  const p = page(), hdr = document.getElementById('hdr'), hero = document.querySelector('.hero');
  const past = p !== 'home' || innerWidth <= 760 || !hero || hero.getBoundingClientRect().bottom < 80;
  mbar.classList.toggle('show', past && !hdr?.classList.contains('open') && !(p === 'start' && request.sent) && !(p === 'how' && yo.visible));
}

goBtn.addEventListener('click', () => {
  vib();
  if (page() !== 'start') { navigate(ROUTES.start); return; }
  const missing = [...document.querySelectorAll<HTMLElement>('.q')].find((q) => !request.sel[q.dataset.k as keyof typeof request.sel]);
  if (missing) missing.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'center' });
  else { $('summary').scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'center' }); setTimeout(() => $('fBrand')?.focus({ preventScroll: true }), 450); }
});

export const mbarFeature: Feature = {
  mount() { updGo(); updBar(); },
};
