// How the page on screen was reached: a fresh load, a link (or navigate()), or back/forward.
// Exported as a live binding, so importers always read the current value.
export let arrival: 'load' | 'push' | 'traverse' =
  (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'back_forward' ? 'traverse' : 'load';

document.addEventListener('astro:before-preparation', (e) => {
  arrival = e.navigationType === 'traverse' ? 'traverse' : 'push';
});
