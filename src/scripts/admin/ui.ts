// Small pieces every admin screen uses: escaping, dates in Cairo time, the stage marks, the toast
// and the dialog. Screens are drawn as HTML strings, as the site's own scripts draw theirs.
import { STAGES } from '../../data/site';
import { SignedOut } from '../core/auth';
import type { LogEntry } from '../core/portal';
import type { BoardOrder, Decision, OrderRow } from './api';

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
 * Whose move an order is: ours when the client asked for a photo that has not come, or answered (an
 * approval or a change request) and the order has not moved since; the client's while a decision
 * waits on them; nobody's otherwise.
 */
export function waitingOn(o: Pick<OrderRow, 'stage' | 'status' | 'order_decisions' | 'photo_requests' | 'order_events'>): 'us' | 'client' | null {
  if (o.status === 'delivered' || o.status === 'cancelled') return null;
  if (o.photo_requests.some((r) => !r.answered_at)) return 'us';
  if (o.order_decisions.some((d) => d.status === 'open')) return 'client';
  const answered = o.order_events.filter((e) => e.kind === 'approved' || e.kind === 'changes_asked').sort((a, b) => b.id - a.id)[0];
  if (answered && !o.order_events.some((e) => e.kind === 'stage_moved' && e.id > answered.id)) return 'us';
  return null;
}

/** One thing an order waits on us for: an approval to move on, changes to make, or a photo to add. */
export type Need = { o: BoardOrder; kind: 'approved' | 'changes' | 'photo'; at: string; title: string; who: string; note: string | null; stage: number };

/** What an order waits on us for, the same reading as waitingOn, with what each one is. */
export function needsOf(o: BoardOrder): Need[] {
  if (o.status === 'delivered' || o.status === 'cancelled') return [];
  const out: Need[] = o.photo_requests.filter((r) => !r.answered_at)
    .map((r) => ({ o, kind: 'photo', at: r.created_at, title: `Photo of ${stageName(r.stage)}`, who: r.asked_label, note: r.note, stage: r.stage }));
  if (o.order_decisions.some((d) => d.status === 'open')) return out;
  const events = [...o.order_events].sort((a, b) => b.id - a.id);
  const a = events.find((e) => e.kind === 'approved' || e.kind === 'changes_asked');
  if (a && !events.some((e) => e.kind === 'stage_moved' && e.id > a.id))
    out.push({ o, kind: a.kind === 'approved' ? 'approved' : 'changes', at: a.created_at, title: a.title ?? 'The decision', who: a.actor_label, note: a.note, stage: a.stage ?? o.stage });
  return out;
}

/** The sample gate, as move_stage holds it: the latest sample decision at 05 (withdrawn aside) is approved. */
export const sampleApproved = (ds: Pick<Decision, 'id' | 'stage' | 'status' | 'opened_at'>[]) =>
  ds.filter((d) => d.stage === 5 && d.status !== 'withdrawn').sort((a, b) => b.opened_at.localeCompare(a.opened_at) || b.id - a.id)[0]?.status === 'approved';

/** Today in Cairo, as 2026-10-21 (due dates are plain dates). */
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
/** Past its delivery date and not delivered. */
export const isLate = (o: Pick<OrderRow, 'due_on' | 'status'>) => !!o.due_on && o.due_on < today() && (o.status === 'active' || o.status === 'paused');
/** When the order reached the stage it is at: its last move, or when it was opened. */
export function enteredStage(o: BoardOrder) {
  const e = [...o.order_events].sort((a, b) => b.id - a.id).find((x) => x.kind === 'stage_moved' || x.kind === 'order_opened');
  return e?.created_at ?? o.created_at;
}
/** Whole days since a time. */
export const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));

/** How an order shows on the floor: needs us, late, with the client, or in work. */
export type Flow = 'us' | 'late' | 'client' | 'work';
export const flowOf = (o: BoardOrder): Flow => needsOf(o).length ? 'us' : isLate(o) ? 'late' : waitingOn(o) === 'client' ? 'client' : 'work';
export const FLOW: Record<Flow, { label: string; mark: string }> = {
  us: { label: 'Needs us', mark: 'mk mk-us' }, late: { label: 'Late', mark: 'mk mk-late' },
  work: { label: 'In work', mark: 'mk mk-work' }, client: { label: 'With client', mark: 'mk mk-client' },
};
export const isOpen = (o: Pick<OrderRow, 'status'>) => o.status === 'active' || o.status === 'paused';

/** A line of the approval log, as the order page and the overview show it. */
export function logLine(e: LogEntry) {
  const t = e.title ?? 'Decision';
  switch (e.kind) {
    case 'order_opened': return `Order opened at ${stageName(e.stage ?? 1)}`;
    case 'decision_opened': return `${t} / sent to the client`;
    case 'approved': return `${t} / approved`;
    case 'changes_asked': return `${t} / changes asked${e.note ? `: “${e.note}”` : ''}`;
    case 'decision_withdrawn': return `${t} / withdrawn`;
    case 'photo_asked': return `Photo asked of ${stageName(e.stage ?? 1)}${e.note ? `: “${e.note}”` : ''}`;
    case 'photo_added': return `Photo added at ${stageName(e.stage ?? 1)}${e.note ? `: ${e.note}` : ''}`;
    case 'stage_moved': return `Moved to ${stageName(e.to_stage ?? 1)}${e.note ? ` / ${e.note}` : ''}`;
  }
}

/** "Wednesday 21 October 2026 · Week 43": the line over each screen's title. */
export function dateLine() {
  const long = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  // the ISO week: the week's Thursday decides its year
  const t = Date.parse(`${today()}T00:00:00Z`), thu = new Date(t + (3 - (new Date(t).getUTCDay() + 6) % 7) * 86_400_000);
  const week = Math.floor((thu.getTime() - Date.UTC(thu.getUTCFullYear(), 0, 1)) / 604_800_000) + 1;
  return `${long.replace(',', '')} · Week ${week}`;
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
  overview: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1.5"/><rect x="11" y="3.5" width="5.5" height="5.5" rx="1.5"/><rect x="3.5" y="11" width="5.5" height="5.5" rx="1.5"/><rect x="11" y="11" width="5.5" height="5.5" rx="1.5"/></svg>',
  production: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 16.5V8l4 2.5V8l4 2.5V8l5 3v5.5z"/><path d="M3.5 16.5h13"/></svg>',
  approvals: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m7 10 2 2 4-4"/></svg>',
  analytics: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16V10M8 16V6M12 16v-4M16 16V4"/></svg>',
  more: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><circle cx="5" cy="10" r="1.2"/><circle cx="10" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/></svg>',
  photo: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="5" width="14" height="11" rx="2"/><circle cx="10" cy="10.5" r="2.8"/><path d="M7.5 5 8.5 3.5h3L12.5 5"/></svg>',
  mail: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="5" width="14" height="10" rx="2"/><path d="m3.5 6 6.5 5 6.5-5"/></svg>',
};

/** A link that opens WhatsApp with this text ready to send, or null without an international number. */
export const waLink = (whatsapp: string | null, text: string) =>
  whatsapp && /^\+\d{7,15}$/.test(whatsapp) ? `https://wa.me/${whatsapp.slice(1)}?text=${encodeURIComponent(text)}` : null;

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
