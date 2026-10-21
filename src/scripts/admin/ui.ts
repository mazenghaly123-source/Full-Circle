// Small pieces every admin screen uses: escaping, dates in Cairo time, the stage marks, the toast
// and the dialog. Screens are drawn as HTML strings, as the site's own scripts draw theirs.
import { STAGES } from '../../data/site';
import { SignedOut } from '../core/auth';
import type { OrderRow } from './api';

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const pad = (n: number) => String(n).padStart(2, '0');
/** "05 Sampling" */
export const stageName = (n: number) => `${pad(n)} ${STAGES[Math.min(Math.max(n, 1), 8) - 1].n}`;

const cairo = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', ...o });
/** "15 Oct" */
export const day = (iso: string) => cairo({ day: 'numeric', month: 'short' }).format(new Date(iso));
/** "15 Oct, 14:20" */
export const when = (iso: string) => cairo({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
/** "3 h", "2 d": how long ago */
export function age(iso: string) {
  const m = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${Math.round(m)} min` : m < 60 * 24 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
}

/** The eight stage dots, the current one red when the order waits on us. */
export const ring8 = (stage: number, us = false) =>
  `<span class="ring8" role="img" aria-label="Stage ${stageName(stage)}">${[1, 2, 3, 4, 5, 6, 7, 8].map((k) => `<i class="${k < stage ? 'd' : k === stage ? `c${us ? ' us' : ''}` : ''}"></i>`).join('')}</span>`;

/**
 * Whose move an order is: the client's while a decision waits on them; ours when they answered (an
 * approval or a change request) at this stage and the order has not moved since, or asked for a photo
 * that has not come; nobody's otherwise.
 */
export function waitingOn(o: Pick<OrderRow, 'stage' | 'status' | 'order_decisions' | 'photo_requests' | 'order_events'>): 'us' | 'client' | null {
  if (o.status === 'delivered' || o.status === 'cancelled') return null;
  if (o.order_decisions.some((d) => d.status === 'open')) return 'client';
  if (o.photo_requests.some((r) => !r.answered_at)) return 'us';
  const answered = o.order_events.filter((e) => e.kind === 'approved' || e.kind === 'changes_asked').sort((a, b) => b.id - a.id)[0];
  if (answered && !o.order_events.some((e) => e.kind === 'stage_moved' && e.id > answered.id)) return 'us';
  return null;
}
export const waitPill = (w: 'us' | 'client' | null) =>
  w === 'us' ? '<span class="pillS us"><span class="mk mk-us" aria-hidden="true"></span>Waiting on us</span>'
  : w === 'client' ? '<span class="pillS cl"><span class="mk mk-client" aria-hidden="true"></span>Waiting on client</span>'
  : '<span class="pillS">On track</span>';

export const ICON = {
  search: '<svg class="ic ic-s" viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4"/></svg>',
  plus: '<svg class="ic ic-s" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>',
  close: '<svg class="ic ic-s" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg>',
  check: '<svg class="ic ic-s" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10 3.5 3.5L15 7"/></svg>',
  inbox: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 11h4l1.5 2h3L13 11h4"/><path d="M4.5 5h11L17 11v4H3v-4z"/></svg>',
  orders: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M10 3.5V10l4 2"/></svg>',
  clients: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="7.5" r="2.8"/><path d="M3 16c.6-2.8 2.6-4.3 5-4.3s4.4 1.5 5 4.3"/><path d="M13 5.2a2.6 2.6 0 0 1 0 4.8M14.5 11.9c1.4.6 2.3 2 2.5 4.1"/></svg>',
  team: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="4.5" width="13" height="11" rx="2"/><path d="M7 8.5h6M7 11.5h4"/></svg>',
};

/** Says why an action failed; a session that ended goes back to the sign-in. */
export function failed(err: unknown) {
  if (err instanceof SignedOut) { dispatchEvent(new Event('fc-signed-out')); return; }
  toast(err instanceof Error && err.message ? err.message : 'Could not save. Try again');
}

let toastT = 0;
export function toast(text: string) {
  const t = document.getElementById('toast')!;
  t.textContent = text; t.classList.add('show');
  clearTimeout(toastT); toastT = window.setTimeout(() => t.classList.remove('show'), 2600);
}

/**
 * Opens a dialog (title, body HTML, footer HTML) over a dimmed screen. Escape or the scrim closes it,
 * and focus returns to where it was. Returns the dialog element and a function that closes it.
 */
export function dialog(title: string, body: string, foot: string, labelId = 'dlg-t') {
  const host = document.getElementById('dlg')!, back = document.activeElement as HTMLElement | null;
  host.innerHTML = `<div class="dlgw"><div class="scrim" data-close></div><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="${labelId}">
<div class="dlg-h"><h2 id="${labelId}" class="sc ct">${esc(title)}</h2><button type="button" class="more" data-close aria-label="Close">${ICON.close}</button></div>
<div class="dlg-b">${body}</div><div class="dlg-f">${foot}</div></div></div>`;
  const el = host.querySelector<HTMLElement>('.dlg')!;
  const ac = new AbortController();
  const close = () => { ac.abort(); host.innerHTML = ''; back?.focus(); };
  host.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-close]')) close(); }, { signal: ac.signal });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { signal: ac.signal });
  (el.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])') ?? el).focus();
  return { el, close };
}

/** Reads a form's named fields as trimmed strings. */
export const fields = (form: HTMLElement) => Object.fromEntries([...form.querySelectorAll<HTMLInputElement>('input[name],select[name],textarea[name]')]
  .map((i) => [i.name, i.type === 'checkbox' ? (i.checked ? 'on' : '') : i.value.trim()])) as Record<string, string>;

/** A labelled field in the design's style. */
export const field = (label: string, name: string, value = '', o: { type?: string; ph?: string; area?: boolean; req?: boolean; hint?: string; attrs?: string } = {}) =>
  `<div class="fl"><label for="f-${name}">${esc(label)}</label>${o.area
    ? `<div class="inp area"><textarea id="f-${name}" name="${name}" placeholder="${esc(o.ph ?? '')}"${o.attrs ?? ''}>${esc(value)}</textarea></div>`
    : `<div class="inp"><input id="f-${name}" name="${name}" type="${o.type ?? 'text'}" value="${esc(value)}" placeholder="${esc(o.ph ?? '')}"${o.req ? ' required' : ''}${o.attrs ?? ''}></div>`}${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ''}</div>`;

export const select = (label: string, name: string, options: [string, string][], value: string) =>
  `<div class="fl"><label for="f-${name}">${esc(label)}</label><div class="inp"><select id="f-${name}" name="${name}">${options.map(([v, t]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div></div>`;
