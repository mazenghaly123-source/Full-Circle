import type { OptionOf } from '../../supabase/functions/_shared/forms';

// Site content, copied from prototype/index.html. Pages render it at build time; the browser
// scripts import the same data, so there is one copy of every stage, category and question.

/** A WhatsApp chat with Full Circle, opened with a message ready to send. */
export const whatsappLink = (text: string) => `https://wa.me/201011435406?text=${encodeURIComponent(text)}`;
export const WHATSAPP_URL = whatsappLink('Hi Full Circle, I found you through your website.');
export const WHATSAPP = '+20 101 143 5406';
export const PHONE = '+20 2 2698 7277';
export const PHONE_URL = 'tel:+20226987277';
export const EMAIL = 'fullcircleworks.co@gmail.com';
export const INSTAGRAM = '@fullcircle_eg';
export const INSTAGRAM_URL = 'https://www.instagram.com/fullcircle_eg/';

export type PageKey = 'home' | 'how' | 'make' | 'about' | 'start' | 'track' | 'contact' | 'privacy' | 'notfound';

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

/** Who Full Circle is, said once for the Home structured data, llms.txt and ai.txt. */
export const SITE = {
  name: 'Full Circle',
  description: 'Fashion development and manufacturing for brands that are starting or scaling.',
  /** Who Full Circle is in a few sentences, for agents and search (llms.txt, ai.txt, the Organization). */
  summary: 'Full Circle is a clothing development and manufacturing partner in Cairo, Egypt, for brands that are starting or scaling. One team takes a product through eight stages, from research and design support to sampling, bulk production, QC and delivery. What the brand approves in sampling is what ships, and every order can be followed on a tracking page.',
  address: { street: 'Gisr El Suez', city: 'Cairo', country: 'EG' },
  hours: 'Sunday – Thursday, 9:00 – 17:00',
};

/** Paths kept out of search and AI crawlers: robots.txt disallows them and ai.txt excludes them. */
export const PRIVATE_PATHS = ['/admin'];

/**
 * Each page's search title and description, and, for the main pages, a summary written for AI
 * agents (the `ai-summary` tag; elsewhere the description stands in).
 */
export const PAGES: Record<PageKey, { title: string; description: string; summary?: string }> = {
  home: {
    title: 'Full Circle / Clothing manufacturer in Cairo, Egypt',
    description: 'Design, patterns, fabric, samples and bulk production under one roof in Cairo, for clothing brands starting or scaling. From 60 pieces per colour.',
    summary: 'Home page of Full Circle, a clothing development and manufacturing partner in Cairo, Egypt: what it makes and from how many pieces, its eight stages from research to delivery, the client tracking page, and answers to common questions.',
  },
  how: {
    title: 'How it works / From idea to bulk / Full Circle',
    description: 'Eight stages, one partner. Every stage ends with something you can see and a decision you make. Follow a demo order from research to delivery.',
    summary: 'Full Circle’s eight stages (research, design support, sourcing, development, sampling, production, QC, delivery), with what the client receives and approves at each, shown as a demo order.',
  },
  make: {
    title: 'Denim, tees, hoodies and more, made in Cairo / Full Circle',
    description: 'Denim, tees, hoodies, shirts, jackets and knitwear, developed and made in Cairo. Minimums from 60 pieces per colour; samples in 7 to 25 days.',
    summary: 'The six clothing categories Full Circle makes in Cairo (denim, tees and tops, hoodies and sweats, shirts and tailoring, jackets, knitwear), with minimum orders and sampling times.',
  },
  about: {
    title: 'About / Clothing development partner in Cairo / Full Circle',
    description: 'A development and manufacturing partner for clothing brands, based in Cairo. One team holds the whole chain, from first sketch to delivered bulk.',
  },
  start: {
    title: 'Request a clothing sample / Full Circle',
    description: 'Four quick picks and your contact. Full Circle replies with a first call, a price range and the next decision. No commitment.',
  },
  track: {
    title: 'Track order / Full Circle',
    description: 'Sign in with the email or WhatsApp number on your order to see every order, its stage, the next decision, photos and the full approval log.',
  },
  contact: {
    title: 'Contact / Clothing manufacturer in Cairo / Full Circle',
    description: 'WhatsApp is the fastest way to reach Full Circle in Cairo. Phone, email and Instagram are here too. To start production, request a sample.',
  },
  privacy: {
    title: 'Privacy notice / Full Circle',
    description: 'What Full Circle collects when you request a sample, send a message or follow an order, why, where it is kept, and what you can ask for.',
  },
  notfound: { title: 'Not found / Full Circle', description: 'This page does not exist.' },
};

