// The markdown version of every public page, written from the same data the pages render
// (src/data/site.ts, the forms' questions) and in the words the pages show; tests/md.spec.ts checks
// that every sentence here is on the HTML page too. The .md files (src/pages/[page].md.ts),
// llms.txt, llms-full.txt and the catalog all come from this list, so a new page needs one entry
// here and nothing else. Pages left out on purpose are in MARKDOWN_SKIPPED.
import { execFileSync } from 'node:child_process';
import { NOTICE } from '../../supabase/functions/_shared/forms';
import {
  EMAIL, FAQ, INSTAGRAM, INSTAGRAM_URL, MAKE, PAGES, PHONE, REQUEST_QUESTIONS, ROUTES, SITE, STAGES,
  WHATSAPP, WHATSAPP_URL, pad, sampleLine, type PageKey,
} from '../data/site';
import { abs, b, day, h2, h3, link, list, ordered, page, table } from './format';

export type MarkdownRoute = {
  key: PageKey;
  /** The HTML page's path. */
  path: string;
  /** Its short name in llms.txt and the catalog. */
  name: string;
  /** Where llms.txt and llms-full.txt list it. */
  section: 'core' | 'optional';
  /** The files its words and facts come from, for its "Last updated" date. */
  sources: string[];
  body: (site: URL) => string[];
  related: PageKey[];
};

const DATA = ['src/data/site.ts'];
const NAMES: Partial<Record<PageKey, string>> = {
  home: 'Home', how: 'How it works', make: 'What we make', about: 'About', start: 'Request a sample',
  track: 'Track order', contact: 'Contact', privacy: 'Privacy notice',
};
const contacts = (): [string, string][] => [
  ['WhatsApp', link(WHATSAPP, WHATSAPP_URL)],
  ['Phone', PHONE],
  ['Email', link(EMAIL, `mailto:${EMAIL}`)],
  ['Instagram', link(INSTAGRAM, INSTAGRAM_URL)],
];

