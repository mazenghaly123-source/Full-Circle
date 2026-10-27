// Home hero: the ring fills one part of the work at a time (Design, Build, Launch) and rests complete,
// its dot back at the top ("full circle"). It stops after one circle, as Mazen decided (site audit B5): the prototype looped.
import type { Feature } from '../core/lifecycle';
import { ring, rm } from '../core/util';
import { ARCS } from '../../data/site';

const N = ARCS.length;

// starts at the first part, as the page is rendered
let heroI = 1;

function apply(doc: Document) {
  const arc = doc.getElementById('heroArc'), dot = doc.getElementById('heroDot'), labels = doc.getElementById('heroLabels');
  if (!arc || !dot || !labels) return;
  const texts = [...labels.children];
  if (rm) {
    // reduced motion: the ring is shown drawn, with every part lit and the dot back at the top
    // (the prototype meant this, but then stepped it once, leaving only the first stage lit)
    arc.style.strokeDashoffset = '14'; texts.forEach((t) => t.classList.add('on'));
    dot.setAttribute('cx', '200'); dot.setAttribute('cy', '50');
    return;
  }
  const f = heroI / N;
  arc.style.strokeDashoffset = String(100 - f * 100);
  const [x, y] = ring(200, 200, 150, f); dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(y));
  texts.forEach((t, k) => t.classList.toggle('on', k < heroI));
}

// the ring keeps time on every page, so it is where you left it when you come back
const HERO_STEP_MS = 1500;
const timer = rm ? 0 : window.setInterval(heroStep, HERO_STEP_MS);
function heroStep() { heroI = Math.min(N, heroI + 1); apply(document); if (heroI === N) clearInterval(timer); }

export const heroRingFeature: Feature = {
  prepare: apply,
  mount() { if (rm) apply(document); },
};
