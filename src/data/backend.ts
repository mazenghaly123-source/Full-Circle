// Where the forms send. Until the live Supabase project exists (at launch), every build sends to the
// staging project, with Cloudflare's test Turnstile key. Both values are public by design: they sit
// in the page. A build for the live site sets PUBLIC_SUPABASE_URL and PUBLIC_TURNSTILE_SITE_KEY
// (docs/deploy.md).
const url = import.meta.env.PUBLIC_SUPABASE_URL || 'https://kmsrzeqxgufrodefclty.supabase.co';

export const BACKEND = {
  /** The Edge Functions that receive the forms. */
  functions: `${url}/functions/v1`,
  /** Turnstile's site key; the default is Cloudflare's invisible test key, which always passes. */
  turnstileSiteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000BB',
};

/** The privacy notice the line under each form links to. */
export const PRIVACY = '/privacy';
