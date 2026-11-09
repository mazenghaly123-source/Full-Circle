// What a page tells search engines and AI agents about itself as schema.org data (Base.astro writes it
// as JSON-LD). Every page: the business, the site, the page itself (an AboutPage, a ContactPage or a
// WebPage) and, below Home, its breadcrumb (SEO audit, 9 Nov 2026). Home adds the FAQ it shows; What we
// make and the search pages add the making as a service, with the minimums the page shows. Every value
// comes from site.ts, in the words the pages show.
import { ARCS, EMAIL, FAQ, INSTAGRAM_URL, MAKE, PAGES, PHONE, ROUTES, SITE, WHATSAPP, landing, type LandingKey, type PageKey } from './site';

const tel = (n: string) => n.replace(/\s/g, '');

/** Where Full Circle works with brands (the FAQ: Egypt, the Gulf and the Middle East, Turkey and China). */
const AREA_SERVED = [
  { '@type': 'Country', name: 'Egypt' },
  { '@type': 'Place', name: 'Gulf' },
  { '@type': 'Place', name: 'Middle East' },
  { '@type': 'Country', name: 'Turkey' },
  { '@type': 'Country', name: 'China' },
];

/** The fewest pieces a category's card names ("From 150 pcs / colour"), when it names one. */
const fewest = (sub: string) => Number(sub.match(/From (\d+)/)?.[1]) || undefined;

/** A part's steps as plain names ("Sample: you approve" → "Sample"). */
const stepNames = (steps: string[]) => steps.map((s) => s.replace(/:.*$/, ''));

/** The page types schema.org has for some of the pages. */
const PAGE_TYPE: Partial<Record<PageKey, string>> = { about: 'AboutPage', contact: 'ContactPage' };

/** Each page's path and its name in a breadcrumb. */
function pathAndName(page: PageKey): [string, string] {
  if (page === 'privacy') return ['/privacy', 'Privacy notice'];
  if (page in ROUTES) {
    const names: Record<keyof typeof ROUTES, string> = { home: 'Home', how: 'How it works', make: 'What we make', about: 'About', start: 'Request a sample', track: 'Track order', contact: 'Contact', book: 'Book a call' };
    return [ROUTES[page as keyof typeof ROUTES], names[page as keyof typeof ROUTES]];
  }
  const l = landing(page as LandingKey);
  return [l.path, l.crumb];
}

/** The making of one or more categories as a service, with each category's minimum. */
function makingService(id: string, url: string, name: string, description: string, cats: typeof MAKE, org: object) {
  return {
    '@type': 'Service', '@id': `${url}#service`, url, name,
    serviceType: 'Clothing development and manufacturing',
    description,
    provider: org,
    areaServed: AREA_SERVED,
    hasOfferCatalog: {
      '@type': 'OfferCatalog', name: id,
      itemListElement: cats.map((m) => {
        const min = fewest(m.sub);
        return {
          '@type': 'Offer', itemOffered: { '@type': 'Service', name: m.n, description: `${m.line} ${m.items}.` },
          ...(min ? { eligibleQuantity: { '@type': 'QuantitativeValue', minValue: min, unitText: 'pieces' } } : {}),
        };
      }),
    },
  };
}

export function structuredData(page: PageKey, site: URL) {
  if (page === 'notfound') return null;
  const home = new URL('/', site).href;
  const org = { '@id': `${home}#organization` };
  const [path, crumb] = pathAndName(page);
  const url = new URL(path, site).href;

  const business = {
    '@type': ['Organization', 'LocalBusiness'], ...org, name: SITE.name, url: home,
    logo: new URL('/logo.png', site).href, image: new URL('/og.jpg', site).href, description: SITE.summary, email: EMAIL, telephone: tel(PHONE),
    address: { '@type': 'PostalAddress', streetAddress: SITE.address.street, addressLocality: SITE.address.city, addressCountry: SITE.address.country },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: SITE.open.days, opens: SITE.open.opens, closes: SITE.open.closes }],
    contactPoint: [{
      '@type': 'ContactPoint', contactType: 'sales', telephone: tel(WHATSAPP), email: EMAIL, areaServed: AREA_SERVED, availableLanguage: ['English', 'Arabic'],
      hoursAvailable: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: SITE.open.days, opens: SITE.open.opens, closes: SITE.open.closes }],
    }],
    areaServed: AREA_SERVED,
    knowsAbout: ['Clothing manufacturing', 'Denim', 'Private label clothing', 'Tech packs', 'Pattern making', 'Garment sampling', 'Quality control'],
    sameAs: [INSTAGRAM_URL],
    // the whole circle: one service per arc of the mark
    hasOfferCatalog: {
      '@type': 'OfferCatalog', name: 'Design, Build, Launch',
      itemListElement: ARCS.map((a) => ({
        '@type': 'Offer', itemOffered: { '@type': 'Service', name: a.n, description: `${a.line} ${stepNames(a.steps).join(', ')}.`, provider: org },
      })),
    },
  };
  const website = { '@type': 'WebSite', '@id': `${home}#website`, name: SITE.name, url: home, inLanguage: 'en', publisher: org };
  const webpage = {
    '@type': PAGE_TYPE[page] ?? 'WebPage', '@id': `${url}#webpage`, url, name: PAGES[page].title, description: PAGES[page].description,
    inLanguage: 'en', isPartOf: { '@id': `${home}#website` }, about: org,
    ...(page === 'home' ? {} : { breadcrumb: { '@id': `${url}#breadcrumb` } }),
  };
  const breadcrumb = page === 'home' ? [] : [{
    '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: home },
      { '@type': 'ListItem', position: 2, name: crumb, item: url },
    ],
  }];

  const extra: object[] = [];
  if (page === 'home') extra.push({
    '@type': 'FAQPage', '@id': `${home}#faq`, url: home, inLanguage: 'en',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  });
  if (page === 'make') extra.push(makingService('What we make', url, 'Clothing manufacturing in Cairo', 'Six categories, made in Cairo, with imported fabrics and trims. Samples in 7 to 25 days.', MAKE, org));
  const cats: Partial<Record<LandingKey, string[]>> = { egypt: MAKE.map((m) => m.id), jeans: ['denim'], privatelabel: MAKE.map((m) => m.id), hoodies: ['hoodies'] };
  if (page in cats) {
    const l = landing(page as LandingKey);
    extra.push(makingService(l.crumb, url, l.crumb, l.lead, MAKE.filter((m) => cats[page as LandingKey]!.includes(m.id)), org));
  }

  return { '@context': 'https://schema.org', '@graph': [business, website, webpage, ...breadcrumb, ...extra] };
}
