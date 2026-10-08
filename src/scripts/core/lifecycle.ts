// Pages are swapped in place by Astro's ClientRouter, so the browser scripts load once and every
// feature sets itself up again on each page it finds.
//
// - prepare(doc) runs on the incoming page before it is swapped in. Features use it to write their
//   current state into the new page, so state carries over (as it did when the prototype was one
//   document) without replaying transitions.
// - mount(signal) runs on the live page after the swap (and once on first load). Listeners and
//   timers it adds must stop when the signal aborts, which happens when the next page swaps in.

export type Feature = {
  prepare?: (doc: Document) => void;
  mount?: (signal: AbortSignal) => void;
};

export function start(features: Feature[]) {
  let ac = new AbortController();
  const mountAll = () => {
    for (const f of features) f.mount?.(ac.signal);
  };
  document.addEventListener('astro:before-swap', (e) => {
    ac.abort();
    for (const f of features) f.prepare?.(e.newDocument);
  });
  document.addEventListener('astro:after-swap', () => {
    ac = new AbortController();
    mountAll();
  });
  mountAll();
}

/** setTimeout that is cancelled when the signal aborts. */
export const later = (signal: AbortSignal, fn: () => void, ms: number) => {
  const t = window.setTimeout(fn, ms);
  signal.addEventListener('abort', () => clearTimeout(t), { once: true });
};
