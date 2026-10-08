// How it works: "you are the order". A demo order moves through the eight stages as you scroll,
// with the sample approval gate at stage 05.
import { navigate } from 'astro:transitions/client';
import type { Feature } from '../core/lifecycle';
import { later } from '../core/lifecycle';
import { $, pad, rm, toast, vib } from '../core/util';
import { yo as Y } from '../core/state';
import { ROUTES, STAGES } from '../../data/site';
import { updBar } from '../shell/mbar';

const yoPos = (f: number, r: number) => { const a = (f * 360 - 90) * Math.PI / 180; return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) }; };
const yoOrder = () => Y.ok ? Y.here : Math.min(Y.here, 4);
const PATH_LINE = {
  Starting: 'Your order enters at research. We handle design support and the tech pack before the first sample.',
  Scaling: 'Your order enters at development. Bring a garment; we rebuild the pattern and lock it for bulk.',
} as Record<string, string>;

function yoRender(doc: Document) {
  const g = (id: string) => doc.getElementById(id)!;
  const os = yoOrder(), waiting = !Y.ok && Y.here > 4;
  g('yoArcS').style.strokeDashoffset = String(100 - ((Y.here + 0.5) / 8) * 100);
  g('yoArcO').style.strokeDashoffset = String(100 - ((os + 0.5) / 8) * 100);
  [...g('yoTicks').children].forEach((t, i) => t.classList.toggle('on', i <= os));
  [...g('yoLabels').children].forEach((b, i) => b.classList.toggle('here', i === Y.here));
  const yp = yoPos((os + 0.5) / 8, 35.67);
  g('yoYou').style.left = g('yoTag').style.left = yp.x + '%'; g('yoYou').style.top = g('yoTag').style.top = yp.y + '%';
  g('yoTag').textContent = waiting ? Y.code + ' / waiting on you' : Y.code;
  const gar = g('yoGar'); gar.setAttribute('data-s', String(Y.here + 1)); gar.style.setProperty('--fab', `url(#f-${Y.fab})`);
  gar.classList.toggle('ok', Y.ok && Y.here >= 4); gar.classList.toggle('locked', waiting);
  g('yoStage').textContent = pad(os + 1) + ' / ' + STAGES[os].n;
  g('yoBrief').textContent = (Y.path || 'Path not chosen') + ' / ' + Y.product + ' / ' + Y.fabName;
  let next = STAGES[Y.here].ok;
  if (!Y.path && Y.here <= 1) next = 'Choose your path';
  if (waiting || (Y.here === 4 && !Y.ok)) next = 'Approve sample 03';
  if (Y.here === 7) next = 'Send the request';
  g('yoNext').textContent = next;
  [...g('yoSegs').children].forEach((s, i) => s.className = i < os ? 'on' : i === os ? 'cur' : '');
  g('yoGate').hidden = Y.ok;
  g('yoReceipt').innerHTML = [['Order', Y.code], ['Path', Y.path || '—'], ['Product', Y.product], ['Fabric', Y.fabName], ['Sample', Y.ok ? 'Approved ' + Y.at : 'Not approved'], ['Stage', pad(os + 1) + ' / ' + STAGES[os].n]].map(([k, v]) => `<div><span class="dim">${k}</span><span>${v}</span></div>`).join('');
}

/** Everything the visitor has done so far, written into a page (the live one or the one coming in). */
function restore(doc: Document) {
  if (!doc.getElementById('yo')) return;
  const g = (id: string) => doc.getElementById(id)!;
  ['yoC1', 'yoTag', 'yoCode'].forEach((id) => g(id).textContent = Y.code); g('yoBox').textContent = Y.code + ' / 300 units / Cairo';
  doc.querySelectorAll('[data-yopath]').forEach((x) => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.yopath === Y.path)));
  if (Y.path) g('yoPathLine').textContent = PATH_LINE[Y.path];
  [...g('yoProducts').children].forEach((x) => x.setAttribute('aria-pressed', String(x.textContent === Y.product)));
  [...g('yoFabrics').children].forEach((x) => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.fab === Y.fab)));
  if (Y.ok) { const b = g('yoApprove') as HTMLButtonElement; b.disabled = true; b.textContent = 'Sample approved'; g('yoAt').textContent = 'Signed ' + Y.at + ' / bulk released'; }
  if (Y.photoAsked) g('yoPhoto').textContent = 'Request another photo';
  g('yoUnits').textContent = String(Y.units).padStart(3, '0');
  if (Y.checked) [...g('yoChecks').children].forEach((li) => li.classList.add('ok'));
  yoRender(doc);
}

