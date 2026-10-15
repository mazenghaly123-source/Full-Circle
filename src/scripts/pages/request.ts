// Request a sample: four picks, a live summary and contact details. Other pages send picks along in
// the URL (/request-a-sample?path=Scaling&product=Denim).
//
// Sending posts the request to the submit-request Edge Function, which saves it, issues its code
// (FC-####) and tells the team. The form checks the same rules first (supabase/functions/_shared/forms.ts).
// Once sent, a button opens WhatsApp with the code, as the conversation carries on there.
import type { Feature } from '../core/lifecycle';
import { $, byId, focusHeading, markInvalid, rm, toast, vib } from '../core/util';
import { picked, request } from '../core/state';
import { arrival } from '../core/nav';
import { source } from '../core/source';
import { isProblem, submit } from '../core/send';
import { REQUEST_QUESTIONS, belowMinimum, whatsappLink, type RequestKey } from '../../data/site';
import { ERRORS, NOTICE, isOption, readContact, type RequestData } from '../../../supabase/functions/_shared/forms';
import { updGo } from '../shell/mbar';

const SEND = 'Request a sample', SENDING = 'Sending…';
/** What an error line can be about: the two required option groups and the two required fields. */
const CHECKED = ['opts-path', 'opts-product', 'fBrand', 'fContact'] as const;
/** The field an answer from the server is about. */
const FIELD: Record<string, string[]> = { brand: ['fBrand'], contact: ['fContact'] };

/** The contact reads as a WhatsApp number: say so, and offer order updates there. */
const onWhatsApp = () => readContact(request.contact)?.channel === 'whatsapp';

/**
 * The summary once the request is sent: its code, the sent look, and WhatsApp ready with the code.
 * The form goes away (the prototype's .is-sent rule meant to hide it, but the box's inline display
 * won) and the picks can no longer change, so a request is never sent twice.
 */
function showSent(doc: Document) {
  const g = byId(doc);
  g('sentCode').textContent = request.code; g('reqCode').textContent = request.code; g('summary').classList.add('is-sent');
  (g('sentWa') as HTMLAnchorElement).href = whatsappLink(`Hi Full Circle, I just sent sample request ${request.code} (${request.brand.trim()}).`);
  g('summary').querySelector<HTMLElement>('.form-box')!.hidden = true;
  g('qs').inert = true;
}

function renderSummary(doc: Document) {
  const rows = REQUEST_QUESTIONS.map((q) => {
    const v = request.sel[q.k], row = doc.createElement('div'), label = doc.createElement('span'), value = doc.createElement('span');
    row.className = 'srow'; label.className = 'dim'; label.textContent = q.summary;
    value.className = v ? '' : 'empty'; value.textContent = v || '—';
    row.append(label, value);
    return row;
  });
  doc.getElementById('srows')!.replaceChildren(...rows);
  const n = picked();
  [...doc.getElementById('meter')!.children].forEach((m, i) => m.classList.toggle('on', i < n));
  doc.getElementById('qtyWarn')!.classList.toggle('show', belowMinimum(request.sel.qty, request.sel.product));
}

/** The send button while the request is on its way. */
function showSending(doc: Document) {
  const b = doc.getElementById('send')!;
  b.textContent = request.sending ? SENDING : SEND; b.setAttribute('aria-disabled', String(request.sending));
}

function restore(doc: Document) {
  if (!doc.getElementById('qs')) return;
  doc.querySelectorAll<HTMLElement>('.q').forEach((q) => q.querySelectorAll('.opt').forEach((o) => o.setAttribute('aria-pressed', String(o.textContent === request.sel[q.dataset.k as RequestKey]))));
  (doc.getElementById('fBrand') as HTMLInputElement).value = request.brand;
  (doc.getElementById('fContact') as HTMLInputElement).value = request.contact;
  (doc.getElementById('fNote') as HTMLTextAreaElement).value = request.note;
  (doc.getElementById('fWaUpdates') as HTMLInputElement).checked = request.waUpdates;
  doc.getElementById('waOpt')!.hidden = !onWhatsApp();
  doc.getElementById('err')!.textContent = request.err; markInvalid(doc, CHECKED, request.bad, 'err');
  showSending(doc);
  if (request.sent) showSent(doc);
  renderSummary(doc);
}

