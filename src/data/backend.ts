// Where the forms send and the portal signs in: the one Supabase project (data/project.ts), which holds
// the real requests since 30 Oct 2026 (Mazen: the free plan for the first months, Pro once orders run on
// the portal). The Turnstile widget is the real one for fullcircle-co.com (29 Oct 2026), and the
// project's TURNSTILE_SECRET_KEY is its secret. These values are public by design: they sit in the page.
// A build for another project sets PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY and PUBLIC_TURNSTILE_SITE_KEY
// (docs/deploy.md).
import { PROJECT } from './project';

const url = import.meta.env.PUBLIC_SUPABASE_URL || PROJECT.url;

export const BACKEND = {
  url,
  /** The Edge Functions that receive the forms. */
  functions: `${url}/functions/v1`,
  /** The project's publishable key: it reaches no table on its own (row-level security), only sign-in. */
  key: import.meta.env.PUBLIC_SUPABASE_KEY || PROJECT.key,
  /** The invisible Turnstile widget's site key (fullcircle-co.com, www and the workers.dev address). */
  turnstileSiteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAFrgoV5A59gRXKxT',
};

/** The privacy notice the line under each form links to. */
export const PRIVACY = '/privacy';