export type Stage = {
  n: string; s: string; line: string; get: string; ok: string; tone: string;
  /** Typical time for the stage, where it is known (How it works shows it only then). */
  time?: string;
  /** How it works words some of these its own way, as the prototype did. */
  demo?: { get?: string; ok?: string };
};

export const STAGES: Stage[] = [
  { n: 'Research', s: 'Research', line: 'We study the brand, the customer and the market the product is going into.', get: 'Brief, category, target price', ok: 'The brief', tone: '#6b5644' },
  { n: 'Design support', s: 'Design', line: 'Sketches become technical drawings with measurements, trims and construction notes.', get: 'Tech pack', ok: 'Tech pack sign-off', tone: '#8a7f6c' },
  { n: 'Sourcing', s: 'Source', line: 'Fabric and trims are sourced against the brief, with swatches sent to you.', get: 'Swatches and trim cards', ok: 'Fabric selection', tone: '#3d3d38', demo: { get: 'Swatches + trim cards' } },
  { n: 'Development', s: 'Develop', line: 'Patterns are cut and graded, and construction questions are answered.', get: 'Base-size pattern, fit notes', ok: 'Pattern sign-off', tone: '#7a6450', demo: { get: 'Base-size pattern + fit notes' } },
  { n: 'Sampling', s: 'Sample', line: 'Samples are made, fitted and revised until you sign one off. The signed sample becomes the reference for bulk.', get: 'A physical sample', ok: 'Sample approval', tone: '#3b4f7a', time: '7–25 days, denim longest', demo: { get: 'A physical sample, fitted' } },
  { n: 'Production', s: 'Produce', line: 'Bulk runs against the approved sample, checked along the line.', get: 'Progress at each checkpoint', ok: 'Quantity and delivery date', tone: '#55554d', demo: { ok: 'Quantity + delivery date' } },
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
  ['Do I need a tech pack to start?', 'No. Bring a sketch, a reference garment or a mood board. We turn it into a tech pack.'],
  ['What is the minimum order?', 'From 60 pieces per colour for most products, and 150 per colour for denim. Knitwear is quoted per order.'],
  ['Who owns my designs and patterns?', 'You do. Your patterns and tech packs are never reused for anyone else.'],
  ['How long does a sample take?', 'Between 7 and 25 days. Cotton is the fastest, denim takes the longest.'],
  ['Do you work with brands outside Egypt?', 'Yes. We work with brands in the Gulf and the Middle East, Turkey and China, and you follow every stage on the tracking page.'],
  ['Can I visit the floor?', 'Yes. Book a visit when we schedule your first call.'],
];

// The request form's questions and its minimum-order rule live with the functions that receive the
// form (supabase/functions/_shared/forms.ts), so the site and the server check the same options.
export { REQUEST_QUESTIONS, belowMinimum, type RequestKey } from '../../supabase/functions/_shared/forms';
type ProductOption = OptionOf<'product'>;

/** The products in the How it works demo (the first is picked to begin with), and the sample request's name for each. */
export const DEMO_PRODUCTS = [
  { label: 'Shirts', product: 'Shirts' },
  { label: 'Hoodies', product: 'Hoodies' },
  { label: 'Tees', product: 'Tees' },
  { label: 'Denim', product: 'Denim' },
  // the request form calls outerwear "Jackets" (the prototype passed "Outerwear", which matched no option)
  { label: 'Outerwear', product: 'Jackets' },
] as const satisfies readonly { label: string; product: ProductOption }[];

export const pad = (n: number) => String(n).padStart(2, '0');

/** A category's sampling time as the short line on Home ("Samples from 7 days"): drops any note in brackets. */
export const sampleLine = (samp: string) => { const s = samp.replace(/ \(.*\)$/, ''); return `Samples ${s.charAt(0).toLowerCase()}${s.slice(1)}`; };

/** A point on a circle, starting at 12 o'clock and running clockwise (f = 0..1). */
export const ring = (cx: number, cy: number, r: number, f: number): [number, number] => {
  const a = (f * 360 - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
