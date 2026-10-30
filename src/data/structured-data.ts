// What a page tells search engines and AI agents about itself as schema.org data (Base.astro writes it
// as JSON-LD). Home: the business, the site, its three parts as services, and the FAQ it shows. What we
// make: the making as a service, with the six categories and their minimums. Other pages: none. Every
// value comes from site.ts, in the words the page shows.
import { ARCS, EMAIL, FAQ, INSTAGRAM_URL, MAKE, PHONE, ROUTES, SITE, WHATSAPP, type PageKey } from './site';

const tel = (n: string) => n.replace(/\s/g, '');

/** Where Full Circle's brands sell (CLAUDE.md, confirmed content). */
const AREA_SERVED = ['Egypt', 'Gulf', 'Middle East', 'Turkey', 'China'].map((name) => ({ '@type': 'Place', name }));

/** The fewest pieces a category's card names ("From 150 pcs / colour"), when it names one. */
const fewest = (sub: string) => Number(sub.match(/From (\d+)/)?.[1]) || undefined;

export function structuredData(page: PageKey, site: URL) {
  const home = new URL('/', site).href;
  const org = { '@id': `${home}#organization` };
  if (page === 'home') return {
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'Organization', ...org, name: SITE.name, url: home,
      logo: new URL('/favicon.svg', site).href, image: new URL('/og.jpg', site).href, description: SITE.summary, email: EMAIL, telephone: tel(PHONE),
      address: { '@type': 'PostalAddress', streetAddress: SITE.address.street, addressLocality: SITE.address.city, addressCountry: SITE.address.country },
      contactPoint: [{ '@type': 'ContactPoint', contactType: 'sales', telephone: tel(WHATSAPP), email: EMAIL }],
      areaServed: AREA_SERVED,
      sameAs: [INSTAGRAM_URL],
      // the whole circle: one service per arc of the mark
      hasOfferCatalog: {
        '@type': 'OfferCatalog', name: 'Design, Build, Launch',
        itemListElement: ARCS.map((a) => ({
          '@type': 'Offer', itemOffered: { '@type': 'Service', name: a.n, description: `${a.line} ${a.steps.join(', ')}.`, provider: org },
        })),
      },
    }, {
      '@type': 'WebSite', '@id': `${home}#website`, name: SITE.name, url: home, inLanguage: 'en', publisher: org,
    }, {
      '@type': 'FAQPage', '@id': `${home}#faq`, url: home, inLanguage: 'en',
      mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    }],
  };
  if (page === 'make') {
    const url = new URL(ROUTES.make, site).href;
    return {
      '@context': 'https://schema.org',
      '@type': 'Service', '@id': `${url}#service`, url, name: 'Clothing manufacturing in Cairo',
      serviceType: 'Clothing development and manufacturing',
      description: 'Six categories, made in Cairo, with imported fabrics and trims. Samples in 7 to 25 days.',
      provider: { ...org, '@type': 'Organization', name: SITE.name, url: home },
      areaServed: AREA_SERVED,
      hasOfferCatalog: {
        '@type': 'OfferCatalog', name: 'What we make',
        itemListElement: MAKE.map((m) => {
          const min = fewest(m.sub);
          return {
            '@type': 'Offer', itemOffered: { '@type': 'Service', name: m.n, description: `${m.line} ${m.items}.` },
            ...(min ? { eligibleQuantity: { '@type': 'QuantitativeValue', minValue: min, unitText: 'pieces' } } : {}),
          };
        }),
      },
    };
  }
  return null;
}
