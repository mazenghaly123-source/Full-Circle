import type { PageKey } from '../../data/site';

export { pad, ring } from '../../data/site';

export const $ = <T extends HTMLElement = HTMLElement>(id: string, root: Document = document) =>
  root.getElementById(id) as T;
export const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const fine = matchMedia('(pointer: fine)').matches;
export const NS = 'http://www.w3.org/2000/svg';

/** The page being shown (set on <body> by the layout). */
export const page = () => document.body.dataset.page as PageKey;

let toastT = 0;
export const toast = (t: string) => {
  const e = $('toast');
  e.textContent = t;
  e.classList.add('show');
  clearTimeout(toastT);
  toastT = window.setTimeout(() => e.classList.remove('show'), 2200);
};

export const vib = () => {
  try { navigator.vibrate?.(10); } catch { /* not supported */ }
};

export const nowStamp = () => {
  const d = new Date();
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

/** A demo order code, as the prototype makes them (real codes will come from the server). */
export const demoCode = () => 'FC-' + (1000 + Math.floor(Math.random() * 8999));
