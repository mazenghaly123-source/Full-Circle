// Cloudflare Turnstile: the check that a form comes from a person, which the Edge Functions verify.
// Its script loads only when a form is sent. It stays invisible unless Cloudflare wants the visitor
// to tick a box, which then appears in the form's slot.
import { BACKEND } from '../../data/backend';

type Turnstile = {
  render(el: HTMLElement, o: Record<string, unknown>): string;
  remove(id: string): void;
};

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** How long to wait for a token before giving up (a box to tick counts as waiting). */
const WAIT_MS = 60_000;

let loading: Promise<Turnstile> | null = null;

function load() {
  loading ??= new Promise<Turnstile>((ok, fail) => {
    const s = document.createElement('script');
    s.src = SRC; s.async = true;
    s.onload = () => { const t = (window as { turnstile?: Turnstile }).turnstile; if (t) ok(t); else fail(new Error('Turnstile did not start')); };
    s.onerror = () => fail(new Error('Turnstile did not load'));
    document.head.append(s);
  }).catch((err) => { loading = null; throw err; });
  return loading;
}

/** A one-time token for one form send. The widget is removed once it has answered. */
export async function humanToken(slot: HTMLElement): Promise<string> {
  const ts = await load();
  return new Promise<string>((ok, fail) => {
    let id = '';
    const done = (f: () => void) => { clearTimeout(timer); try { ts.remove(id); } catch { /* already gone */ } slot.replaceChildren(); f(); };
    const timer = setTimeout(() => done(() => fail(new Error('Turnstile timed out'))), WAIT_MS);
    slot.replaceChildren();
    id = ts.render(slot, {
      sitekey: BACKEND.turnstileSiteKey,
      appearance: 'interaction-only',
      theme: 'dark',
      callback: (token: string) => done(() => ok(token)),
      'error-callback': () => done(() => fail(new Error('Turnstile failed'))),
    });
  });
}
