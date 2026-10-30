// The Supabase project the site talks to unless a build says otherwise (src/data/backend.ts), as plain
// values: the Worker (src/worker.ts), which has no import.meta.env, uses them too. The publishable key is
// public by design (it reaches no table on its own, only sign-in and the keep-awake call).
export const PROJECT = {
  url: 'https://kmsrzeqxgufrodefclty.supabase.co',
  key: 'sb_publishable_LE_GLebfmPITqgi0tv3gWQ_fHthUc_x',
};
