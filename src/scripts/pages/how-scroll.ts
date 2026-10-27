// Home "How it works": the section pins and the mark draws itself arc by arc as you scroll, one arc
// per part of the work (Design, Build, Launch). When the third arc ends the arcs have closed into the
// mark ("Full circle"). The part's photo sits behind the mark and changes with it. On short screens a
// click jumps to a part instead.
import type { Feature } from '../core/lifecycle';
import { $, pad, rm } from '../core/util';
import { ARCS } from '../../data/site';
import { ARC_PAD, MARK_ARCS } from '../../data/mark';

const N = ARCS.length;

export const howScrollFeature: Feature = {
  mount(signal) {
    const steps = document.getElementById('steps');
    if (!steps) return;
    const howSec = $('h-how'), howTrack = $('howScroll'), howPin = $('howPin'), howRingEl = howSec.querySelector('.howring')!;
    const bgs = [...howPin.querySelectorAll('.hbgs .bgimg')];
    const masks = [...howRingEl.querySelectorAll<SVGCircleElement>('mask circle')];
    const howPinned = () => !!howTrack.offsetParent && getComputedStyle(howPin).position === 'sticky';
    const howRange = () => Math.max(1, howTrack.offsetHeight - howPin.offsetHeight);
    [...steps.children].forEach((li, i) => {
      li.querySelector('button')!.addEventListener('click', () => {
        if (howPinned()) scrollTo({ top: scrollY + howTrack.getBoundingClientRect().top + ((i + 0.6) / N) * howRange(), behavior: rm ? 'auto' : 'smooth' });
        else setStep(i);
      }, { signal });
    });
    let howI = -1, howDone = false;
    function label() {
      $('arcNum').textContent = howDone ? ARCS.map((_, k) => pad(k + 1)).join(' · ') : `${pad(howI + 1)} / ${pad(N)}`;
      $('arcLbl').textContent = howDone ? 'Full circle' : ARCS[howI].n;
      $('arcSub').textContent = howDone ? 'Next drop starts here' : ARCS[howI].sub;
    }
    function setStage(i: number) {
      if (i === howI) return;
      const first = howI < 0; howI = i;
      [...steps!.children].forEach((li, k) => { li.classList.toggle('on', k === i); li.querySelector('button')!.setAttribute('aria-expanded', String(k === i)); });
      bgs.forEach((b, k) => b.classList.toggle('on', k === i));
      label();
      $('howNext').textContent = i < N - 1 ? `Next / ${pad(i + 2)} ${ARCS[i + 1].n}` : `Next drop / back to 01 ${ARCS[0].n}`;
      if (!first && !rm) ['arcNum', 'arcLbl', 'arcSub'].forEach((id) => { const el = $(id); el.classList.remove('flip'); void el.getBoundingClientRect(); el.classList.add('flip'); });
    }
    function drawRing(f: number, done: boolean) {
      masks.forEach((m, k) => { m.style.strokeDasharray = `${(MARK_ARCS[k].span + ARC_PAD * 2) * Math.max(0, Math.min(1, f * N - k))} 400`; });
      if (done !== howDone) { howDone = done; howRingEl.classList.toggle('done', done); howPin.classList.toggle('done', done); if (howI >= 0) label(); }
    }
    // fallback (short screens): click a part, the mark draws up to the end of it
    function setStep(i: number) { setStage(i); drawRing((i + 1) / N, false); }
    // scroll mode: the section pins and the scroll position draws the mark
    let howT = 0, howC = 0, howRaf = 0, howMode: boolean | null = null;
    function howTick() {
      howRaf = 0;
      howC = rm ? howT : howC + (howT - howC) * 0.2;
      if (Math.abs(howT - howC) < 0.0005) howC = howT;
      setStage(Math.min(N - 1, Math.floor(howC * N)));
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
