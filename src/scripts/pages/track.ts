// Track order. Phase 1 keeps the prototype's demo: any sign-in works and shows three sample orders.
// Phase 3 replaces this with real sign-in codes (email or WhatsApp) and the client's own orders.
import type { Feature } from '../core/lifecycle';
import { later } from '../core/lifecycle';
import { $, nowStamp, pad, ring, rm, toast, vib } from '../core/util';
import { STAGES } from '../../data/site';
import { bindPhoto, isLoaded } from '../shell/images';

type Order = {
  code: string; name: string; meta: string; stage: number; need: string; decH: string; decP: string;
  specs: [string, string][]; log: [string, string][];
  /** photos asked for since the order view was last drawn (stage index) */
  extra: number[];
};

const ORDERS: Order[] = [
  { code: 'FC-2418', name: 'Overshirt', meta: 'Sample 03 / denim 12 oz / 300 pcs', stage: 4, need: 'Approve sample 03', decH: 'Approve sample 03', decP: 'Fit and fabric are revised from your notes on sample 02. Once you approve, this sample becomes the reference for bulk cutting.',
    specs: [['Fabric', 'Denim 12 oz, rinse'], ['Sizes', 'S / M / L / XL'], ['Chest (M)', '56.0 cm'], ['Body length (M)', '74.0 cm'], ['Quantity', '300 pcs']],
    log: [['Brief approved', 'Studio'], ['Tech pack signed off', 'Studio'], ['Fabric selected / denim 12 oz', 'Studio'], ['Pattern signed off', 'Studio'], ['Sample 02 / changes requested', 'Studio']], extra: [] },
  { code: 'FC-2431', name: 'Heavy hoodie', meta: 'Fleece 400 gsm / 500 pcs', stage: 5, need: 'None / in production', decH: '', decP: '',
    specs: [['Fabric', 'Fleece 400 gsm, loopback'], ['Sizes', 'XS – XXL'], ['Print', 'Puff print, chest'], ['Quantity', '500 pcs']],
    log: [['Brief approved', 'Studio'], ['Tech pack signed off', 'Studio'], ['Fabric selected', 'Studio'], ['Pattern signed off', 'Studio'], ['Sample 02 approved', 'Studio']], extra: [] },
  { code: 'FC-2455', name: 'Boxy tee', meta: 'Jersey 240 gsm / 400 pcs', stage: 2, need: 'Choose fabric', decH: 'Choose the fabric', decP: 'Three jersey swatches were sent on Monday. Pick one so we can cut the first pattern.',
    specs: [['Fabric', 'Jersey 240 gsm, 3 options'], ['Fit', 'Boxy, dropped shoulder'], ['Quantity', '400 pcs']],
    log: [['Brief approved', 'Studio'], ['Tech pack signed off', 'Studio']], extra: [] },
];

const T = {
  view: 'login' as 'login' | 'orders' | 'order',
  cur: null as Order | null,
  codeStep: false,
  id: '',
  code: '',
  tab: 'photos',
  /** log rows added in this session, newest first (dates as shown) */
  stamps: new Map<Order, string[]>(),
};
const LOGIN_LEAD = 'Sign in with the email or WhatsApp number on your order. You will see every order, its stage, the next decision, photos and the full approval log.';

type StagePhoto = { avif: string; webp: string; src: string; focus?: string };
let photoUrls: Record<string, StagePhoto> | null = null;
let photoSizes = '';
const stagePhoto = (doc: Document, slot: string) => {
  if (!photoUrls) { const s = doc.getElementById('tSection')!; photoUrls = JSON.parse(s.dataset.stagePhotos!); photoSizes = s.dataset.stageSizes!; }
  const p = photoUrls![slot]; if (!p) return '';
  return `<picture><source type="image/avif" srcset="${p.avif}" sizes="${photoSizes}"><source type="image/webp" srcset="${p.webp}" sizes="${photoSizes}"><img src="${p.src}" alt="" class="fill${isLoaded(p.src) ? ' ok' : ''}" loading="lazy" decoding="async"${p.focus ? ` style="object-position:${p.focus}"` : ''}></picture>`;
};

