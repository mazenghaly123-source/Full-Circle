// Sends a form to its Edge Function (supabase/functions/submit-*), with a Turnstile token.
import { BACKEND } from '../../data/backend';
import { ERRORS, type Problem } from '../../../supabase/functions/_shared/forms';
import { humanToken } from './turnstile';

/**
 * Posts a form. Resolves to the server's answer, or to a problem with the right error line when
 * the Turnstile check, the network or the server fails; it never throws.
 */
export async function submit<T extends object>(fn: 'submit-request' | 'submit-contact', slot: HTMLElement, body: (turnstile: string) => BodyInit): Promise<T | Problem> {
  let token: string;
  try { token = await humanToken(slot); } catch { return { error: ERRORS.robot, field: 'robot' }; }
  try {
    // a FormData or a plain string body keeps this a "simple" request: no CORS preflight first
    const res = await fetch(`${BACKEND.functions}/${fn}`, { method: 'POST', body: body(token) });
    const out = await res.json().catch(() => ({}));
    return res.ok && !('error' in out) ? out as T : { error: typeof out.error === 'string' ? out.error : ERRORS.failed, field: out.field };
  } catch {
    return { error: ERRORS.failed };
  }
}

export const isProblem = (r: object): r is Problem => 'error' in r;
