// Visit counting with Google Analytics, only after the visitor accepts it in the consent bar
// (src/data/analytics.ts). Until then nothing is loaded from Google and no cookie is set; declining,
// or withdrawing on /privacy, stops it and removes its cookies. The choice is kept in this browser.
// Pages are swapped by the ClientRouter, so each page view is sent on mount rather than by gtag.
import type { Feature } from '../core/lifecycle';
import { $, page } from '../core/util';
import { ANALYTICS } from '../../data/analytics';

type Choice = 'granted' | 'denied';
const KEY = 'fc-analytics';

declare global {
  interface Window { dataLayer: unknown[]; gtag: (...args: unknown[]) => void }
}

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode: asked again next visit */ } },
};

/** On the live domain; the browser tests turn it on elsewhere with a flag of their own. */
const enabled = ANALYTICS.hosts.includes(location.hostname) || store.get('fc-analytics-anyhost') === '1';
const choice = () => { const v = store.get(KEY); return v === 'granted' || v === 'denied' ? (v as Choice) : null; };

/** Query parameters a page view keeps: ad tags and the site's own links' picks; anything else (a crafted ?phone=…) and the #part are dropped. */
const KEPT = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'path', 'product'];
const pageLocation = () => {
  const url = new URL(location.href);
  for (const k of [...url.searchParams.keys()]) if (!KEPT.includes(k)) url.searchParams.delete(k);
  url.hash = '';
  return url.href;
};

let loaded = false;
function load() {
  (window as unknown as Record<string, unknown>)[`ga-disable-${ANALYTICS.id}`] = false;
  if (loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  // gtag reads the arguments object itself, as Google's snippet passes it
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  // the address goes in with set, not config: a value given to config would outrank every later set
  window.gtag('set', { page_location: pageLocation() });
  window.gtag('config', ANALYTICS.id, { send_page_view: false, cookie_flags: 'SameSite=Lax;Secure' });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS.id}`;
  document.head.append(s);
}

/** Stops counting and removes Google Analytics' cookies (_ga, _ga_<id>) from this site. */
function stop() {
  (window as unknown as Record<string, unknown>)[`ga-disable-${ANALYTICS.id}`] = true;
  const domain = location.hostname.replace(/^www\./, '');
  for (const name of document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => n === '_ga' || n.startsWith('_ga_')))
    for (const d of ['', `; domain=${domain}`, `; domain=.${domain}`]) document.cookie = `${name}=; max-age=0; path=/${d}`;
}

/** Sends an event when the visitor has accepted; does nothing otherwise. */
export function track(event: string, params: Record<string, string | number> = {}) {
  if (loaded && choice() === 'granted') window.gtag('event', event, params);
}

// Every event GA sends on its own (a WhatsApp click, enhanced measurement) carries the page's address
// too, so the filtered one is set for the page as well as sent with its view. The portal is never
// tracked (docs/production-plan.md §6); the admin has a layout of its own, without this script.
const pageView = () => {
  if (!loaded || choice() !== 'granted') return;
  window.gtag('set', { page_location: pageLocation() });
  if (page() !== 'track') track('page_view', { page_location: pageLocation(), page_title: document.title });
};

/** Shows the consent bar again (the button on /privacy). */
export function askAgain() {
  if (enabled) $('consent').hidden = false;
}

function decide(c: Choice) {
  store.set(KEY, c);
  $('consent').hidden = true;
  if (c === 'granted') { load(); pageView(); } else stop();
}

if (enabled) {
  if (choice() === 'granted') load();
  else if (!choice()) $('consent').hidden = false;
  $('consent').addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-consent]');
    if (b) decide(b.dataset.consent as Choice);
  });
  // the WhatsApp links, on every page (header, phone bar, contact, the sent request)
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="https://wa.me/"]');
    if (a) track('whatsapp_click', { page: location.pathname });
  });
}

export const analyticsFeature: Feature = {
  mount(signal) {
    pageView();
    document.getElementById('cookieSettings')?.addEventListener('click', askAgain, { signal });
  },
};