function tView(doc: Document) {
  const g = (id: string) => doc.getElementById(id)!, v = T.view;
  g('tLogin').hidden = v !== 'login'; g('tOrders').hidden = v !== 'orders'; g('tOrder').hidden = v !== 'order';
  g('tTitle').textContent = v === 'login' ? 'Track your order.' : v === 'orders' ? 'Your orders.' : T.cur!.code + '.';
  g('tLead').textContent = v === 'login' ? LOGIN_LEAD : v === 'orders' ? 'Every order, where it is, and what we need from you.' : T.cur!.name + ' / ' + STAGES[T.cur!.stage].n;
}

function renderLogin(doc: Document) {
  const g = (id: string) => doc.getElementById(id)!;
  g('tA').hidden = T.codeStep; g('tB').hidden = !T.codeStep;
  g('tStep').textContent = T.codeStep ? 'Step 2 of 2' : 'Step 1 of 2'; g('tLoginH').textContent = T.codeStep ? 'Enter the code' : 'Sign in';
  (g('tId') as HTMLInputElement).value = T.id; (g('tCode') as HTMLInputElement).value = T.code;
}

function renderList(doc: Document) {
  doc.getElementById('tList')!.innerHTML = ORDERS.map((o, i) => `<button class="ord" data-o="${i}"><span class="code">${o.code}</span><span>${o.name}<br><span class="mono dim">${o.meta}</span></span><span class="mono">${pad(o.stage + 1)} / ${STAGES[o.stage].n}</span><span class="mono ${o.decH ? 'need' : 'dim'}">${o.need}</span><span class="arrow">→</span></button>`).join('');
}

const photoTile = (doc: Document, s: number, k: number) => {
  const i = Math.max(0, s - k), slot = `stage-${pad(i + 1)}`;
  return `<div class="ph" data-img="${slot}" style="--tone:radial-gradient(70% 60% at ${30 + k * 20}% 40%,${STAGES[i].tone},#1b1b18 72%)">${stagePhoto(doc, slot)}<div class="cap mono"><span>${STAGES[i].s}</span><span>${k === 0 ? 'Latest' : ''}</span></div></div>`;
};
const extraTile = (s: number) => `<div class="ph" style="--tone:radial-gradient(70% 60% at 50% 40%,${STAGES[s].tone},#1b1b18 72%)"><div class="cap mono"><span>${STAGES[s].s}</span><span style="color:var(--red)">New</span></div></div>`;

function renderOrder(doc: Document) {
  const o = T.cur!, s = o.stage, g = (id: string) => doc.getElementById(id)!;
  g('oArc').style.strokeDashoffset = String(100 - ((s + 0.5) / 8) * 100);
  const [x, y] = ring(200, 200, 150, (s + 0.5) / 8); g('oDot').setAttribute('cx', String(x)); g('oDot').setAttribute('cy', String(y));
  [...g('oLabels').children].forEach((t, k) => t.classList.toggle('done', k <= s));
  g('oNum').textContent = pad(s + 1); g('oSub').textContent = STAGES[s].n;
  g('oMeta').textContent = o.code + ' / ' + o.meta; g('oName').textContent = o.name;
  const need = !!o.decH;
  g('tChip').classList.toggle('ok', need); g('tChipT').textContent = need ? 'Waiting on you' : 'On track';
  g('oDecision').classList.toggle('done', !need);
  g('oDecT').textContent = need ? 'Your decision' : 'Next decision';
  g('oDecH').textContent = need ? o.decH : STAGES[s].ok;
  g('oDecP').textContent = need ? o.decP : 'Nothing needed from you right now. We will message you when the next decision is ready.';
  g('oDecBtns').hidden = !need;
  g('oPhotos').innerHTML = o.extra.map(extraTile).join('') + [0, 1, 2].map((k) => photoTile(doc, s, k)).join('');
  g('oSpecs').innerHTML = o.specs.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('');
  const stamps = T.stamps.get(o) ?? [];
  g('oLog').innerHTML = o.log.map(([d, by], k) => `<tr><td>${k >= o.log.length - stamps.length ? stamps[o.log.length - 1 - k] : pad(1 + k * 3) + ' Oct'}</td><td>${d}</td><td>${by}</td></tr>`).reverse().join('');
}

