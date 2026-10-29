// How it works: the garment in the middle of the demo ring. It is the product picked (a shirt, a
// hoodie, a tee, jeans or a jacket), and it turns toward the pointer; on phones a sideways drag turns
// it and it stays where the finger leaves it (29 Oct 2026). The shapes are in data/garments.ts.
import type { Feature } from '../core/lifecycle';
import { rm } from '../core/util';
import { REACH, REST, figurePaths, figureSvg, garmentKey, type GarmentKey } from '../../data/garments';

/** Draws the garment for a product into a page (the live one or one coming in), if it is not there yet. */
export function setGarment(doc: Document, product: string) {
  const fig = doc.getElementById('yoFig');
  const key = garmentKey(product);
  if (!fig || fig.dataset.g === key) return;
  fig.dataset.g = key;
  fig.innerHTML = figureSvg(key, REST);
}

// a spring per angle: the pointer's place is a continuous target (k 100, c 18, m 1)
type Spring = { x: number; v: number; t: number };
const spring = (x: number): Spring => ({ x, v: 0, t: x });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const garmentFeature: Feature = {
  mount(signal) {
    const inst = document.querySelector<HTMLElement>('.yo-inst'), fig = document.getElementById('yoFig');
    if (!inst || !fig) return;
    const yaw = spring(REST.yaw), pitch = spring(REST.pitch);
    let paths = [...fig.querySelectorAll('[data-d]')];
    let raf = 0, last = 0, drawn = '';

    const draw = () => {
      const key = fig.dataset.g as GarmentKey, at = `${key} ${yaw.x.toFixed(4)} ${pitch.x.toFixed(4)}`;
      if (at === drawn) return;
      drawn = at;
      figurePaths(key, { yaw: yaw.x, pitch: pitch.x }).forEach((d, i) => paths[i]?.setAttribute('d', d));
    };
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000); last = now;
      let moving = false;
      for (const s of [yaw, pitch]) {
        s.v += (-100 * (s.x - s.t) - 18 * s.v) * dt; s.x += s.v * dt;
        if (Math.abs(s.x - s.t) < 1e-4 && Math.abs(s.v) < 1e-3) { s.x = s.t; s.v = 0; } else moving = true;
      }
      draw();
      raf = moving ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => {
      if (rm) { yaw.x = yaw.t; pitch.x = pitch.t; yaw.v = pitch.v = 0; draw(); return; }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    signal.addEventListener('abort', () => cancelAnimationFrame(raf), { once: true });

    // a new product: the figure is redrawn at rest, then swings in from a quarter turn
    const swap = new MutationObserver(() => {
      paths = [...fig.querySelectorAll('[data-d]')]; drawn = '';
      if (!rm) { yaw.x = yaw.t + 1.1; yaw.v = 0; }
      draw(); wake();
    });
    swap.observe(fig, { childList: true });
    signal.addEventListener('abort', () => swap.disconnect(), { once: true });

    let drag: { x: number; yaw: number } | null = null;
    inst.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        if (!drag) return;
        yaw.t = clamp(drag.yaw + (e.clientX - drag.x) * 0.012, REST.yaw - REACH.yaw * 1.6, REST.yaw + REACH.yaw * 1.6);
      } else {
        const r = inst.getBoundingClientRect();
        yaw.t = REST.yaw + clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1) * REACH.yaw;
        pitch.t = REST.pitch + clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1) * REACH.pitch;
      }
      wake();
    }, { signal });
    inst.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') drag = { x: e.clientX, yaw: yaw.t }; }, { signal });
    for (const ev of ['pointerup', 'pointercancel'] as const) inst.addEventListener(ev, () => { drag = null; }, { signal });
    inst.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'touch') return; // a finger's turn stays where it was left
      yaw.t = REST.yaw; pitch.t = REST.pitch; wake();
    }, { signal });
  },
};
