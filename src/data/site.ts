// Site content, copied from prototype/index.html. Pages render it at build time; the browser
// scripts import the same data, so there is one copy of every stage, category and question.

export const WHATSAPP_URL =
  'https://wa.me/201011435406?text=Hi%20Full%20Circle%2C%20I%20found%20you%20through%20your%20website.';
export const WHATSAPP = '+20 101 143 5406';
export const PHONE = '+20 2 2698 7277';
export const PHONE_URL = 'tel:+20226987277';
export const EMAIL = 'fullcircleworks.co@gmail.com';
export const INSTAGRAM = '@fullcircle_eg';
export const INSTAGRAM_URL = 'https://www.instagram.com/fullcircle_eg/';

export type PageKey = 'home' | 'how' | 'make' | 'about' | 'start' | 'track' | 'contact' | 'notfound';

/** Real URLs for the prototype's hash pages (#how → /how-it-works). */
export const ROUTES = {
  home: '/',
  how: '/how-it-works',
  make: '/what-we-make',
  about: '/about',
  start: '/request-a-sample',
  track: '/track',
  contact: '/contact',
} as const;

export type Stage = { n: string; s: string; line: string; get: string; ok: string; tone: string };

export const STAGES: Stage[] = [
  { n: 'Research', s: 'Research', line: 'We study the brand, the customer and the market the product is going into.', get: 'Brief, category, target price', ok: 'The brief', tone: '#6b5644' },
  { n: 'Design support', s: 'Design', line: 'Sketches become technical drawings with measurements, trims and construction notes.', get: 'Tech pack', ok: 'Tech pack sign-off', tone: '#8a7f6c' },
  { n: 'Sourcing', s: 'Source', line: 'Fabric and trims are sourced against the brief, with swatches sent to you.', get: 'Swatches and trim cards', ok: 'Fabric selection', tone: '#3d3d38' },
  { n: 'Development', s: 'Develop', line: 'Patterns are cut and graded, and construction questions are answered.', get: 'Base-size pattern, fit notes', ok: 'Pattern sign-off', tone: '#7a6450' },
  { n: 'Sampling', s: 'Sample', line: 'Samples are made, fitted and revised until you sign one off. The signed sample becomes the reference for bulk.', get: 'A physical sample', ok: 'Sample approval', tone: '#3b4f7a' },
  { n: 'Production', s: 'Produce', line: 'Bulk runs against the approved sample, checked along the line.', get: 'Progress at each checkpoint', ok: 'Quantity and delivery date', tone: '#55554d' },
  { n: 'QC', s: 'QC', line: 'Measurements, seams, colour, labels and packing count are inspected before anything is packed.', get: 'Inspection record', ok: 'QC result', tone: '#5b4a3c' },
  { n: 'Delivery', s: 'Deliver', line: 'Finished goods are packed, documented and shipped to you.', get: 'Goods and documents', ok: 'Receipt, next run', tone: '#7a5a44' },
];

export type Category = {
  id: string; n: string; sub: string; line: string; items: string;
  /** HTML: one line per garment, separated by <br> */
  moq: string;
  samp: string; tone: string;
  /** The product name this category maps to in the sample request. */
  product: string;
};