function renderTabs(doc: Document) {
  doc.querySelectorAll('.tabs2 [role=tab]').forEach((x) => x.setAttribute('aria-selected', String((x as HTMLElement).dataset.tab === T.tab)));
  doc.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => p.hidden = p.dataset.panel !== T.tab);
}

function restore(doc: Document) {
  if (!doc.getElementById('tLogin')) return;
  renderLogin(doc);
  if (T.view !== 'login') renderList(doc);
  if (T.cur) renderOrder(doc);
  renderTabs(doc);
  tView(doc);
}

export const trackFeature: Feature = {
  prepare: restore,
  mount(signal) {
    if (!document.getElementById('tLogin')) return;
    restore(document);
    const bindPhotos = () => $('oPhotos').querySelectorAll<HTMLImageElement>('img').forEach(bindPhoto);
    const bindList = () => $('tList').querySelectorAll<HTMLElement>('.ord').forEach((b) => b.addEventListener('click', () => openOrder(+b.dataset.o!), { signal }));
    bindList(); bindPhotos();
    const showList = () => { renderList(document); bindList(); T.view = 'orders'; tView(document); };
    function openOrder(i: number) { T.cur = ORDERS[i]; T.cur.extra = []; renderOrder(document); bindPhotos(); T.view = 'order'; tView(document); scrollTo({ top: 0, behavior: rm ? 'auto' : 'smooth' }); }
    const addLog = (txt: string) => {
      const o = T.cur!, stamp = nowStamp(), tr = document.createElement('tr'); tr.className = 'new';
      tr.innerHTML = `<td>${stamp}</td><td>${txt}</td><td>You</td>`; $('oLog').prepend(tr);
      o.log.push([txt, 'You']); T.stamps.set(o, [stamp, ...(T.stamps.get(o) ?? [])]);
    };
    $('oApprove').addEventListener('click', () => {
      const o = T.cur!; vib(); addLog(o.decH + ' / approved'); toast(o.code + ' / approved');
      o.decH = ''; o.need = 'None / next stage'; if (o.stage < 7) o.stage += 1; o.extra = []; renderOrder(document); bindPhotos(); renderList(document); bindList();
    }, { signal });
    $('oChanges').addEventListener('click', () => { vib(); addLog(T.cur!.decH + ' / changes requested'); toast('Changes sent to the team'); }, { signal });
    $('oPhoto').addEventListener('click', () => {
      const o = T.cur!, b = $<HTMLButtonElement>('oPhoto'); vib(); b.disabled = true; toast('Photo requested / floor notified'); addLog('Photo requested / ' + STAGES[o.stage].n);
      later(signal, () => { o.extra.unshift(o.stage); const d = document.createElement('div'); d.innerHTML = extraTile(o.stage); $('oPhotos').prepend(d.firstElementChild!); b.disabled = false; toast('Photo received'); }, 2200);
    }, { signal });
    document.querySelectorAll<HTMLElement>('.tabs2 [role=tab]').forEach((t) => t.addEventListener('click', () => { T.tab = t.dataset.tab!; renderTabs(document); }, { signal }));
    const signIn = () => { showList(); toast('Signed in / demo account'); };
    $('tId').addEventListener('input', (e) => { T.id = (e.target as HTMLInputElement).value; }, { signal });
    $('tCode').addEventListener('input', (e) => { T.code = (e.target as HTMLInputElement).value; }, { signal });
    $('tSendCode').addEventListener('click', () => {
      if ($<HTMLInputElement>('tId').value.trim().length < 4) { $('tErr').textContent = 'Add the email or WhatsApp number on your order'; return; }
      $('tErr').textContent = ''; T.codeStep = true; renderLogin(document); $('tCode').focus(); toast('Code sent');
    }, { signal });
    $('tVerify').addEventListener('click', () => {
      if (!/^\d{6}$/.test($<HTMLInputElement>('tCode').value)) { $('tErr').textContent = 'Enter the 6 digits from the message'; return; }
      $('tErr').textContent = ''; signIn();
    }, { signal });
    const back = () => { T.codeStep = false; renderLogin(document); };
    $('tBack').addEventListener('click', back, { signal });
    $('tDemo').addEventListener('click', signIn, { signal });
    $('tOut').addEventListener('click', () => { back(); T.view = 'login'; tView(document); }, { signal });
    $('tAll').addEventListener('click', showList, { signal });
  },
};
