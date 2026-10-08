// Home hero: the stage ring fills one stage at a time, then starts again.
import type { Feature } from '../core/lifecycle';
import { ring, rm } from '../core/util';

// starts at stage 1, as the page is rendered (the prototype stepped to 1 before the first paint)
let heroI = 1;

function apply(doc: Document) {
  const arc = doc.getElementById('heroArc'), dot = doc.getElementById('heroDot'), labels = doc.getElementById('heroLabels');
  if (!arc || !dot || !labels) return;
  const texts = [...labels.children];
  if (rm) {
    // reduced motion: the ring is shown drawn, with every stage lit (the prototype meant this,
    // but then stepped it once, leaving only the first stage lit)
    arc.style.strokeDashoffset = '14'; texts.forEach((t) => t.classList.add('on'));
    return;
  }
  const f = heroI / 8;
  arc.style.strokeDashoffset = String(100 - f * 100);
  const [x, y] = ring(200, 200, 150, f); dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(y));
  texts.forEach((t, k) => t.classList.toggle('on', k < heroI));
}

function heroStep() { heroI = (heroI + 1) % 9; apply(document); }

// the ring keeps time on every page, so it is where you left it when you come back
if (!rm) setInterval(heroStep, 1100);

export const heroRingFeature: Feature = {
  prepare: apply,
  mount() { if (rm) apply(document); },
};