export const demoOrderFeature: Feature = {
  prepare: restore,
  mount(signal) {
    if (!document.getElementById('yo')) return;
    let yoRaf = 0;
    signal.addEventListener('abort', () => cancelAnimationFrame(yoRaf), { once: true });
    function yoUnits() {
      if (yoRaf) return; const t0 = performance.now(), from = Y.units;
      const step = (now: number) => { const p = rm ? 1 : Math.min(1, (now - t0) / 1800), e = 1 - Math.pow(1 - p, 3); Y.units = Math.round(from + (300 - from) * e); $('yoUnits').textContent = String(Y.units).padStart(3, '0'); if (p < 1) yoRaf = requestAnimationFrame(step); else yoRaf = 0; };
      yoRaf = requestAnimationFrame(step);
    }
    function render() {
      yoRender(document);
      if (Y.here === 5 && Y.ok && Y.units < 300) yoUnits();
      if (Y.here >= 6 && Y.ok && !Y.checked) { Y.checked = true; [...$('yoChecks').children].forEach((li, i) => later(signal, () => li.classList.add('ok'), rm ? 0 : 240 * i + 200)); }
    }
    document.querySelectorAll<HTMLElement>('[data-yopath]').forEach((b) => b.addEventListener('click', () => {
      vib(); Y.path = b.dataset.yopath!; document.querySelectorAll('[data-yopath]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('yoPathLine').textContent = PATH_LINE[Y.path];
      toast('Path set / ' + Y.path); render();
    }, { signal }));
    $('yoProducts').addEventListener('click', (e) => { const c = (e.target as Element).closest('.opt'); if (!c) return; vib(); Y.product = c.textContent!; [...$('yoProducts').children].forEach((x) => x.setAttribute('aria-pressed', String(x === c))); render(); }, { signal });
    $('yoFabrics').addEventListener('click', (e) => { const c = (e.target as Element).closest<HTMLElement>('.yo-sw'); if (!c) return; vib(); Y.fab = c.dataset.fab!; Y.fabName = c.dataset.name!; [...$('yoFabrics').children].forEach((x) => x.setAttribute('aria-pressed', String(x === c))); render(); }, { signal });
    const yoApprove = () => { if (Y.ok) return; vib(); Y.ok = true; const d = new Date(); Y.at = pad(d.getHours()) + ':' + pad(d.getMinutes()); const b = $<HTMLButtonElement>('yoApprove'); b.disabled = true; b.textContent = 'Sample approved'; $('yoAt').textContent = 'Signed ' + Y.at + ' / bulk released'; toast(Y.code + ' / sample 03 approved'); render(); };
    $('yoApprove').addEventListener('click', yoApprove, { signal }); document.querySelectorAll('[data-yoapprove]').forEach((b) => b.addEventListener('click', yoApprove, { signal }));
    $('yoPhoto').addEventListener('click', () => {
      vib(); const b = $<HTMLButtonElement>('yoPhoto'); b.disabled = true; toast('Photo requested / floor notified');
      later(signal, () => { toast('Photo received / ' + STAGES[yoOrder()].n); b.disabled = false; b.textContent = 'Request another photo'; Y.photoAsked = true; }, 2200);
    }, { signal });
    $('yoReal').addEventListener('click', () => {
      // the request form calls outerwear "Jackets" (the prototype passed "Outerwear", which matched no option)
      const product = Y.product === 'Outerwear' ? 'Jackets' : Y.product;
      const q = new URLSearchParams({ ...(Y.path ? { path: Y.path } : {}), product });
      navigate(`${ROUTES.start}?${q}`); toast('Your choices are carried over');
    }, { signal });
    const yoLbls = [...$('yoLabels').children], yoSts = [...document.querySelectorAll<HTMLElement>('.yo-st')];
    yoLbls.forEach((b, i) => b.addEventListener('click', () => yoSts[i].scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'start' }), { signal }));
    function yoMeasure() {
      const box = $('yo').getBoundingClientRect(), vh = innerHeight;
      Y.visible = box.top < vh * 0.6 && box.bottom > vh * 0.4;
      $('yoTicket').classList.toggle('show', Y.visible); document.body.classList.toggle('yo-on', Y.visible);
      const mid = vh * (innerWidth <= 900 ? 0.66 : 0.5); let here = 0;
      yoSts.forEach((s, i) => { if (s.getBoundingClientRect().top < mid) here = i; });
      if (here !== Y.here) { const prev = Y.here; Y.here = here; if (here > 4 && prev <= 4 && !Y.ok) toast('Production is waiting on your approval'); render(); }
      updBar();
    }
    addEventListener('scroll', yoMeasure, { passive: true, signal }); addEventListener('resize', yoMeasure, { signal });
    restore(document);
    later(signal, yoMeasure, 50);
  },
};
