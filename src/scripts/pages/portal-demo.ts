// Home "Nothing ships unseen": the small portal demo (approve the sample, request a photo).
import type { Feature } from '../core/lifecycle';
import { $, nowStamp, pad, vib } from '../core/util';
import { STAGES } from '../../data/site';

const demo = { approved: false, photoPending: false, log: [] as { stamp: string; txt: string; tail: string }[] };

function render(doc: Document) {
  const rail = doc.getElementById('pRail'); if (!rail) return;
  const g = (id: string) => doc.getElementById(id)!;
  const approved = demo.approved, t = approved ? 5 : 4;
  g('pStage').textContent = pad(t + 1) + ' / ' + STAGES[t].n; g('pNext').textContent = approved ? 'QC result' : 'Approve sample 03';
  g('pChip').classList.toggle('ok', approved); g('pChipT').textContent = approved ? 'Approved' : 'Awaiting approval';
  g('pStamp').classList.toggle('show', approved); g('pApprove').textContent = approved ? 'Reset demo' : 'Approve sample';
  [...rail.children].forEach((d, k) => { const i = d.querySelector('i')!; i.className = k <= t ? 'done' : ''; i.innerHTML = k === t ? '<b></b>' : ''; (d as HTMLElement).style.opacity = k > t ? '0.45' : '1'; });
}

/** The whole log, for a page coming back (entries replay their entrance, as the prototype's did). */
function renderLog(doc: Document) {
  const L = doc.getElementById('pLog'); if (!L) return;
  L.hidden = !demo.log.length;
  L.innerHTML = demo.log.map((e) => `<div><span>${e.stamp} / ${e.txt}</span><span>${e.tail}</span></div>`).join('');
  (doc.getElementById('pPhoto') as HTMLButtonElement).disabled = demo.photoPending;
}

function plog(txt: string, tail: string) {
  const e = { stamp: nowStamp(), txt, tail }; demo.log.unshift(e);
  const L = document.getElementById('pLog'); if (!L) return;
  L.hidden = false; const d = document.createElement('div'); d.innerHTML = `<span>${e.stamp} / ${txt}</span><span>${tail}</span>`; L.prepend(d);
}

export const portalDemoFeature: Feature = {
  prepare(doc) { render(doc); renderLog(doc); },
  mount(signal) {
    if (!document.getElementById('pRail')) return;
    $('pApprove').addEventListener('click', () => {
      vib();
      if (demo.approved) { demo.approved = false; demo.log = []; $('pLog').innerHTML = ''; $('pLog').hidden = true; }
      else { demo.approved = true; plog('Sample 03 approved', 'Bulk released'); }
      render(document);
    }, { signal });
    $('pPhoto').addEventListener('click', () => {
      vib(); demo.photoPending = true; $<HTMLButtonElement>('pPhoto').disabled = true; plog('Photo requested', 'Pending');
      setTimeout(() => {
        demo.photoPending = false; plog('Photo received / ' + (demo.approved ? 'Production' : 'Sampling'), 'New');
        const b = document.getElementById('pPhoto') as HTMLButtonElement | null; if (b) b.disabled = false;
      }, 2000);
    }, { signal });
    render(document);
  },
};
