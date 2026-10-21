interface ImportMetaEnv {
  /** The Supabase project the forms send to (src/data/backend.ts). */
  readonly PUBLIC_SUPABASE_URL?: string;
  /** That project's publishable key, for the portal's sign-in. */
  readonly PUBLIC_SUPABASE_KEY?: string;
  /** Cloudflare Turnstile's site key for the forms. */
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
