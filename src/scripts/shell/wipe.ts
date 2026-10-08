// Page transition: a ring wipe grows from the click point, the page swaps underneath, the ring
// draws, then the wipe closes to the centre. Same timings as the prototype.
import { $, rm } from '../core/util';
import { pointer } from './pointer';
import { setMenu } from './header';
import { arrival } from '../core/nav';

const w = $('wipe');
let covering = false, covered: Promise<void> = Promise.resolve(), t1 = 0, t2 = 0;

document.addEventListener('astro:before-preparation', (e) => {
  setMenu(false);
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
  const swap = e.swap;
  e.swap = () => { swap(); document.documentElement.style.scrollBehavior = 'auto'; };
});

document.addEventListener('astro:after-swap', () => {
  // A link to /page#anchor lands on the anchor, as the prototype's router did. (Back and forward
  // keep the position the browser restored.)
  const target = arrival === 'push' && location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  requestAnimationFrame(() => { target?.scrollIntoView({ behavior: 'auto' }); document.documentElement.style.scrollBehavior = ''; });
  if (!covering) return;
  covering = false;
  w.classList.add('ring');
  t1 = window.setTimeout(() => {
    w.style.setProperty('--wx', '50%'); w.style.setProperty('--wy', '50%'); w.className = 'wipe cover ring leave';
    t2 = window.setTimeout(() => { if (w.classList.contains('leave')) w.className = 'wipe'; }, 560);
  }, 300);
});
