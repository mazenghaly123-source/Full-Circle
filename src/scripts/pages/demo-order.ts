// How it works: "you are the order" (Mazen, 7 Nov 2026). A demo order walks the three parts, Design,
// Build and Launch, step by step on the mark's own arcs as you scroll. Production waits at the sample
// until it is approved, and once the order has gone all the way round the arcs close into the mark.
import { navigate } from 'astro:transitions/client';
import type { Feature } from '../core/lifecycle';
import { later } from '../core/lifecycle';
import { $, byId, pad, rm, toast, vib } from '../core/util';
import { yo } from '../core/state';
import { ARCS, DEMO_GATE, DEMO_PRODUCTS, DEMO_STEPS, ROUTES } from '../../data/site';
import { ARC_PAD, MARK_ARCS, MARK_C } from '../../data/mark';
import { updBar } from '../shell/mbar';
import { setGarment } from './garment';

/** The last station, "Full circle", which is not a step. */
const LAST = DEMO_STEPS.length;
/** How many steps each part has. */
const PER = ARCS.map((_, p) => DEMO_STEPS.filter((d) => d.part === p).length);
const PATH_LINE: Record<string, string> = {
  Starting: 'We design it with you: name, logo, labels and packaging.',
  Scaling: 'You bring your brand. We start at the product, or at Build.',
};

/** The step the order is at: it waits at the sample until the sample is approved. */
const at = () => (yo.ok ? Math.min(yo.here, LAST - 1) : Math.min(yo.here, DEMO_GATE));
const waiting = () => !yo.ok && yo.here > DEMO_GATE;
/** The order has gone all the way round. */
const closed = () => yo.ok && yo.here === LAST;
const product = () => DEMO_PRODUCTS.find((p) => p.label === yo.product) ?? DEMO_PRODUCTS[0];

/** How much of each arc is drawn: the parts behind the order, and half of the step it is on. */
function goal(): number[] {
  if (closed()) return [1, 1, 1];
  const s = DEMO_STEPS[at()], k = DEMO_STEPS.slice(0, at()).filter((d) => d.part === s.part).length;
  return ARCS.map((_, p) => (p < s.part ? 1 : p > s.part ? 0 : (k + 0.5) / PER[p]));
}

// ---- the mark: the middle of each arc's band at every degree, worked out at build time (data/mark.ts), so
// the order rides the middle of the arc it is on
let radii: number[][] | null = null;
/** The middle of arc i at an angle (degrees clockwise from 3 o'clock). */
function mid(doc: Document, i: number, deg: number) {
  radii ??= JSON.parse(doc.getElementById('yoMark')?.dataset.mid ?? 'null');
  for (let d = 0; d < 12; d++) for (const s of [d, -d]) {
    const r = radii?.[i][((Math.round(deg) + s) % 360 + 360) % 360];
    if (r) return r;
  }
  return 110;
}

/** Draws the arcs to `f` (a share of each) and puts the order at the tip of the last one started. */
function paint(doc: Document, f: number[]) {
  doc.querySelectorAll<SVGCircleElement>('#yoMark mask circle').forEach((c, i) => c.setAttribute('stroke-dasharray', `${(MARK_ARCS[i].span + ARC_PAD * 2) * f[i]} 400`));
  let i = 2; while (i > 0 && f[i] <= 0.001) i--;
  const deg = MARK_ARCS[i].start + MARK_ARCS[i].span * f[i], r = mid(doc, i, deg), a = (deg * Math.PI) / 180;
  doc.getElementById('yoYou')?.setAttribute('transform', `translate(${(MARK_C[0] + r * Math.cos(a)).toFixed(2)} ${(MARK_C[1] + r * Math.sin(a)).toFixed(2)})`);
}

// the arcs ease toward their goal by time, not by frame, so a slow machine gets there as soon; what is
// drawn carries over to the page when you come back
let shown = [0, 0, 0], raf = 0, last = 0;
function ease(now: number) {
  raf = 0;
  const g = goal(), k = rm ? 1 : 1 - Math.exp(-Math.min(0.25, (now - last) / 1000) / 0.16); last = now;
  let moving = false;
  shown = shown.map((v, i) => {
    const n = v + (g[i] - v) * k;
    if (Math.abs(g[i] - n) < 0.002) return g[i];
    moving = true; return n;
  });
  paint(document, shown);
  if (moving) raf = requestAnimationFrame(ease);
}
const drawToGoal = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(ease); } };

// the count-up carries on if you leave the page, as it did in the one-document prototype; it updates
// the page only while it is on screen
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

