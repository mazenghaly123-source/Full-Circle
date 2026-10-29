// Where the forms send and the portal signs in. Until the live Supabase project exists (at launch),
// every build talks to the staging project. The Turnstile widget is the real one for fullcircle-co.com
// (29 Oct 2026), so staging's TURNSTILE_SECRET_KEY is its secret. These values are public by design:
// they sit in the page. A build for the live site sets PUBLIC_SUPABASE_URL,
// PUBLIC_SUPABASE_KEY and PUBLIC_TURNSTILE_SITE_KEY (docs/deploy.md).
const url = import.meta.env.PUBLIC_SUPABASE_URL || 'https://kmsrzeqxgufrodefclty.supabase.co';

export const BACKEND = {
  url,
  /** The Edge Functions that receive the forms. */
  functions: `${url}/functions/v1`,
  /** The project's publishable key: it reaches no table on its own (row-level security), only sign-in. */
  key: import.meta.env.PUBLIC_SUPABASE_KEY || 'sb_publishable_LE_GLebfmPITqgi0tv3gWQ_fHthUc_x',
  /** The invisible Turnstile widget's site key (fullcircle-co.com, www and the workers.dev address). */
  turnstileSiteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAFrgoV5A59gRXKxT',
};

/** The privacy notice the line under each form links to. */
export const PRIVACY = '/privacy';
