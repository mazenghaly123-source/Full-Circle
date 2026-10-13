// Home "How it works": the section pins and the ring completes stage by stage as you scroll. At
// 100% the centre becomes the mark ("Full circle"). On short screens a click jumps the ring instead.
import type { Feature } from '../core/lifecycle';
import { $, pad, ring, rm } from '../core/util';
import { STAGES } from '../../data/site';

export const howScrollFeature: Feature = {
  mount(signal) {
    const steps = document.getElementById('steps');
    if (!steps) return;
    const ticks = $('howTicks'), howSec = $('h-how'), howTrack = $('howScroll'), howPin = $('howPin'), howRingEl = howSec.querySelector('.howring')!;
    const howPinned = () => !!howTrack.offsetParent && getComputedStyle(howPin).position === 'sticky';
    const howRange = () => Math.max(1, howTrack.offsetHeight - howPin.offsetHeight);
    [...steps.children].forEach((li, i) => {
      li.querySelector('button')!.addEventListener('click', () => {
        if (howPinned()) scrollTo({ top: scrollY + howTrack.getBoundingClientRect().top + ((i + 0.5) / 8) * howRange(), behavior: rm ? 'auto' : 'smooth' });
        else setStep(i);
      }, { signal });
    });
    let howI = -1, howDone = false;
    function setStage(i: number) {
      if (i === howI) return;
      const first = howI < 0; howI = i;
      [...steps!.children].forEach((li, k) => { li.classList.toggle('on', k === i); li.querySelector('button')!.setAttribute('aria-expanded', String(k === i)); });
      $('howNum').textContent = pad(i + 1); $('howLbl').textContent = howDone ? 'Full circle' : STAGES[i].n;
      $('howNext').textContent = i < 7 ? 'Next / ' + pad(i + 2) + ' ' + STAGES[i + 1].n : 'Next run / back to 01';
      if (!first && !rm) ['howNum', 'howLbl'].forEach((id) => { const el = $(id); el.classList.remove('flip'); void el.getBoundingClientRect(); el.classList.add('flip'); });
    }
    function drawRing(f: number, done: boolean) {
      $('howArc').style.strokeDashoffset = String(100 - f * 100);
      const [x, y] = ring(200, 200, 170, f);
      ['howDot', 'howPing'].forEach((id) => { $(id).setAttribute('cx', String(x)); $(id).setAttribute('cy', String(y)); });
      [...ticks.children].forEach((t, k) => t.classList.toggle('on', f >= k / 8 - 0.0001));
      if (done !== howDone) { howDone = done; howRingEl.classList.toggle('done', done); $('howLbl').textContent = done ? 'Full circle' : STAGES[Math.max(0, howI)].n; }
    }
    // fallback (short screens): click a stage, the ring jumps to it
    function setStep(i: number) { setStage(i); drawRing((i + 0.5) / 8, false); }
    // scroll mode: the section pins and the scroll position fills the ring
    let howT = 0, howC = 0, howRaf = 0, howMode: boolean | null = null;
    function howTick() {
      howRaf = 0;
      howC = rm ? howT : howC + (howT - howC) * 0.2;
      if (Math.abs(howT - howC) < 0.0005) howC = howT;
      setStage(Math.min(7, Math.floor(howC * 8)));
      drawRing(howC, howC > 0.997);
      if (howC !== howT) howRaf = requestAnimationFrame(howTick);
    }
    function howMeasure() {
      if (!howTrack.offsetParent) return;
      const on = howPinned();
      if (on !== howMode) { howMode = on; howSec.classList.toggle('scrolly', on); if (!on) { setStep(Math.max(0, howI)); return; } }
      if (!on) return;
      howT = Math.max(0, Math.min(1, -howTrack.getBoundingClientRect().top / howRange()));
      if (!howRaf) howRaf = requestAnimationFrame(howTick);
    }
    addEventListener('scroll', howMeasure, { passive: true, signal });
    addEventListener('resize', howMeasure, { signal });
    signal.addEventListener('abort', () => cancelAnimationFrame(howRaf), { once: true });
    setStep(0); howMeasure();
  },
};