/** The gate once the sample is signed: the button done, and when it was signed. */
function showApproved(doc: Document) {
  const g = byId(doc), b = g<HTMLButtonElement>('yoApprove');
  b.disabled = true; b.textContent = 'Sample approved'; g('yoAt').textContent = 'Signed ' + yo.at + ' / bulk released';
}

function yoRender(doc: Document) {
  const g = byId(doc), a = at(), w = waiting(), done = closed(), step = DEMO_STEPS[a];
  g('yoMark').classList.toggle('done', done); g('yoInst').classList.toggle('done', done);
  // the station's look of the garment, the brand label on the first, the stamp once the sample is signed
  setGarment(doc, product().garment);
  const gar = g('yoGar');
  gar.setAttribute('data-s', String(yo.here < LAST ? DEMO_STEPS[yo.here].s : 9)); gar.style.setProperty('--fab', `url(#f-${yo.fab})`);
  gar.classList.toggle('branded', yo.here === 0); gar.classList.toggle('ok', yo.ok && yo.here >= DEMO_GATE); gar.classList.toggle('locked', w);
  // the steps behind the order, the one it is on, and the part it is in
  const lit = (j: number) => (done || j < a ? 'on' : j === a ? 'cur' : '');
  const seg = (row: Element) => [...row.children].forEach((part, p) => [...part.querySelectorAll('i')].forEach((el, k) => { el.className = lit(DEMO_STEPS.findIndex((d) => d.part === p) + k); }));
  seg(g('yoSegs')); seg(g('yoRail'));
  [...g('yoRail').children].forEach((b, p) => b.classList.toggle('here', !done && p === step.part));
  g('yoNow').innerHTML = done ? '<b>Full circle</b>' : w ? '<b>Waiting at the sample</b> / approve to release bulk' : `<b>${pad(step.part + 1)} ${ARCS[step.part].n}</b> / ${step.n}`;
  g('yoStage').textContent = done ? 'Full circle' : `${ARCS[step.part].n} / ${step.n}${w ? ' (waiting)' : ''}`;
  g('yoBrief').textContent = (yo.path || 'Path not chosen') + ' / ' + yo.product + ' / ' + yo.fabName;
  let next = yo.here < LAST ? DEMO_STEPS[yo.here].ok : 'Send the request';
  if (!yo.path && yo.here === 0) next = 'Choose your path';
  if (w || (yo.here === DEMO_GATE && !yo.ok)) next = 'Approve sample 03';
  g('yoNext').textContent = next;
  g('yoGate').hidden = yo.ok;
  const brand = yo.path === 'Starting' ? 'Designed with us' : yo.path === 'Scaling' ? 'Yours' : '—';
  g('yoReceipt').innerHTML = ([['Order', yo.code], ['Brand', brand], ['Product', yo.product], ['Fabric', yo.fabName], ['Sample 03', yo.ok ? 'Approved ' + yo.at : 'Not approved'], ['Units', yo.ok ? '300' : 'Waiting'], ['Launch', yo.launch.join(' + ') || 'None']] as const)
    .map(([k, v]) => `<div><span class="dim">${k}</span><span>${v}</span></div>`).join('');
}

/** Everything the visitor has done so far, written into a page (the live one or the one coming in). */
function restore(doc: Document) {
  if (!doc.getElementById('yo')) return;
  const g = byId(doc);
  doc.querySelectorAll('.yoCode').forEach((e) => (e.textContent = yo.code)); g('yoBox').textContent = yo.code + ' / 300 units / Cairo';
  doc.querySelectorAll<HTMLElement>('[data-yopath]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.yopath === yo.path)));
  if (yo.path) g('yoPathLine').textContent = PATH_LINE[yo.path];
  g('yoKit').classList.toggle('off', yo.path !== 'Starting');
  [...g('yoProducts').children].forEach((x) => x.setAttribute('aria-pressed', String(x.textContent === yo.product)));
  [...g('yoFabrics').children].forEach((x) => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.fab === yo.fab)));
  [...g('yoLaunch').children].forEach((x) => x.setAttribute('aria-pressed', String(yo.launch.includes((x as HTMLElement).dataset.l!))));
  if (yo.ok) showApproved(doc);
  g('yoUnits').textContent = String(yo.units).padStart(3, '0');
  if (yo.checked) [...g('yoChecks').children].forEach((li) => li.classList.add('ok'));
  yoRender(doc);
  paint(doc, shown);
}

