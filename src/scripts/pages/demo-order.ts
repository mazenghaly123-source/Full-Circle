// How it works: "you are the order". A demo order moves through the eight stages as you scroll,
// with the sample approval gate at stage 05.
import { navigate } from 'astro:transitions/client';
import type { Feature } from '../core/lifecycle';
import { later } from '../core/lifecycle';
import { $, byId, pad, ring, rm, toast, vib } from '../core/util';
import { yo } from '../core/state';
import { DEMO_PRODUCTS, ROUTES, STAGES } from '../../data/site';
import { updBar } from '../shell/mbar';
import { setGarment } from './garment';

const yoOrder = () => yo.ok ? yo.here : Math.min(yo.here, 4);
const PATH_LINE = {
  Starting: 'Your order enters at research. We handle design support and the tech pack before the first sample.',
  Scaling: 'Your order enters at development. Bring a garment; we rebuild the pattern and lock it for bulk.',
} as Record<string, string>;

// The count-up and a photo request carry on if you leave the page, as they did in the one-document
// prototype; they update the page only while it is on screen.
let unitsRaf = 0;
function yoUnits() {
  if (unitsRaf) return; const t0 = performance.now(), from = yo.units;
  const step = (now: number) => {
    const p = rm ? 1 : Math.min(1, (now - t0) / 1800), e = 1 - Math.pow(1 - p, 3);
    yo.units = Math.round(from + (300 - from) * e);
    const el = document.getElementById('yoUnits'); if (el) el.textContent = String(yo.units).padStart(3, '0');
    unitsRaf = p < 1 ? requestAnimationFrame(step) : 0;
  };
  unitsRaf = requestAnimationFrame(step);
}

/** The photo button: off while a photo is on its way, and "another" once one has come. */
function photoButton(doc: Document) {
  const b = byId(doc)<HTMLButtonElement>('yoPhoto'); if (!b) return;
  b.disabled = yo.photoPending; if (yo.photoAsked) b.textContent = 'Request another photo';
}

function askPhoto() {
  yo.photoPending = true; photoButton(document); toast('Photo requested / floor notified');
  setTimeout(() => {
    yo.photoPending = false; yo.photoAsked = true; toast('Photo received / ' + STAGES[yoOrder()].n);
    photoButton(document);
  }, 2200);
}

/** The gate once the sample is signed: the button done, and when it was signed. */
function showApproved(doc: Document) {
  const g = byId(doc), b = g<HTMLButtonElement>('yoApprove');
  b.disabled = true; b.textContent = 'Sample approved'; g('yoAt').textContent = 'Signed ' + yo.at + ' / bulk released';
}

function yoRender(doc: Document) {
  const g = byId(doc);
  const os = yoOrder(), waiting = !yo.ok && yo.here > 4;
  g('yoArcS').style.strokeDashoffset = String(100 - ((yo.here + 0.5) / 8) * 100);
  g('yoArcO').style.strokeDashoffset = String(100 - ((os + 0.5) / 8) * 100);
  [...g('yoTicks').children].forEach((t, i) => t.classList.toggle('on', i <= os));
  [...g('yoLabels').children].forEach((b, i) => b.classList.toggle('here', i === yo.here));
  const [x, y] = ring(50, 50, 35.67, (os + 0.5) / 8);
  g('yoYou').style.left = g('yoTag').style.left = x + '%'; g('yoYou').style.top = g('yoTag').style.top = y + '%';
  g('yoTag').textContent = waiting ? yo.code + ' / waiting on you' : yo.code;
  setGarment(doc, yo.product);
  const gar = g('yoGar'); gar.setAttribute('data-s', String(yo.here + 1)); gar.style.setProperty('--fab', `url(#f-${yo.fab})`);
  gar.classList.toggle('ok', yo.ok && yo.here >= 4); gar.classList.toggle('locked', waiting);
  g('yoStage').textContent = pad(os + 1) + ' / ' + STAGES[os].n;
  g('yoBrief').textContent = (yo.path || 'Path not chosen') + ' / ' + yo.product + ' / ' + yo.fabName;
  let next = STAGES[yo.here].ok;
  if (!yo.path && yo.here <= 1) next = 'Choose your path';
  if (waiting || (yo.here === 4 && !yo.ok)) next = 'Approve sample 03';
  if (yo.here === 7) next = 'Send the request';
  g('yoNext').textContent = next;
  [...g('yoSegs').children].forEach((s, i) => s.className = i < os ? 'on' : i === os ? 'cur' : '');
  g('yoGate').hidden = yo.ok;
  g('yoReceipt').innerHTML = [['Order', yo.code], ['Path', yo.path || '—'], ['Product', yo.product], ['Fabric', yo.fabName], ['Sample', yo.ok ? 'Approved ' + yo.at : 'Not approved'], ['Stage', pad(os + 1) + ' / ' + STAGES[os].n]].map(([k, v]) => `<div><span class="dim">${k}</span><span>${v}</span></div>`).join('');
}

