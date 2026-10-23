// Sends the 6-digit sign-in code on WhatsApp. Supabase Auth calls this (its Send SMS hook) when
// someone signs in to the portal with their number; it signs each call with SEND_SMS_HOOK_SECRET,
// and anything not signed is turned away. Auth shows the person the error when the code cannot go.
//
// POST from Auth: { user: { phone }, sms: { otp, phone? } }. Answers {} or { error: { http_code, message } }.
import { codeMessage, fromAuth, sendWhatsApp } from '../_shared/whatsapp.ts';

const answer = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
// the portal reads whatsapp_send_failed and offers the email instead (src/scripts/core/auth.ts)
const failed = (message: string) => answer({ error: { http_code: 422, message: `whatsapp_send_failed: ${message}` } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return answer({ error: { http_code: 405, message: 'Send it with POST' } }, 405);
  const body = await req.text();
  if (!(await fromAuth(body, req.headers, Deno.env.get('SEND_SMS_HOOK_SECRET')?.trim() ?? ''))) {
    return answer({ error: { http_code: 401, message: 'Not signed by Supabase Auth' } }, 401);
  }
  let input: { user?: { phone?: string }; sms?: { otp?: string; phone?: string } };
  try { input = JSON.parse(body); } catch { return failed('unreadable call'); }
  const otp = input.sms?.otp, digits = (input.sms?.phone || input.user?.phone || '').replace(/\D/g, '');
  if (!otp || !/^\d{4,10}$/.test(otp) || digits.length < 7) return failed('no code or number in the call');

  const sent = await sendWhatsApp(`+${digits}`, codeMessage(otp));
  if (sent.status === 'sent') return answer({});
  console.error('[send-sms]', sent.status, sent.detail);
  return failed(sent.status === 'skipped' ? 'WhatsApp is not set up yet' : 'WhatsApp did not take the message');
});
