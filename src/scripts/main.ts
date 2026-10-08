// Browser entry: loaded once, then every feature mounts on each page (see core/lifecycle.ts).
import { start } from './core/lifecycle';
import { pointerFeature } from './shell/pointer';
import { headerFeature } from './shell/header';
import './shell/wipe';
import { heroRingFeature } from './pages/hero-ring';
import { heroMarkFeature } from './pages/hero-mark';
import { howScrollFeature } from './pages/how-scroll';
import { portalDemoFeature } from './pages/portal-demo';
import { faqFeature } from './pages/faq';
import { demoOrderFeature } from './pages/demo-order';
import { makeFeature } from './pages/make';
import { requestFeature } from './pages/request';
import { trackFeature } from './pages/track';
import { contactFeature } from './pages/contact';
import { revealFeature } from './shell/reveal';
import { dotsFeature } from './shell/dots';
import { imagesFeature } from './shell/images';
import { mbarFeature } from './shell/mbar';
import { ROUTES } from '../data/site';

// Links from the single-file prototype (/#how, /#cat-denim) land on the real pages.
const old = decodeURIComponent(location.hash.slice(1));
if (location.pathname === '/' && old) {
  if (Object.hasOwn(ROUTES, old)) location.replace(ROUTES[old as keyof typeof ROUTES]);
  else if (old.startsWith('cat-')) location.replace(`${ROUTES.make}#${old}`);
}

start([
  pointerFeature,
  headerFeature,
  heroRingFeature,
  heroMarkFeature,
  howScrollFeature,
  portalDemoFeature,
  faqFeature,
  demoOrderFeature,
  makeFeature,
  requestFeature,
  trackFeature,
  contactFeature,
  revealFeature,
  dotsFeature,
  imagesFeature,
  mbarFeature,
]);