/** Everything the visitor has done so far, written into a page (the live one or the one coming in). */
function restore(doc: Document) {
  if (!doc.getElementById('yo')) return;
  const g = byId(doc);
  ['yoC1', 'yoTag', 'yoCode'].forEach((id) => g(id).textContent = yo.code); g('yoBox').textContent = yo.code + ' / 300 units / Cairo';
  doc.querySelectorAll('[data-yopath]').forEach((x) => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.yopath === yo.path)));
  if (yo.path) g('yoPathLine').textContent = PATH_LINE[yo.path];
  [...g('yoProducts').children].forEach((x) => x.setAttribute('aria-pressed', String(x.textContent === yo.product)));
  [...g('yoFabrics').children].forEach((x) => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.fab === yo.fab)));
  if (yo.ok) showApproved(doc);
  photoButton(doc);
  g('yoUnits').textContent = String(yo.units).padStart(3, '0');
  if (yo.checked) [...g('yoChecks').children].forEach((li) => li.classList.add('ok'));
  yoRender(doc);
}

export const demoOrderFeature: Feature = {
  prepare: restore,
  mount(signal) {
    if (!document.getElementById('yo')) return;
    function render() {
      yoRender(document);
      if (yo.here === 5 && yo.ok && yo.units < 300) yoUnits();
      if (yo.here >= 6 && yo.ok && !yo.checked) { yo.checked = true; [...$('yoChecks').children].forEach((li, i) => later(signal, () => li.classList.add('ok'), rm ? 0 : 240 * i + 200)); }
    }
    document.querySelectorAll<HTMLElement>('[data-yopath]').forEach((b) => b.addEventListener('click', () => {
      vib(); yo.path = b.dataset.yopath!; document.querySelectorAll('[data-yopath]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('yoPathLine').textContent = PATH_LINE[yo.path];
      toast('Path set / ' + yo.path); render();
    }, { signal }));
    $('yoProducts').addEventListener('click', (e) => { const c = (e.target as Element).closest('.opt'); if (!c) return; vib(); yo.product = c.textContent!; [...$('yoProducts').children].forEach((x) => x.setAttribute('aria-pressed', String(x === c))); render(); }, { signal });
    $('yoFabrics').addEventListener('click', (e) => { const c = (e.target as Element).closest<HTMLElement>('.yo-sw'); if (!c) return; vib(); yo.fab = c.dataset.fab!; yo.fabName = c.dataset.name!; [...$('yoFabrics').children].forEach((x) => x.setAttribute('aria-pressed', String(x === c))); render(); }, { signal });
    const yoApprove = () => { if (yo.ok) return; vib(); yo.ok = true; const d = new Date(); yo.at = pad(d.getHours()) + ':' + pad(d.getMinutes()); showApproved(document); toast(yo.code + ' / sample 03 approved'); render(); };
    $('yoApprove').addEventListener('click', yoApprove, { signal }); document.querySelectorAll('[data-yoapprove]').forEach((b) => b.addEventListener('click', yoApprove, { signal }));
    $('yoPhoto').addEventListener('click', () => { vib(); askPhoto(); }, { signal });
    $('yoReal').addEventListener('click', () => {
      const product = DEMO_PRODUCTS.find((p) => p.label === yo.product)!.product;
      const q = new URLSearchParams({ ...(yo.path ? { path: yo.path } : {}), product });
      navigate(`${ROUTES.start}?${q}`); toast('Your choices are carried over');
    }, { signal });
    const yoLbls = [...$('yoLabels').children], yoSts = [...document.querySelectorAll<HTMLElement>('.yo-st')];
    yoLbls.forEach((b, i) => b.addEventListener('click', () => yoSts[i].scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'start' }), { signal }));
    function yoMeasure() {
      const box = $('yo').getBoundingClientRect(), vh = innerHeight;
      yo.visible = box.top < vh * 0.6 && box.bottom > vh * 0.4;
      $('yoTicket').classList.toggle('show', yo.visible); document.body.classList.toggle('yo-on', yo.visible);
      const mid = vh * (innerWidth <= 900 ? 0.66 : 0.5); let here = 0;
      yoSts.forEach((s, i) => { if (s.getBoundingClientRect().top < mid) here = i; });
      if (here !== yo.here) { const prev = yo.here; yo.here = here; if (here > 4 && prev <= 4 && !yo.ok) toast('Production is waiting on your approval'); render(); }
      updBar();
    }
    addEventListener('scroll', yoMeasure, { passive: true, signal }); addEventListener('resize', yoMeasure, { signal });
    restore(document);
    // a count-up interrupted by leaving picks up again when you come back to stage 06
    if (yo.here === 5 && yo.ok && yo.units < 300) yoUnits();
    later(signal, yoMeasure, 50);
  },
};
