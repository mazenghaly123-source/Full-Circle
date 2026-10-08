// How the page on screen was reached inside the site: a fresh document load (including a browser
// Back that reloads the page; memory is empty then), a link or navigate(), or back/forward between
// pages already swapped in. Exported as a live binding, so importers always read the current value.
export let arrival: 'load' | 'push' | 'traverse' = 'load';

document.addEventListener('astro:before-preparation', (e) => {
  arrival = e.navigationType === 'traverse' ? 'traverse' : 'push';
});
