import type { PageKey } from '../../data/site';

export { pad, ring } from '../../data/site';

export const $ = <T extends HTMLElement = HTMLElement>(id: string, root: Document = document) =>
  root.getElementById(id) as T;
/** Elements by id in one document (the live page, or one coming in): const g = byId(doc). */
export const byId = (doc: Document) => <T extends HTMLElement = HTMLElement>(id: string) => doc.getElementById(id) as T;
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

/**
 * Ties an error line to the fields it is about: those in `bad` are marked invalid and described by
 * the line (an option group only gets the description), the others are cleared.
 */
export function markInvalid(doc: Document, ids: readonly string[], bad: readonly string[], errId: string) {
  for (const id of ids) {
    const el = doc.getElementById(id); if (!el) continue;
    const on = bad.includes(id), field = el.matches('input, textarea');
    if (on) el.setAttribute('aria-describedby', errId); else el.removeAttribute('aria-describedby');
    if (field && on) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  }
}

/** Moves focus to a heading that replaced the controls you were using (without scrolling). */
export const focusHeading = (el: HTMLElement) => { el.tabIndex = -1; el.focus({ preventScroll: true }); };

/** decodeURIComponent that leaves a malformed string (a stray % in the address) as it is. */
export const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/** A demo order code, as the prototype makes them (real codes will come from the server). */
export const demoCode = () => 'FC-' + (1000 + Math.floor(Math.random() * 8999));
