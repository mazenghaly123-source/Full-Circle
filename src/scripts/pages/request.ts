// Request a sample: four picks, a live summary, contact details and optional files. Other pages
// send picks along in the URL (/request-a-sample?path=Scaling&product=Denim).
//
// Phase 1 keeps the prototype's behaviour: the request is checked and a code is shown, but nothing
// is sent yet. Phase 2 sends it to the server, which issues the code and notifies the team.
import type { Feature } from '../core/lifecycle';
import { $, demoCode, toast, vib } from '../core/util';
import { picked, request } from '../core/state';
import { REQUEST_QUESTIONS, type RequestKey } from '../../data/site';
import { updBar, updGo } from '../shell/mbar';

const FILE_HINT = 'Add a sketch, tech pack or photo (optional)';

function renderSummary(doc: Document) {
  doc.getElementById('srows')!.innerHTML = REQUEST_QUESTIONS.map((q) => { const v = request.sel[q.k]; return `<div class="srow"><span class="dim">${q.summary}</span><span class="${v ? '' : 'empty'}">${v || '—'}</span></div>`; }).join('');
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
    // picks carried over from another page
    const params = new URLSearchParams(location.search);
    for (const k of ['path', 'product'] as const) { const v = params.get(k); if (v) request.sel[k] = v; }
    if (params.has('path') || params.has('product')) history.replaceState(history.state, '', location.pathname + location.hash);
    restore(document);
    document.querySelectorAll<HTMLElement>('.q').forEach((q) => q.addEventListener('click', (e) => { const o = (e.target as Element).closest('.opt'); if (o) { vib(); choose(q.dataset.k as RequestKey, o.textContent!); } }, { signal }));
    $('fBrand').addEventListener('input', (e) => { request.brand = (e.target as HTMLInputElement).value; }, { signal });
    $('fContact').addEventListener('input', (e) => { request.contact = (e.target as HTMLInputElement).value; }, { signal });
    $('fNote').addEventListener('input', (e) => { request.note = (e.target as HTMLTextAreaElement).value; }, { signal });
    $('fFile').addEventListener('change', (e) => { const f = [...((e.target as HTMLInputElement).files ?? [])]; $('fFileT').textContent = f.length ? f.map((x) => x.name).join(', ') : FILE_HINT; }, { signal });
    $('send').addEventListener('click', () => {
      vib();
      const err = $('err');
      if (!request.sel.path || !request.sel.product) { err.textContent = 'Pick the brand stage and a product'; return; }
      if (!$<HTMLInputElement>('fBrand').value.trim()) { err.textContent = 'Add the brand name'; $('fBrand').focus(); return; }
      if ($<HTMLInputElement>('fContact').value.trim().length < 6) { err.textContent = 'Add an email or WhatsApp number'; $('fContact').focus(); return; }
      // TODO(phase 2): send to the submit-request function, which issues the code and notifies the team
      const code = demoCode();
      request.sent = true; request.code = code;
      err.textContent = ''; $('sentCode').textContent = code; $('reqCode').textContent = code; $('summary').classList.add('is-sent'); toast(code + ' / request received'); updGo(); updBar();
    }, { signal });
  },
};
