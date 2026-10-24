import type { ImageMetadata } from 'astro';
import catDenim from '../assets/photos/cat-denim.jpg';
import catHoodies from '../assets/photos/cat-hoodies.jpg';
import catKnit from '../assets/photos/cat-knit.png';
import catOuterwear from '../assets/photos/cat-outerwear.jpg';
import catShirts from '../assets/photos/cat-shirts.jpg';
import catTees from '../assets/photos/cat-tees.jpg';
import hero from '../assets/photos/hero.jpg';
import pathScaling from '../assets/photos/path-scaling.jpg';
import pathStarting from '../assets/photos/path-starting.jpg';
import portalSample from '../assets/photos/portal-sample.jpg';
import promiseBulk from '../assets/photos/promise-bulk.jpg';
import promiseSample from '../assets/photos/promise-sample.jpg';
import stage01 from '../assets/photos/stage-01.jpg';
import stage02 from '../assets/photos/stage-02.jpg';
import stage03 from '../assets/photos/stage-03.jpg';
import stage04 from '../assets/photos/stage-04.jpg';
import stage05 from '../assets/photos/stage-05.jpg';
import stage06 from '../assets/photos/stage-06.jpg';
import stage07 from '../assets/photos/stage-07.jpg';
import stage08 from '../assets/photos/stage-08.jpg';
import heroPhone from '../assets/photos/hero-phone.jpg';
import stage01Phone from '../assets/photos/stage-01-phone.jpg';
import stage02Phone from '../assets/photos/stage-02-phone.jpg';
import stage03Phone from '../assets/photos/stage-03-phone.jpg';
import stage04Phone from '../assets/photos/stage-04-phone.jpg';
import stage05Phone from '../assets/photos/stage-05-phone.jpg';
import stage06Phone from '../assets/photos/stage-06-phone.jpg';
import stage07Phone from '../assets/photos/stage-07-phone.jpg';
import stage08Phone from '../assets/photos/stage-08-phone.jpg';

/** Photos published so far, by slot name. A slot that is not listed shows its tinted placeholder. */
export const PHOTOS: Record<string, ImageMetadata> = {
  'cat-denim': catDenim,
  'cat-hoodies': catHoodies,
  'cat-knit': catKnit,
  'cat-outerwear': catOuterwear,
  'cat-shirts': catShirts,
  'cat-tees': catTees,
  hero,
  'path-scaling': pathScaling,
  'path-starting': pathStarting,
  'portal-sample': portalSample,
  'promise-bulk': promiseBulk,
  'promise-sample': promiseSample,
  'stage-01': stage01,
  'stage-02': stage02,
  'stage-03': stage03,
  'stage-04': stage04,
  'stage-05': stage05,
  'stage-06': stage06,
  'stage-07': stage07,
  'stage-08': stage08,
};

/** Tall versions of full-width photos, shown instead on phones (Mazen, 24 Oct 2026: a wide photo cropped to a
 * phone screen loses its subject). By slot name; BgImg switches to them below its `phoneUpTo` width. */
export const PHOTOS_PHONE: Record<string, ImageMetadata> = {
  hero: heroPhone,
  'stage-01': stage01Phone,
  'stage-02': stage02Phone,
  'stage-03': stage03Phone,
  'stage-04': stage04Phone,
  'stage-05': stage05Phone,
  'stage-06': stage06Phone,
  'stage-07': stage07Phone,
  'stage-08': stage08Phone,
};

/**
 * Descriptions for the product photos (site audit B8), for screen readers and image search. Other
 * photos stay decorative. A photo inside a link that already names it (the Home category cards)
 * keeps an empty alt, so the link is not read twice.
 */
export const PHOTO_ALT: Record<string, string> = {
  'cat-denim': 'Raw and washed denim jeans laid on a workshop table',
  'cat-tees': 'A white and a black cotton T-shirt laid flat on a workshop table',
  'cat-hoodies': 'Charcoal heavyweight hoodie on a cutting table with fabric and trims',
  'cat-shirts': 'Light blue button-up shirt and olive overshirt laid flat with buttons and thread',
  'cat-outerwear': 'Khaki work jacket and black jacket on a workshop table',
  'cat-knit': 'Oatmeal knit crewneck sweater with yarn and knitting needles',
  'promise-sample': 'Approved black hoodie sample on a dress form in the cutting room, with its hang tag',
  'promise-bulk': 'Stack of folded black hoodies from the bulk run, each with the same hang tag',
  'portal-sample': 'Raw indigo jeans sample hanging on the cutting room wall, labelled with tape',
};

/** Where to keep the subject when a photo is cropped. */
export const PHOTO_FOCUS: Record<string, string> = { 'cat-knit': '30% 50%' };

/** Widths generated for every photo (capped at the original's width). */
export const PHOTO_WIDTHS = [320, 480, 640, 800, 1024, 1376, 1600];

export const photoWidths = (img: ImageMetadata) => {
  const w = PHOTO_WIDTHS.filter((x) => x < img.width);
  return [...w, Math.min(img.width, 1920)];
};
