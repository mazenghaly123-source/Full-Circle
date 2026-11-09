import type { AlsoOption, OptionOf } from '../../supabase/functions/_shared/forms';
import type { GarmentKey } from './garments';
import type { IconName } from './icons';

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

export type PageKey = 'home' | 'how' | 'make' | 'about' | 'start' | 'track' | 'contact' | 'book' | 'privacy' | 'notfound' | LandingKey;

/** The search pages (Mazen, 9 Nov 2026): one per search a brand makes, built from LANDINGS below. */
export type LandingKey = 'egypt' | 'jeans' | 'privatelabel' | 'hoodies';

/** Real URLs for the prototype's hash pages (#how → /how-it-works). */
export const ROUTES = {
  home: '/',
  how: '/how-it-works',
  make: '/what-we-make',
  about: '/about',
  start: '/request-a-sample',
  track: '/track',
  contact: '/contact',
  book: '/book-a-call',
} as const;

/** What Full Circle is, in one plain line under the headline (Mazen, 9 Nov 2026): Home, What we make, About. */
export const PLAIN_LINE = 'Clothing development and manufacturing in Cairo, from design to delivery.';

/** Who Full Circle is, said once for the structured data (structured-data.ts), llms.txt and ai.txt. */
export const SITE = {
  name: 'Full Circle',
  description: 'Clothing development and manufacturing in Cairo, for brands that are starting or scaling.',
  /** Who Full Circle is in a few sentences, for agents and search (llms.txt, ai.txt, the Organization). */
  summary: 'Full Circle is a clothing development and manufacturing partner in Cairo, Egypt, for brands that are starting or scaling. One team takes a brand full circle in three parts: design (brand identity, product design, tech packs), build (fabric, patterns, sampling, bulk production and QC) and launch (delivery, product photos, ad creatives). What the brand approves in sampling is what ships, and every order can be followed on a tracking page.',
  address: { street: 'Gisr El Suez', city: 'Cairo', country: 'EG' },
  hours: 'Sunday – Thursday, 9:00 – 17:00',
  /** The same hours for machines (schema.org openingHoursSpecification), Cairo time. */
  open: { days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'], opens: '09:00', closes: '17:00' },
};

/**
 * Booking a call (Mazen, 8 Nov 2026): in person at the floor, a phone call or an online meeting, 30 minutes
 * in working hours. `url` is the kind's Cal.com booking page (9 Nov 2026); a kind without one opens WhatsApp
 * with the request ready to send.
 */
export const BOOKING = [
  { kind: 'visit', n: 'At the floor', icon: 'pin', line: 'Come to Gisr El Suez, Cairo. See the cutting room, the fabrics and real samples.', go: 'Book a visit', url: 'https://cal.com/full-circle-vthrwq/visit', ask: 'a visit to the floor' },
  { kind: 'phone', n: 'Phone call', icon: 'phone', line: 'We call you at the time you pick.', go: 'Book a call', url: 'https://cal.com/full-circle-vthrwq/phone', ask: 'a phone call' },
  { kind: 'online', n: 'Online meeting', icon: 'video', line: 'A video call, wherever you are. The link comes with your booking.', go: 'Book a meeting', url: 'https://cal.com/full-circle-vthrwq/online', ask: 'an online meeting' },
] as const;
export const BOOKING_LENGTH = '30 minutes';

/** Where a booking button goes: the kind's calendar, or WhatsApp with the request ready. */
export const bookingHref = (b: (typeof BOOKING)[number]) => b.url || whatsappLink(`Hi Full Circle, I'd like to book ${b.ask} (${BOOKING_LENGTH}). My brand: `);

/** Paths kept out of search and AI crawlers: robots.txt disallows them and ai.txt excludes them. */
export const PRIVATE_PATHS = ['/admin'];

/**
 * Each page's search title and description, and, for the main pages, a summary written for AI
 * agents (the `ai-summary` tag; elsewhere the description stands in).
 */
export const PAGES: Record<PageKey, { title: string; description: string; summary?: string; /** kept out of search (the portal's sign-in) */ noindex?: boolean }> = {
  home: {
    title: 'Full Circle / Clothing manufacturer in Cairo, Egypt',
    description: 'Branding, design, denim and bulk production in Cairo, then product photos and ads, for clothing brands starting or scaling. From 60 pieces per colour.',
    summary: 'Home page of Full Circle, a clothing development and manufacturing partner in Cairo, Egypt: what it makes and from how many pieces, how it works in three parts (design, build, launch), the client tracking page, and answers to common questions.',
  },
  how: {
    title: 'How it works / Design, build, launch / Full Circle',
    description: 'One partner for the whole circle: design, build, launch. Follow a demo order from brand identity to product photos, with the sample gate in the middle.',
    summary: 'How Full Circle works, in three parts: design (brand identity, product design, tech pack), build (fabric and trims, patterns, sample, production, QC) and launch (delivery, product photos, ad creatives), with what the client receives and approves at each step, shown as a demo order.',
  },
  make: {
    title: 'Denim, tees, hoodies and more, made in Cairo / Full Circle',
    description: 'Denim, tees, hoodies, jackets, shirts and knitwear, made in Cairo with imported fabrics and trims. From 60 pieces per colour; samples in 7 to 25 days.',
    summary: 'The six clothing categories Full Circle makes in Cairo (denim, tees and tops, hoodies and sweats, shirts and tailoring, jackets, knitwear), with minimum orders and sampling times.',
  },
  about: {
    title: 'About / Clothing development partner in Cairo / Full Circle',
    description: 'A development and manufacturing partner for clothing brands, based in Cairo. One team holds the whole chain, from the first sketch to the launch.',
  },
  start: {
    title: 'Request a clothing sample in Cairo / Full Circle',
    description: 'Four quick picks and your contact. Full Circle replies with a first call, a price range and the next decision. From 60 pieces, no commitment.',
  },
  track: {
    title: 'Track your order / Full Circle',
    description: 'Sign in with the email or WhatsApp number on your order to see every order, its stage, the next decision, photos and the full approval log.',
    noindex: true,
  },
  contact: {
    title: 'Contact Full Circle / WhatsApp, phone, email / Cairo',
    description: 'WhatsApp is the fastest way to reach Full Circle in Cairo. Phone, email and Instagram are here too. To start production, request a sample.',
  },
  book: {
    title: 'Book a call / In person, phone or online / Full Circle',
    description: 'Book 30 minutes with Full Circle: at our floor in Cairo, a phone call or an online meeting. The first call is free, with no commitment.',
  },
  privacy: {
    title: 'Privacy notice / Full Circle',
    description: 'What Full Circle collects when you request a sample, send a message or follow an order, why, where it is kept, and what you can ask for.',
  },
  notfound: { title: 'Not found / Full Circle', description: 'This page does not exist.' },
  egypt: {
    title: 'Clothing manufacturer in Egypt / Cairo factory / Full Circle',
    description: 'A clothing manufacturer in Cairo for brands starting or scaling: denim, hoodies, tees, jackets and more. From 60 pieces per colour, samples in 7 to 25 days.',
    summary: 'Full Circle as a clothing manufacturer in Egypt: what it makes in its Cairo factory and from how many pieces, sampling times, denim and imported fabrics, how an order runs, and who it makes for.',
  },
  jeans: {
    title: 'Jeans manufacturer in Egypt / Denim in Cairo / Full Circle',
    description: 'Jeans and denim jackets made in Cairo, from pattern to wash, in imported denims you will not find in the local market. From 150 pieces per colour.',
    summary: 'Full Circle as a jeans and denim manufacturer in Cairo, Egypt: imported denims and trims, the minimum order (150 per colour), sampling time, and how a jeans order runs from pattern to QC.',
  },
  privatelabel: {
    title: 'Private label clothing manufacturer in Cairo / Full Circle',
    description: 'Your clothing, made in Cairo under your own label: design, tech pack, patterns, samples and bulk, with your labels, tags and packaging. From 60 pieces.',
    summary: 'Private label clothing by Full Circle in Cairo, Egypt: the brand designs or brings a reference, Full Circle develops and makes it under the brand\'s own label, tags and packaging, and the brand owns its patterns.',
  },
  hoodies: {
    title: 'Hoodie manufacturer in Egypt / Made in Cairo / Full Circle',
    description: 'Heavyweight hoodies, sweatpants and shorts made in Cairo for your brand, with imported trims. From 60 pieces, samples from 7 days.',
    summary: 'Full Circle as a hoodie manufacturer in Cairo, Egypt: heavyweight hoodies, sweatpants and shorts, the minimum order (60), sampling time, and how bulk is checked against the approved sample.',
  },
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

/**
 * How it works on Home: the work in three parts, one per arc of the mark (Mazen, 27 Oct 2026). The
 * eight stages above stay what an order moves through: Design holds 01–02, Build 03–07, Launch 08,
 * plus the branding and the launch content that Mazen does himself.
 */
export type Arc = { n: string; sub: string; line: string; steps: string[]; photo: string; /** the step the client approves */ gate?: number };

export const ARCS: Arc[] = [
  { n: 'Design', sub: 'Brand + product', line: 'Your brand and your product, drawn before anything is cut.', steps: ['Brand identity', 'Product design', 'Tech pack'], photo: 'stage-01' },
  { n: 'Build', sub: 'Our Cairo factory', line: 'Made in our Cairo factory. You approve the sample, and bulk matches it.', steps: ['Fabric + trims', 'Patterns', 'Sample: you approve', 'Production', 'QC'], photo: 'stage-05', gate: 2 },
  { n: 'Launch', sub: 'Ready to sell', line: 'It reaches you packed, shot and ready to sell.', steps: ['Delivery', 'Product photos', 'Ad creatives'], photo: 'stage-08' },
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
  { id: 'outerwear', n: 'Jackets', sub: 'From 100 pcs', line: 'Light layers built for repeat wear, lined or unlined.', items: 'Jackets, work jackets, coach jackets, and leather where you need it', moq: 'Jackets: 100<br>Leather: 100', samp: '7–25 days', tone: 'radial-gradient(70% 60% at 45% 35%,#7a5a44,#2b2119 72%)', product: 'Jackets' },
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

/**
 * The search pages (Mazen chose four, 9 Nov 2026), each one search a brand makes. Every fact is one the site
 * already states (CLAUDE.md, confirmed content): no prices, no bulk lead times, no fabric weights.
 */
export type Landing = {
  key: LandingKey;
  path: string;
  /** The H1 and the crumb. */
  h1: string;
  crumb: string;
  lead: string;
  /** The hero's background photo slot. */
  photo: string;
  /** The sample request's product, when the page is about one. */
  product?: ProductOption;
  facts: [IconName, string][];
  /** The page's first section: a heading and a few short paragraphs. */
  intro: { h: string; p: string[] };
  /** Three icon cards. */
  cards: { h: string; items: [IconName, string, string][] };
  faq: [string, string][];
  related: LandingKey[];
};

/** One of the FAQ's answers, by its question. */
const faqOf = (q: string) => FAQ.find(([x]) => x === q)!;
const FAQ_TECHPACK = faqOf('Do I need a tech pack to start?');
const FAQ_OWN = faqOf('Who owns my designs and patterns?');
const FAQ_ABROAD = faqOf('Do you work with brands outside Egypt?');
const FAQ_MIN = faqOf('What is the minimum order?');

export const LANDINGS: Landing[] = [
  {
    key: 'egypt', path: '/clothing-manufacturer-egypt', h1: 'Clothing manufacturer in Egypt.', crumb: 'Clothing manufacturer in Egypt',
    lead: PLAIN_LINE, photo: 'stage-06',
    facts: [['pieces', 'From 60 pcs / colour'], ['clock', 'Samples in 7–25 days'], ['denim', 'Denim speciality'], ['ring', 'Live order tracking']],
    intro: {
      h: 'Made in Cairo',
      p: [
        'Full Circle is a clothing development and manufacturing partner in Gisr El Suez, Cairo. One team takes a brand from the first sketch to the launch: design, patterns, fabric, samples, production and quality control under one roof, then delivery, product photos and ads.',
        'Brands come to us at two points. Starting: an idea, no factory yet. Scaling: selling already, and bulk must match the sample.',
      ],
    },
    cards: {
      h: 'Why brands make with us',
      items: [
        ['denim', 'Denim speciality', 'Jeans and denim jackets, from pattern to wash.'],
        ['source', 'Imported fabrics + trims', 'Fabrics you will not find in the local market, at a competitive price.'],
        ['qc', 'What you approve is what ships', 'Bulk is checked against your signed sample: chest, length, sleeve, stitch, colour.'],
      ],
    },
    faq: [FAQ_MIN, FAQ_TECHPACK, FAQ_OWN, ['Can I visit the factory?', 'Yes. Our floor is in Gisr El Suez, Cairo. Book a visit, Sunday to Thursday, 9:00 to 17:00.']],
    related: ['jeans', 'hoodies', 'privatelabel'],
  },
  {
    key: 'jeans', path: '/jeans-manufacturer-egypt', h1: 'Jeans manufacturer in Egypt.', crumb: 'Jeans manufacturer in Egypt',
    lead: 'Denim is our speciality: jeans and denim jackets, from pattern to wash, made in Cairo.', photo: 'cat-denim', product: 'Denim',
    facts: [['pieces', 'From 150 pcs / colour'], ['clock', 'Samples up to 25 days'], ['source', 'Imported denims'], ['trims', 'Imported trims']],
    intro: {
      h: 'Denim, start to finish',
      p: [
        'Jeans and denim jackets, from pattern to wash, in denims we import that you will not find in the local market.',
        'Buttons, rivets, zips and labels come from abroad too. Jeans start at 150 pieces per colour, and denim jackets at 150.',
      ],
    },
    cards: {
      h: 'How a jeans order runs',
      items: [
        ['pattern', 'Paper first', 'Every piece is drawn, cut in paper and graded before the denim is touched.'],
        ['sample', 'You approve the sample', 'Up to 25 days for denim. Bulk waits for your approval.'],
        ['qc', 'Checked before packed', 'Every piece is checked against your signed sample.'],
      ],
    },
    faq: [
      ['What is the minimum for jeans?', '150 pieces per colour. Denim jackets start at 150 too.'],
      ['How long does a denim sample take?', 'Up to 25 days. Denim takes the longest of everything we make.'],
      FAQ_TECHPACK, FAQ_ABROAD,
    ],
    related: ['egypt', 'privatelabel', 'hoodies'],
  },
  {
    key: 'privatelabel', path: '/private-label-clothing', h1: 'Private label clothing.', crumb: 'Private label clothing',
    lead: 'Your designs and your label, made in our Cairo factory, from design to delivery.', photo: 'path-starting',
    facts: [['pieces', 'From 60 pcs / colour'], ['tag', 'Your labels + tags'], ['clock', 'Samples in 7–25 days'], ['techpack', 'You own the patterns']],
    intro: {
      h: 'Your brand on every piece',
      p: [
        'Private label means the clothes carry your brand, not ours. We develop and make them; you sell them.',
        'Bring a sketch, a reference garment or a mood board. We turn it into a tech pack, make the patterns and the sample, and run bulk once you approve it. A new brand gets its name, logo, labels, tags and packaging with us too.',
      ],
    },
    cards: {
      h: 'Design, build, launch',
      items: [
        ['design', 'Design', 'Brand identity, product design and the tech pack.'],
        ['produce', 'Build', 'Fabric and trims, patterns, the sample you approve, production and QC.'],
        ['camera', 'Launch', 'Delivery, product photos and ad creatives.'],
      ],
    },
    faq: [FAQ_OWN, FAQ_TECHPACK, FAQ_MIN, FAQ_ABROAD],
    related: ['egypt', 'jeans', 'hoodies'],
  },
  {
    key: 'hoodies', path: '/hoodie-manufacturer-egypt', h1: 'Hoodie manufacturer in Egypt.', crumb: 'Hoodie manufacturer in Egypt',
    lead: 'Heavyweight hoodies, sweatpants and shorts, made in our Cairo factory.', photo: 'cat-hoodies', product: 'Hoodies',
    facts: [['pieces', 'From 60 pcs'], ['clock', 'Samples from 7 days'], ['trims', 'Imported trims'], ['qc', 'Checked against your sample']],
    intro: {
      h: 'Fleece that holds its shape',
      p: [
        'Heavyweight fleece cut to hold its shape, plus the pieces that go with it.',
        'Hoodies, sweatpants and shorts start at 60 pieces each, with trims from abroad. Samples from 7 days.',
      ],
    },
    cards: {
      h: 'What you approve is what ships',
      items: [
        ['sample', 'The sample', 'Fitted and revised until you sign one off.'],
        ['bulk', 'The bulk run', 'Made against the approved sample, checked along the line.'],
        ['qc', 'Five checks', 'Chest, length, sleeve, stitch and colour, on every bulk piece.'],
      ],
    },
    faq: [
      ['What is the minimum for hoodies?', '60 pieces. Sweatpants and shorts start at 60 too.'],
      ['How long does a hoodie sample take?', 'From 7 days. Across everything we make, samples take 7 to 25 days: cotton is the fastest, denim the longest.'],
      FAQ_TECHPACK, FAQ_ABROAD,
    ],
    related: ['egypt', 'privatelabel', 'jeans'],
  },
];

/** The search page about a category of What we make, where there is one (its card links to it). */
export const CATEGORY_LANDING: Record<string, LandingKey> = { denim: 'jeans', hoodies: 'hoodies' };

/** A search page by its key. */
export const landing = (k: LandingKey) => LANDINGS.find((l) => l.key === k)!;

// The request form's questions and its minimum-order rule live with the functions that receive the
// form (supabase/functions/_shared/forms.ts), so the site and the server check the same options.
export { REQUEST_QUESTIONS, belowMinimum, type RequestKey } from '../../supabase/functions/_shared/forms';
type ProductOption = OptionOf<'product'>;

/**
 * How it works: the demo order's steps, the three parts' steps as the page walks them (Mazen approved the mock,
 * 7 Nov 2026). Launch's photos and ads are one step there. `s` is the garment's look at the step (the
 * .yo-gar[data-s] rules); the page's last station, "Full circle", is not a step.
 */
export type DemoStep = { part: number; n: string; get: string; ok: string; time?: string; s: number };

export const DEMO_STEPS: DemoStep[] = [
  { part: 0, n: 'Brand identity', get: 'Brand board', ok: 'Brand identity', s: 1 },
  { part: 0, n: 'Product design', get: 'Sketches', ok: 'Product design', s: 1 },
  { part: 0, n: 'Tech pack', get: 'Tech pack', ok: 'Tech pack sign-off', s: 2 },
  { part: 1, n: 'Fabric + trims', get: 'Swatches + trim cards', ok: 'Fabric selection', s: 3 },
  { part: 1, n: 'Patterns', get: 'Base-size pattern + fit notes', ok: 'Pattern sign-off', s: 4 },
  { part: 1, n: 'Sample', get: 'A physical sample, fitted', ok: 'Sample approval', time: '7–25 days, denim longest', s: 5 },
  { part: 1, n: 'Production', get: 'Progress at each checkpoint', ok: 'Quantity + delivery date', s: 6 },
  { part: 1, n: 'QC', get: 'Inspection record', ok: 'QC result', s: 7 },
  { part: 2, n: 'Delivery', get: 'Goods + documents', ok: 'Receipt', s: 8 },
  { part: 2, n: 'Photos + ads', get: 'Photos + ad creatives', ok: 'The final set', s: 9 },
];
/** The station of the sample: production waits there until the sample is approved. */
export const DEMO_GATE = DEMO_STEPS.findIndex((d) => d.n === 'Sample');

/**
 * The products in the How it works demo, denim first (the first is picked to begin with): the sample
 * request's name for each, the garment drawn (data/garments.ts) and the fabric it starts on.
 */
export const DEMO_PRODUCTS = [
  { label: 'Denim', product: 'Denim', garment: 'Denim', fab: 'denim' },
  { label: 'Hoodies', product: 'Hoodies', garment: 'Hoodies', fab: 'fleece' },
  { label: 'Tees', product: 'Tees', garment: 'Tees', fab: 'jersey' },
  { label: 'Jackets', product: 'Jackets', garment: 'Outerwear', fab: 'twill' },
  { label: 'Shirts', product: 'Shirts', garment: 'Shirts', fab: 'twill' },
] as const satisfies readonly { label: string; product: ProductOption; garment: GarmentKey; fab: string }[];

/** The demo's fabrics; the ones marked imported say so on the swatch. */
export const DEMO_FABRICS = [
  { fab: 'denim', name: 'Denim 12 oz', short: 'Denim 12 oz', imported: true },
  { fab: 'fleece', name: 'Fleece 380 gsm', short: 'Fleece 380' },
  { fab: 'jersey', name: 'Jersey 220 gsm', short: 'Jersey 220' },
  { fab: 'twill', name: 'Cotton twill', short: 'Twill', imported: true },
] as const;

/** What the demo offers at launch, both picked to begin with. */
export const DEMO_LAUNCH = ['Product photos', 'Ad creatives'] as const satisfies readonly AlsoOption[];

export const pad = (n: number) => String(n).padStart(2, '0');

/** A category's sampling time as the short line on Home ("Samples from 7 days"): drops any note in brackets. */
export const sampleLine = (samp: string) => { const s = samp.replace(/ \(.*\)$/, ''); return `Samples ${s.charAt(0).toLowerCase()}${s.slice(1)}`; };

/** A point on a circle, starting at 12 o'clock and running clockwise (f = 0..1). */
export const ring = (cx: number, cy: number, r: number, f: number): [number, number] => {
  const a = (f * 360 - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
