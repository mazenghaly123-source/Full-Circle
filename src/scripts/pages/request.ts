// Request a sample: four picks, a live summary, contact details and optional files. Other pages
// send picks along in the URL (/request-a-sample?path=Scaling&product=Denim).
//
// Phase 1 keeps the prototype's behaviour: the request is checked and a code is shown, but nothing
// is sent yet. Phase 2 sends it to the server, which issues the code and notifies the team.
import type { Feature } from '../core/lifecycle';
import { $, demoCode, toast, vib } from '../core/util';
import { picked, request } from '../core/state';
import { arrival } from '../core/nav';
import { REQUEST_QUESTIONS, type RequestKey } from '../../data/site';
import { updGo } from '../shell/mbar';

const FILE_HINT = 'Add a sketch, tech pack or photo (optional)';

/** A pick from the URL counts only if it is one of that question's own options. */
const isOption = (k: RequestKey, v: string) => (REQUEST_QUESTIONS.find((q) => q.k === k)!.options as readonly string[]).includes(v);

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
  doc.getElementById('qtyWarn')!.classList.toggle('show', request.sel.qty === 'Under 60' || (request.sel.qty === '60–150' && request.sel.product === 'Denim'));
}

function restore(doc: Document) {
  if (!doc.getElementById('qs')) return;
  doc.querySelectorAll<HTMLElement>('.q').forEach((q) => q.querySelectorAll('.opt').forEach((o) => o.setAttribute('aria-pressed', String(o.textContent === request.sel[q.dataset.k as RequestKey]))));
  (doc.getElementById('fBrand') as HTMLInputElement).value = request.brand;
  (doc.getElementById('fContact') as HTMLInputElement).value = request.contact;
  (doc.getElementById('fNote') as HTMLTextAreaElement).value = request.note;
  doc.getElementById('fFileT')!.textContent = request.files.length ? request.files.map((f) => f.name).join(', ') : FILE_HINT;
  doc.getElementById('err')!.textContent = request.err;
  if (request.sent) { doc.getElementById('sentCode')!.textContent = request.code; doc.getElementById('reqCode')!.textContent = request.code; doc.getElementById('summary')!.classList.add('is-sent'); }
  renderSummary(doc);
}

function choose(k: RequestKey, v: string) {
  request.sel[k] = v;
  document.querySelectorAll(`.q[data-k="${k}"] .opt`).forEach((o) => o.setAttribute('aria-pressed', String(o.textContent === v)));
  renderSummary(document); updGo();
}

export const requestFeature: Feature = {
  prepare: restore,
  mount(signal) {
    if (!document.getElementById('qs')) return;
    // picks carried over from another page (not on back/forward, which would undo a later pick)
    if (arrival !== 'traverse') {
      const params = new URLSearchParams(location.search);
      for (const k of ['path', 'product'] as const) { const v = params.get(k); if (v && isOption(k, v)) request.sel[k] = v; }
    }
    restore(document);
    // files chosen before leaving the page are put back in the picker
    if (request.files.length) { try { const dt = new DataTransfer(); request.files.forEach((f) => dt.items.add(f)); $<HTMLInputElement>('fFile').files = dt.files; } catch { /* old browser: the names stay in the label */ } }
    document.querySelectorAll<HTMLElement>('.q').forEach((q) => q.addEventListener('click', (e) => { const o = (e.target as Element).closest('.opt'); if (o) { vib(); choose(q.dataset.k as RequestKey, o.textContent!); } }, { signal }));
    $('fBrand').addEventListener('input', (e) => { request.brand = (e.target as HTMLInputElement).value; }, { signal });
    $('fContact').addEventListener('input', (e) => { request.contact = (e.target as HTMLInputElement).value; }, { signal });
    $('fNote').addEventListener('input', (e) => { request.note = (e.target as HTMLTextAreaElement).value; }, { signal });
    $('fFile').addEventListener('change', (e) => { request.files = [...((e.target as HTMLInputElement).files ?? [])]; $('fFileT').textContent = request.files.length ? request.files.map((x) => x.name).join(', ') : FILE_HINT; }, { signal });
    const fail = (msg: string, field?: string) => { request.err = msg; $('err').textContent = msg; if (field) $(field).focus(); };
    $('send').addEventListener('click', () => {
      vib();
      if (!request.sel.path || !request.sel.product) return fail('Pick the brand stage and a product');
      if (!$<HTMLInputElement>('fBrand').value.trim()) return fail('Add the brand name', 'fBrand');
      if ($<HTMLInputElement>('fContact').value.trim().length < 6) return fail('Add an email or WhatsApp number', 'fContact');
      // TODO(phase 2): send to the submit-request function, which issues the code and notifies the team
      const code = demoCode();
      request.sent = true; request.code = code; request.err = '';
      // the phone bar reads "Request sent" and slides away on the next scroll, as in the prototype
      $('err').textContent = ''; $('sentCode').textContent = code; $('reqCode').textContent = code; $('summary').classList.add('is-sent'); toast(code + ' / request received'); updGo();
    }, { signal });
  },
};