const ROUTE_LIST: MarkdownRoute[] = [
  {
    key: 'home', path: ROUTES.home, name: 'Home', section: 'core', sources: ['src/pages/index.astro', ...DATA],
    related: ['how', 'make', 'start', 'contact'],
    body: (site) => [
      `${b('Idea to product. Full circle.')} From idea to bulk, under one roof in Cairo. What you approve in sampling is what ships.`,
      list(['From 60 pcs', '7–25 day samples', 'Denim + imports', 'Live tracking', 'Free first call / we reply quickly']),
      h2('Where is your brand?'),
      `${h3('Starting.')}\nAn idea, no factory yet. Design / Tech pack / First samples. ${link('Start a new brand', abs(site, `${ROUTES.start}?path=Starting`))}`,
      `${h3('Scaling.')}\nSelling already. Bulk must match. Pattern review / Bulk samples / QC every run. ${link('Move production to us', abs(site, `${ROUTES.start}?path=Scaling`))}`,
      h2('What we make'),
      'Denim first. Imported fabrics and trims.',
      table(['Category', 'Minimum', 'Samples'], MAKE.map((m) => [m.n, m.sub, sampleLine(m.samp)])),
      link('All capabilities', abs(site, ROUTES.make)),
      h2('How it works'),
      'Eight stages. You approve each one.',
      ordered(STAGES.map((g) => `${b(g.n)}: ${g.ok}`)),
      link('The full process', abs(site, ROUTES.how)),
      h2('What you approve is what ships.'),
      'Every bulk piece is checked against your signed sample: chest, length, sleeve, stitch, colour.',
      h2('Nothing ships unseen.'),
      'Every order gets a code and a page.',
      list(['Approve from your phone', 'Ask for a photo of any stage', 'Every decision on record']),
      link('Track your order', abs(site, ROUTES.track)),
      h2('Questions'),
      FAQ.map(([q, a]) => `${h3(q)}\n${a}`).join('\n\n'),
      h2('Contact'),
      list([...contacts().filter(([k]) => k !== 'Email'), ['Studio + floor', 'Cairo, Egypt']].map(([k, v]) => `${k}: ${v}`)),
    ],
  },
  {
    key: 'how', path: ROUTES.how, name: 'How it works', section: 'core', sources: ['src/pages/how-it-works.astro', 'src/components/StageTerms.astro', ...DATA],
    related: ['start', 'track', 'make'],
    body: (site) => {
      const terms = (i: number) => {
        const g = STAGES[i];
        return list([`You receive: ${g.demo?.get ?? g.get}`, `You approve: ${g.demo?.ok ?? g.ok}`, ...(g.time ? [`Typical time: ${g.time}`] : [])]);
      };
      const stage = (i: number, text: string[]) => [`${h3(`${pad(i + 1)} / ${STAGES[i].n}`)}\n${text.join(' ')}`, ...(i < 6 ? [terms(i)] : [])].join('\n\n');
      return [
        `${b('Eight stages. One partner.')} Every stage ends with something you can see and a decision you make.`,
        h2('The eight stages'),
        stage(0, ['You have an idea.', 'We start by studying the brand, the customer and the market the product is going into.']),
        stage(1, ['Where is the brand?', 'Starting: an idea or a sketch, no factory yet.', 'Scaling: already selling. The last run did not match the sample.', 'Sketches then become technical drawings with measurements, trims and construction notes.']),
        stage(2, ['Fabric and trims are sourced against the brief. You approve the swatches before anything is cut.']),
        stage(3, ['Paper first. Every piece is drawn, cut in paper and graded before fabric is touched. Scaling brands enter here.']),
        stage(4, ['The gate. Bulk waits for this.', 'The sample you sign becomes the contract. Bulk is measured against it, piece by piece. Production does not move until you approve.']),
        stage(5, ['Then it repeats.']),
        stage(6, ['Checked before packed.\n\n' + list(['Measurements against the sample: ±0.5 cm', 'Seams and stitch density', 'Colour against the approved swatch', 'Labels and care', 'Packing count'])]),
        stage(7, ['Circle closed.']),
        h2('Where you enter'),
        'You do not have to start at stage 01. We start from wherever the product is.',
        `${h3('Starting a brand: stage 01')}\nFrom an idea or a mood board. We do the research and design support, and build the tech pack with you. ${link('Start a new brand', abs(site, `${ROUTES.start}?path=Starting`))}`,
        `${h3('Scaling a brand: stage 04')}\nFrom a garment you already sell. We rebuild the pattern, lock the sample and move to bulk. ${link('Move production to us', abs(site, `${ROUTES.start}?path=Scaling`))}`,
        h2('See it on your order.'),
        'Every client gets a tracking page with the stage, the next decision and photos on request.',
      ];
    },
  },
  {
    key: 'make', path: ROUTES.make, name: 'What we make', section: 'core', sources: ['src/pages/what-we-make.astro', ...DATA],
    related: ['start', 'how', 'home'],
    body: (site) => [
      'Six categories, made in Cairo. Denim first.',
      table(['Category', 'Minimum', 'Samples', 'Items'], MAKE.map((m) => [m.n, m.sub, sampleLine(m.samp), m.items])),
      list(MAKE.map((m) => `${m.n}: ${link('Request a sample', abs(site, `${ROUTES.start}?product=${encodeURIComponent(m.product)}`))}`)),
      h2('What sets us apart'),
      list([`${b('Denim speciality')}: Pattern to wash, from 150 pcs / colour.`, `${b('Imported fabrics')}: Denims and fabrics not sold in Cairo.`, `${b('Imported trims')}: Buttons, rivets, zips and labels from abroad.`]),
      h2('Not on the list?'),
      'Tell us. If it is not for us, we say so.',
    ],
  },
  {
    key: 'about', path: ROUTES.about, name: 'About', section: 'core', sources: ['src/pages/about.astro'],
    related: ['how', 'contact', 'start'],
    body: () => [
      `${b('Fashion culture leads. Process proves it.')} One partner in Cairo, from the first sketch to delivered bulk.`,
      h2('Why one partner'),
      `${b('The usual way')}: Designer / gap / Pattern maker / gap / Fabric supplier / gap / Factory. Four suppliers, and a bulk run that does not match the sample.`,
      `${b('With Full Circle')}: One team. The sample you approve is what ships.`,
      h2('How we work with you'),
      list([`${b('Every stage has an output')}: You see it before we move on.`, `${b('Every decision is yours')}: Nothing moves without your approval.`, `${b('Nothing ships unseen')}: Ask for a photo of any stage.`]),
      'Coming next: Full Circle Studio, a consultancy arm for brands that need direction before production.',
      h2('Where we sell'),
      list(['Made in Cairo', 'Gulf + Middle East', 'Turkey', 'China']),
      h2('Come and see.'),
      'A first call, or a visit to the floor in Cairo.',
    ],
  },
  {
    key: 'start', path: ROUTES.start, name: 'Request a sample', section: 'core', sources: ['src/pages/request-a-sample.astro', 'supabase/functions/_shared/forms.ts'],
    related: ['how', 'make', 'privacy'],
    body: (site) => [
      'Four picks and your contact. No commitment.',
      h2('The four picks'),
      REQUEST_QUESTIONS.map((q) => `${h3(`${q.label} (${q.hint})`)}\n${list([...q.options])}${q.k === 'qty' ? '\n\nOur minimum is 60 pieces per colour for most products and 150 for denim. Send the request anyway: we will suggest the closest option on the call.' : ''}`).join('\n\n'),
      h2('Your contact'),
      list(['Brand name', 'Email or WhatsApp', 'Notes (optional)']),
      `${NOTICE.request} ${link('Privacy notice', abs(site, '/privacy'))}`,
      h2('What happens next'),
      list([`${b('First call')}: The product, the quantity, where you are now.`, `${b('Price range')}: A sample price and a bulk range, before you commit.`, `${b('Your order code')}: Your order opens on the tracking page.`]),
    ],
  },
  {
    key: 'track', path: ROUTES.track, name: 'Track order', section: 'core', sources: ['src/pages/track.astro'],
    related: ['how', 'start'],
    body: () => [
      'Sign in with the email or WhatsApp on your order.',
      h2('Sign in'),
      ordered(['Email or WhatsApp number: Send me a code', '6-digit code: Sign in']),
    ],
  },
  {
    key: 'contact', path: ROUTES.contact, name: 'Contact', section: 'core', sources: ['src/pages/contact.astro', ...DATA],
    related: ['start', 'about'],
    body: (site) => [
      'WhatsApp is the fastest way to reach us.',
      list([...contacts(), ['Where', 'Cairo, Egypt / visits by appointment'], ['Hours', 'Sunday – Thursday / 9:00 – 17:00'], ['Markets', 'Gulf + Middle East / Turkey / China'], ['Other', 'Press, partnerships and careers: email us.']].map(([k, v]) => `${k}: ${v}`)),
      h2('Send a message'),
      list(['Your name', 'Email or WhatsApp', 'Message']),
      `${NOTICE.contact} ${link('Privacy notice', abs(site, '/privacy'))}`,
      `Production enquiry? ${link('Request a sample', abs(site, ROUTES.start))}`,
    ],
  },
  {
    key: 'privacy', path: '/privacy', name: 'Privacy notice', section: 'optional', sources: ['src/pages/privacy.astro', ...DATA],
    related: ['contact'],
    body: (site) => [
      'What we collect when you contact us or work with us, why, where it is kept, and what you can ask for.',
      h2('Who we are'),
      `Full Circle develops and manufactures clothing for brands, in Cairo, Egypt. Registered name: Full Circle. Address: ${SITE.address.street}, Cairo, Egypt.`,
      `Questions about your data: ${link(EMAIL, `mailto:${EMAIL}`)}, or WhatsApp ${link(WHATSAPP, WHATSAPP_URL)}.`,
      h2('What we collect'),
      list([
        `${b('When you request a sample:')} your brand name, your email or WhatsApp number, your picks (product, quantity, what you have) and your notes. We do not take files through the site: sketches and photos come later, on WhatsApp.`,
        `${b('When you send a message:')} your name, your email or WhatsApp number and your message.`,
        `${b('With either:')} the first page you opened on the site and the site or ad that sent you (for example Instagram), so we know which posts bring brands to us.`,
        `${b('If you accept analytics cookies:')} how you use the site (the pages you open, the WhatsApp button, whether a form was sent), your device and your rough location, through Google Analytics. Not your name or contact.`,
        `${b('When you become a client:')} your sign-in to the tracking page, your orders, the decisions you approve or ask to change, and photos of your order at each stage.`,
      ]),
      'We do not take payments through the site.',
      h2('Why'),
      list([
        'To reply to your request or message and give you a price.',
        'To develop, make and deliver your order, and show you where it stands.',
        'To keep a record of what you approved, which protects you and us.',
        'To send you updates on your order by email, and on WhatsApp if you ticked the box for it.',
        'To keep the forms free of robots and abuse.',
        'To see which pages and posts bring brands to us, if you accept analytics cookies.',
      ]),
      h2('Who handles it for us'),
      list([
        `${b('Supabase:')} our database, in Frankfurt, Germany.`,
        `${b('Cloudflare:')} hosts the site and checks that a form comes from a person. That check looks at your browser and IP address; we do not keep them.`,
        `${b('Resend:')} sends our emails (United States).`,
        `${b('Meta:')} carries our WhatsApp messages (United States and elsewhere).`,
        `${b('Google:')} Google Analytics counts visits, only if you accept its cookies (United States and elsewhere).`,
      ]),
      'They use your data only to provide their service to us.',
      h2('Where it is kept'),
      'Mainly in Frankfurt, Germany. Some of the providers above also process it in the United States and elsewhere.',
      h2('How long'),
      list([
        'Requests and messages that do not lead to an order: one year, then deleted.',
        'Orders and their approval records: five years.',
        'Google Analytics’ visit-by-visit data: two months. Its summary reports, which name no one, are kept longer.',
        'The record that you asked for WhatsApp updates, and the words you agreed to: for as long as we send them, and one year after.',
      ]),
      h2('What you can ask for'),
      'A copy of the data we hold about you, a correction, or its deletion (except records we must keep, such as an order’s). Ask us by email or WhatsApp; we reply as soon as we can.',
      `WhatsApp updates are off unless you tick the box for them. To stop them, tell us on WhatsApp or by email; you will also be able to switch them off on the ${link('tracking page', abs(site, ROUTES.track))}.`,
      h2('Cookies'),
      'The site sets no advertising cookies. Google Analytics’ cookies, which count visits, are set only if you accept them in the bar at the bottom of the page; if you decline, none are set and nothing is sent to Google. Your choice is kept in your browser, and you can change it at any time.',
      'When you sign in to the tracking page, your browser keeps your session so you stay signed in. The site serves its own fonts and scripts; only the robot check comes from Cloudflare, and Google Analytics’ script once you accept it.',
      h2('Security'),
      'Everything travels encrypted, and only Full Circle staff can read what you send us. If a breach affects your data, we tell you and the authorities as the law requires.',
      h2('Changes'),
      'Last updated 26 October 2026. Every change is dated here.',
    ],
  },
];

