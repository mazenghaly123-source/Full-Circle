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

/** Where to keep the subject when a photo is cropped. */
export const PHOTO_FOCUS: Record<string, string> = { 'cat-knit': '30% 50%' };

/** Widths generated for every photo (capped at the original's width). */
export const PHOTO_WIDTHS = [320, 480, 640, 800, 1024, 1376, 1600];

export const photoWidths = (img: ImageMetadata) => {
  const w = PHOTO_WIDTHS.filter((x) => x < img.width);
  return [...w, Math.min(img.width, 1920)];
};