export const demoOrderFeature: Feature = {
  prepare: restore,
  mount(signal) {
    if (!document.getElementById('yo')) return;
    signal.addEventListener('abort', () => { cancelAnimationFrame(raf); raf = 0; }, { once: true });
    function render() {
      yoRender(document); drawToGoal();
      if (yo.here === 6 && yo.ok && yo.units < 300) yoUnits();
      if (yo.here >= 7 && yo.ok && !yo.checked) { yo.checked = true; [...$('yoChecks').children].forEach((li, i) => later(signal, () => li.classList.add('ok'), rm ? 0 : 240 * i + 200)); }
    }
    const pick = (box: HTMLElement, c: Element) => [...box.children].forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    document.querySelectorAll<HTMLElement>('[data-yopath]').forEach((b) => b.addEventListener('click', () => {
      vib(); yo.path = b.dataset.yopath!; document.querySelectorAll('[data-yopath]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('yoPathLine').textContent = PATH_LINE[yo.path]; $('yoKit').classList.toggle('off', yo.path !== 'Starting');
      toast('Path set / ' + yo.path); render();
    }, { signal }));
    const setFabric = (c: HTMLElement) => { yo.fab = c.dataset.fab!; yo.fabName = c.dataset.name!; pick($('yoFabrics'), c); };
    // a product starts on its own fabric, which can still be changed at Fabric + trims
    $('yoProducts').addEventListener('click', (e) => {
      const c = (e.target as Element).closest('.opt'); if (!c) return; vib(); yo.product = c.textContent!; pick($('yoProducts'), c);
      setFabric(document.querySelector<HTMLElement>(`#yoFabrics [data-fab="${product().fab}"]`)!); render();
    }, { signal });
    $('yoFabrics').addEventListener('click', (e) => { const c = (e.target as Element).closest<HTMLElement>('.yo-sw'); if (!c) return; vib(); setFabric(c); render(); }, { signal });
    $('yoLaunch').addEventListener('click', (e) => {
      const c = (e.target as Element).closest<HTMLElement>('.opt'); if (!c) return; vib();
      const on = c.getAttribute('aria-pressed') !== 'true'; c.setAttribute('aria-pressed', String(on));
      yo.launch = [...$('yoLaunch').children].filter((x) => x.getAttribute('aria-pressed') === 'true').map((x) => (x as HTMLElement).dataset.l!); render();
    }, { signal });
    const yoApprove = () => { if (yo.ok) return; vib(); yo.ok = true; const d = new Date(); yo.at = pad(d.getHours()) + ':' + pad(d.getMinutes()); showApproved(document); toast(yo.code + ' / sample 03 approved'); render(); };
    $('yoApprove').addEventListener('click', yoApprove, { signal }); document.querySelectorAll('[data-yoapprove]').forEach((b) => b.addEventListener('click', yoApprove, { signal }));
    $('yoReal').addEventListener('click', () => {
      // question 05: a Starting brand gets its branding, and the launch picks come along (photos, ads)
      const also = [...(yo.path === 'Starting' ? ['Branding'] : []), ...yo.launch];
      const q = new URLSearchParams({ ...(yo.path ? { path: yo.path } : {}), product: product().product, ...(also.length ? { also: also.join(',') } : {}) });
      navigate(`${ROUTES.start}?${q}`); toast('Your choices are carried over');
    }, { signal });
    [...$('yoRail').children].forEach((b, p) => b.addEventListener('click', () => $(`yoPart${p}`).scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'start' }), { signal }));
    const yoSts = [...document.querySelectorAll<HTMLElement>('.yo-st')];
    function yoMeasure() {
      const box = $('yo').getBoundingClientRect(), vh = innerHeight;
      yo.visible = box.top < vh * 0.6 && box.bottom > vh * 0.4;
      $('yoTicket').classList.toggle('show', yo.visible); document.body.classList.toggle('yo-on', yo.visible);
      const line = vh * (innerWidth <= 900 ? 0.66 : 0.5); let here = 0;
      yoSts.forEach((s, i) => { if (s.getBoundingClientRect().top < line) here = i; });
      if (here !== yo.here) { const prev = yo.here; yo.here = here; if (here > DEMO_GATE && prev <= DEMO_GATE && !yo.ok) toast('Production is waiting on your approval'); render(); }
      updBar();
    }
    addEventListener('scroll', yoMeasure, { passive: true, signal }); addEventListener('resize', yoMeasure, { signal });
    restore(document); drawToGoal();
    // a count-up interrupted by leaving picks up again when you come back to production
    if (yo.here === 6 && yo.ok && yo.units < 300) yoUnits();
    later(signal, yoMeasure, 50);
  },
};
