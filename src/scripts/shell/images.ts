// Photos fade in once loaded. A photo already seen in this session is shown straight away when its
// page comes back, as in the prototype. If a photo fails, its slot keeps the tinted placeholder.
import type { Feature } from '../core/lifecycle';

const loaded = new Set<string>();
const key = (img: HTMLImageElement) => img.getAttribute('src') || '';
export const isLoaded = (src: string) => loaded.has(src);

const photoCaption = (img: HTMLImageElement, hidden: boolean) =>
  img.closest('[data-img]')?.querySelectorAll<HTMLElement>('.cap span').forEach((t) => { if (t.textContent?.trim() === 'Photo') t.hidden = hidden; });

export function bindPhoto(img: HTMLImageElement) {
  const done = () => { img.classList.add('ok'); loaded.add(key(img)); photoCaption(img, true); };
  if (img.complete && img.naturalWidth) { done(); return; }
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', () => { photoCaption(img, false); (img.closest('picture') ?? img).remove(); }, { once: true });
}

export const imagesFeature: Feature = {
  prepare(doc) {
    doc.querySelectorAll<HTMLImageElement>('[data-img] img').forEach((img) => { if (loaded.has(key(img))) { img.classList.add('ok'); photoCaption(img, true); } });
  },
  mount() {
    document.querySelectorAll<HTMLImageElement>('[data-img] img').forEach(bindPhoto);
  },
};
