// Page transition: a ring wipe grows from the click point, the page swaps underneath, the ring
// draws, then the wipe closes to the centre. Same timings as the prototype.
import { $, decode, rm } from '../core/util';
import { pointer } from './pointer';
import { setMenu } from './header';
import { arrival } from '../core/nav';

const w = $('wipe');
let covering = false, covered: Promise<void> = Promise.resolve(), t1 = 0, t2 = 0;
let pin: AbortController | undefined;

// A smooth scroll still running on the old page would carry on into the new one. Chrome runs it off
// the main thread and takes a frame to hear it is stopped, so it is stopped as the page change starts;
// on a device so busy that no frame comes before the swap, the new page is then held at the top
// until the wipe has gone or you scroll yourself.
function holdTop() {
  pin?.abort(); const c = (pin = new AbortController()), o = { signal: c.signal, passive: true };
  addEventListener('scroll', () => { if (scrollY) scrollTo({ left: 0, top: 0, behavior: 'instant' }); }, o);
  for (const t of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(t, () => c.abort(), o);
}

document.addEventListener('astro:before-preparation', (e) => {
  setMenu(false); pin?.abort();
  scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
  if (rm) return;
  if (!covering) {
    covering = true; clearTimeout(t1); clearTimeout(t2);
    w.className = 'wipe'; w.style.setProperty('--wx', pointer.lx + 'px'); w.style.setProperty('--wy', pointer.ly + 'px');
    void w.offsetWidth; w.className = 'wipe cover';
    covered = new Promise((r) => setTimeout(r, 480));
  }
  const load = e.loader;
  e.loader = async () => { await Promise.all([load(), covered]); };
});

document.addEventListener('astro:before-swap', (e) => {
  // land on #anchors instantly under the wipe, not with the page's smooth scrolling
  const swap = e.swap, root = document.documentElement;
  e.swap = () => { root.style.scrollBehavior = 'auto'; swap(); root.style.scrollBehavior = 'auto'; };
});

document.addEventListener('astro:after-swap', () => {
  // A link to /page#anchor lands on the anchor, as the prototype's router did. (Back and forward
  // keep the position the browser restored.)
  const target = arrival === 'push' && location.hash ? document.getElementById(decode(location.hash.slice(1))) : null;
  requestAnimationFrame(() => { target?.scrollIntoView({ behavior: 'auto' }); document.documentElement.style.scrollBehavior = ''; });
  if (!covering) return;
  covering = false;
  if (arrival === 'push' && !location.hash) holdTop();
  w.classList.add('ring');
  t1 = window.setTimeout(() => {
    w.style.setProperty('--wx', '50%'); w.style.setProperty('--wy', '50%'); w.className = 'wipe cover ring leave';
    t2 = window.setTimeout(() => { pin?.abort(); if (w.classList.contains('leave')) w.className = 'wipe'; }, 560);
  }, 300);
});
