// Custom cursor ring (desktop), and the atmospheric lights leaning toward the pointer on top of
// their CSS drift. Also remembers the last click, where the next page wipe starts from.
import type { Feature } from '../core/lifecycle';
import { $, fine, rm } from '../core/util';

export const pointer = { mx: innerWidth * 0.6, my: innerHeight * 0.5, lx: innerWidth / 2, ly: innerHeight / 2 };
let rx = pointer.mx, ry = pointer.my, hot = false;

addEventListener('pointermove', (e) => {
  pointer.mx = e.clientX; pointer.my = e.clientY;
  const t = e.target as Element | null;
  hot = !!(t && t.closest && t.closest('a,button,input,textarea,summary,label,.cat,.mark3,.ph'));
}, { passive: true });
document.addEventListener('click', (e) => { pointer.lx = e.clientX || innerWidth / 2; pointer.ly = e.clientY || innerHeight / 2; }, true);

const cursorOn = fine && !rm, cR = $('cRing'), cD = $('cDot');
document.addEventListener('mouseleave', () => { cR.style.opacity = cD.style.opacity = '0'; });
document.addEventListener('mouseenter', () => { cR.style.opacity = cD.style.opacity = '1'; });

let lights: { el: HTMLElement; x: number; y: number }[] = [];

function frame() {
  requestAnimationFrame(frame);
  const vh = innerHeight;
  if (cursorOn) {
    rx += (pointer.mx - rx) * 0.2; ry += (pointer.my - ry) * 0.2;
    const sz = hot ? 64 : 34;
    cR.style.width = cR.style.height = sz + 'px';
    cR.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    cD.style.transform = `translate(${pointer.mx}px,${pointer.my}px) translate(-50%,-50%)`;
  }
  if (rm) return;
  lights.forEach((L) => {
    const sec = L.el.parentElement; if (!sec || !sec.offsetParent) return;
    const r = sec.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
    const tx = fine ? ((pointer.mx - (r.left + r.width / 2)) / r.width) * 90 : 0, ty = fine ? ((pointer.my - (r.top + r.height / 2)) / r.height) * 70 : 0;
    L.x += (tx - L.x) * 0.04; L.y += (ty - L.y) * 0.04; L.el.style.translate = `${L.x.toFixed(1)}px ${L.y.toFixed(1)}px`;
  });
}
requestAnimationFrame(frame);

export const pointerFeature: Feature = {
  mount() {
    if (cursorOn) { cR.hidden = cD.hidden = false; document.body.classList.add('cursor-on'); }
    lights = [...document.querySelectorAll<HTMLElement>('.light')].map((el) => ({ el, x: 0, y: 0 }));
  },
};