function choose(k: RequestKey, v: string) {
  request.sel[k] = v;
  document.querySelectorAll(`.q[data-k="${k}"] .opt`).forEach((o) => o.setAttribute('aria-pressed', String(o.textContent === v)));
  renderSummary(document); updGo();
}

/** The request as the server takes it. */
const payload = (turnstile: string): string => JSON.stringify({
  path: request.sel.path!, product: request.sel.product!, qty: request.sel.qty, have: request.sel.have,
  brand: request.brand, contact: request.contact, note: request.note,
  whatsappUpdates: onWhatsApp() ? request.waUpdates : undefined,
  notice: NOTICE.version, source, turnstile,
} satisfies RequestData);

export const requestFeature: Feature = {
  prepare: restore,
  mount(signal) {
    if (!document.getElementById('qs')) return;
    // picks carried over from another page (not on back/forward, which would undo a later pick)
    if (arrival !== 'traverse' && !request.sent) {
      const params = new URLSearchParams(location.search);
      for (const k of ['path', 'product'] as const) { const v = params.get(k); if (v && isOption(k, v)) request.sel[k] = v; }
    }
    restore(document);
    document.querySelectorAll<HTMLElement>('.q').forEach((q) => q.addEventListener('click', (e) => { const o = (e.target as Element).closest('.opt'); if (o) { vib(); choose(q.dataset.k as RequestKey, o.textContent!); } }, { signal }));
    $('fBrand').addEventListener('input', (e) => { request.brand = (e.target as HTMLInputElement).value; }, { signal });
    $('fContact').addEventListener('input', (e) => { request.contact = (e.target as HTMLInputElement).value; $('waOpt').hidden = !onWhatsApp(); }, { signal });
    $('fWaUpdates').addEventListener('change', (e) => { request.waUpdates = (e.target as HTMLInputElement).checked; }, { signal });
    $('fNote').addEventListener('input', (e) => { request.note = (e.target as HTMLTextAreaElement).value; }, { signal });
    // the error line is tied to the fields it is about, and focus goes to the first of them (a
    // missing pick: its first option, with the question scrolled to the middle of the screen)
    const fail = (msg: string, bad: string[]) => {
      request.err = msg; request.bad = bad; $('err').textContent = msg; markInvalid(document, CHECKED, bad, 'err');
      if (!bad.length) return;
      const first = $(bad[0]);
      if (!first.matches('.opts')) { first.focus(); return; }
      first.querySelector('button')!.focus({ preventScroll: true }); first.closest('.q')!.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'center' });
    };
    const missingPicks = () => (['path', 'product'] as const).filter((k) => !request.sel[k]).map((k) => `opts-${k}`);
    $('send').addEventListener('click', async () => {
      if (request.sending || request.sent) return;
      vib();
      if (!request.sel.path || !request.sel.product) return fail(ERRORS.picks, missingPicks());
      if (!request.brand.trim()) return fail(ERRORS.brand, ['fBrand']);
      if (!readContact(request.contact)) return fail(ERRORS.contact, ['fContact']);
      request.sending = true; request.err = ''; request.bad = []; $('err').textContent = ''; markInvalid(document, CHECKED, [], 'err'); showSending(document);
      const out = await submit<{ code: string }>('submit-request', $('rTs'), payload);
      request.sending = false;
      // the visitor may have gone to another page meanwhile: the state is kept, and shown when they come back
      const here = !!document.getElementById('qs');
      if (here) showSending(document);
      if (isProblem(out)) {
        const bad = out.field === 'picks' ? missingPicks() : FIELD[out.field ?? ''] ?? [];
        if (here) fail(out.error, bad); else { request.err = out.error; request.bad = bad; }
        return;
      }
      request.sent = true; request.code = out.code;
      toast(out.code + ' / request received'); updGo();
      if (!here) return;
      // the phone bar reads "Request sent" and slides away on the next scroll, as in the prototype
      showSent(document);
      focusHeading($('sentH'));
    }, { signal });
  },
};