/** Public pages with no markdown version, and why. tests/md.spec.ts fails on a page in neither list. */
export const MARKDOWN_SKIPPED: Record<string, string> = {
  '/admin': 'staff only, signed in, and kept out of search',
  '/404': 'the not-found page (noindex)',
};

/** Every page with a markdown version, in llms.txt's order: the core pages, then the optional ones. */
export const listMarkdownRoutes = () => [...ROUTE_LIST].sort((x, y) => Number(x.section === 'optional') - Number(y.section === 'optional'));

/** The .md file name for a page path: /about → about, / → index. */
export const mdFile = (path: string) => (path === '/' ? 'index' : path.slice(1));

/**
 * The date the files behind a page last changed in git, or null where git cannot tell. In a shallow
 * clone every file seems to change in its one commit, so that date is not trusted (the build first
 * tries to fetch the whole history: scripts/unshallow.mjs). A page not committed yet is dated today.
 */
function updated(sources: string[]) {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    if (git('rev-parse', '--is-shallow-repository') === 'true') return null;
    const d = git('log', '-1', '--format=%cs', '--', ...sources);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : day(new Date());
  } catch {
    return null;
  }
}

/** A page's markdown version. */
export function renderMarkdown(r: MarkdownRoute, site: URL) {
  return page({
    title: PAGES[r.key].title,
    summary: PAGES[r.key].description,
    canonical: abs(site, r.path),
    updated: updated(r.sources),
    body: r.body(site),
    related: r.related.map((k) => [NAMES[k]!, abs(site, k === 'privacy' ? '/privacy' : ROUTES[k as keyof typeof ROUTES])]),
  });
}

/** The markdown version of a path, or null where there is none. */
export function markdownFor(path: string, site: URL) {
  const r = ROUTE_LIST.find((x) => x.path === path);
  return r ? renderMarkdown(r, site) : null;
}