export const MAKE: Category[] = [
  { id: 'denim', n: 'Denim', sub: 'From 150 pcs / colour', line: 'Our speciality. Jeans and denim jackets, from pattern to wash, in denims we import that you will not find in the local market.', items: 'Jeans, denim jackets', moq: 'Jeans: 150 / colour<br>Denim jackets: 150', samp: 'Up to 25 days (denim takes longest)', tone: 'radial-gradient(70% 60% at 50% 40%,#3b4f7a,#1d2638 72%)', product: 'Denim' },
  { id: 'tees', n: 'Tees + tops', sub: 'From 60 pcs / colour', line: 'Everyday jersey with a clean neckline and a hand that survives the wash.', items: 'T-shirts, tops', moq: 'T-shirts: 60 / colour<br>Tops: 60–100', samp: 'From 7 days', tone: 'radial-gradient(70% 60% at 40% 35%,#9c917f,#3a352e 72%)', product: 'Tees' },
  { id: 'hoodies', n: 'Hoodies + sweats', sub: 'From 60 pcs', line: 'Heavyweight fleece cut to hold its shape, plus the pieces that go with it.', items: 'Hoodies, sweatpants, shorts', moq: 'Hoodies: 60<br>Sweatpants: 60<br>Shorts: 60', samp: 'From 7 days', tone: 'radial-gradient(70% 60% at 50% 40%,#55554d,#1e1e1b 72%)', product: 'Hoodies' },
  { id: 'shirts', n: 'Shirts + tailoring', sub: 'From 80 pcs', line: 'Wovens with proper collars, plackets and cuffs, and trousers cut to a pattern.', items: 'Shirts, tailored pants', moq: 'Shirts: 80–100<br>Tailored pants: 100', samp: 'From 7 days', tone: 'radial-gradient(70% 60% at 40% 40%,#7b7c66,#2c2c24 72%)', product: 'Shirts' },
  { id: 'outerwear', n: 'Jackets', sub: 'From 100 pcs', line: 'Light layers built for repeat wear, lined or unlined.', items: 'Jackets, work jackets, coach jackets', moq: 'Jackets: 100', samp: '7–25 days', tone: 'radial-gradient(70% 60% at 45% 35%,#7a5a44,#2b2119 72%)', product: 'Jackets' },
  { id: 'knit', n: 'Knitwear', sub: 'By order', line: 'Knitted pieces are quoted per order: yarn, gauge and quantity decide the minimum.', items: 'Knitted tops and sweaters', moq: 'By order', samp: 'Quoted per order', tone: 'radial-gradient(70% 60% at 50% 40%,#6b6656,#24221d 72%)', product: 'Knitwear' },
];

export const FAQ: [string, string][] = [
  ['Do I need a tech pack to start?', 'No. Bring a sketch, a reference garment or a mood board. Design support turns it into a tech pack before anything is cut.'],
  ['What is the minimum order?', 'From 60 pieces per colour for tees, hoodies, sweatpants and shorts. Shirts start at 80 to 100, tailored pants and jackets at 100, and denim at 150 per colour. Knitwear is quoted per order.'],
  ['How much does a sample cost?', 'Sample pricing depends on the garment and how much development it needs. You get the price before we start.'],
  ['Who owns my designs and patterns?', 'You do. Patterns and tech packs made for your brand are yours and are never reused for anyone else.'],
  ['How long does a sample take?', 'Between 7 and 25 days. Cotton pieces are the fastest, denim takes the longest. You get the bulk timeline with the quote, and the tracking page shows where your order stands.'],
  ['Do you work with brands outside Egypt?', 'Yes. We sell to brands in the Gulf and the Middle East, Turkey and China. Samples, approvals and photos all run through the tracking page, so you can follow every stage from wherever you are.'],
  ['Can I visit the floor?', 'Yes. Book a visit when we schedule your first call.'],
];

/** Sample request picks, in the order the form asks for them. */
export const REQUEST_QUESTIONS = [
  { k: 'path', label: '01 / The brand is', hint: 'Pick one', summary: 'Brand', options: ['Starting', 'Scaling'] },
  { k: 'product', label: '02 / Product', hint: 'Pick one', summary: 'Product', options: ['Denim', 'Tees', 'Hoodies', 'Shirts', 'Jackets', 'Knitwear', 'Other'] },
  { k: 'qty', label: '03 / Pieces per style', hint: 'Estimate', summary: 'Pieces per style', options: ['Under 60', '60–150', '150–500', '500+'] },
  { k: 'have', label: '04 / You have', hint: 'Pick one', summary: 'You have', options: ['An idea', 'A sketch', 'A tech pack', 'A garment'] },
] as const;

export type RequestKey = (typeof REQUEST_QUESTIONS)[number]['k'];

export const pad = (n: number) => String(n).padStart(2, '0');

/** A point on a circle, starting at 12 o'clock and running clockwise (f = 0..1). */
export const ring = (cx: number, cy: number, r: number, f: number): [number, number] => {
  const a = (f * 360 - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
