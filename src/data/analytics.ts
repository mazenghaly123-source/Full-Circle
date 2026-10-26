// Google Analytics (GA4), only with the visitor's consent (Mazen, 26 Oct 2026: a small bar at the
// bottom of the page; /privacy says so). It runs only on the live domain, so previews and the test
// suites send nothing. src/scripts/shell/analytics.ts loads it.
export const ANALYTICS = {
  /** The GA4 property's measurement ID. */
  id: import.meta.env.PUBLIC_GA_ID || 'G-XNT9FPB5RQ',
  /** The hosts that count visits. */
  hosts: ['fullcircle-co.com', 'www.fullcircle-co.com'],
};
