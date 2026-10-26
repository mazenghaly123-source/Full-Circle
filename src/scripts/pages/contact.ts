// Contact: copy buttons and the message form, which posts to the submit-contact Edge Function.
import type { Feature } from '../core/lifecycle';
import { $, focusHeading, markInvalid, toast } from '../core/util';
import { source } from '../core/source';
import { isProblem, submit } from '../core/send';
import { ERRORS, NOTICE, readContact, type MessageData } from '../../../supabase/functions/_shared/forms';
import { track } from '../shell/analytics';

const msg = { sent: false, sending: false, name: '', reach: '', text: '', err: '', bad: [] as string[] };
const FIELDS = ['cName', 'cReach', 'cMsg'] as const;
const SEND = 'Send message', SENDING = 'Sending…';

const onWhatsApp = () => readContact(msg.reach)?.channel === 'whatsapp';

function showSending(doc: Document) {
  const b = doc.querySelector('#cForm button[type=submit]')!;
  b.textContent = msg.sending ? SENDING : SEND; b.setAttribute('aria-disabled', String(msg.sending));
}

function restore(doc: Document) {
  const form = doc.getElementById('cForm') as HTMLFormElement | null; if (!form) return;
  (doc.getElementById('cName') as HTMLInputElement).value = msg.name;
  (doc.getElementById('cReach') as HTMLInputElement).value = msg.reach;
  (doc.getElementById('cMsg') as HTMLTextAreaElement).value = msg.text;
  doc.getElementById('cWaLine')!.hidden = !onWhatsApp();
  form.hidden = msg.sent; doc.getElementById('cDone')!.hidden = !msg.sent;
  doc.getElementById('cErr')!.textContent = msg.err; markInvalid(doc, FIELDS, msg.bad, 'cErr');
  showSending(doc);
}

export const contactFeature: Feature = {
  prepare: restore,
  mount(signal) {
    const form = document.getElementById('cForm') as HTMLFormElement | null; if (!form) return;
    restore(document);
    document.querySelectorAll<HTMLElement>('.copy[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      const el = $(b.dataset.copy!), t = el.textContent!;
      try { await navigator.clipboard.writeText(t); toast('Copied'); }
      catch { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection()!; s.removeAllRanges(); s.addRange(r); toast('Selected / copy it'); }
    }, { signal }));
    $('cName').addEventListener('input', (e) => { msg.name = (e.target as HTMLInputElement).value; }, { signal });
    $('cReach').addEventListener('input', (e) => { msg.reach = (e.target as HTMLInputElement).value; $('cWaLine').hidden = !onWhatsApp(); }, { signal });
    $('cMsg').addEventListener('input', (e) => { msg.text = (e.target as HTMLTextAreaElement).value; }, { signal });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (msg.sending) return;
      // every missing field is marked and tied to the error line; focus goes to the first
      const ok = { cName: !!msg.name.trim(), cReach: !!readContact(msg.reach), cMsg: !!msg.text.trim() };
      msg.bad = FIELDS.filter((id) => !ok[id]); markInvalid(document, FIELDS, msg.bad, 'cErr');
      if (msg.bad.length) { msg.err = ERRORS.message; $('cErr').textContent = msg.err; $(msg.bad[0]).focus(); return; }
      msg.sending = true; msg.err = ''; $('cErr').textContent = ''; showSending(document);
      const data = (turnstile: string): string => JSON.stringify({ name: msg.name, contact: msg.reach, text: msg.text, notice: NOTICE.version, source, turnstile } satisfies MessageData);
      const out = await submit<{ ok: true }>('submit-contact', $('cTs'), data);
      msg.sending = false;
      const here = !!document.getElementById('cForm');
      if (here) showSending(document);
      if (isProblem(out)) { msg.err = out.error; if (here) $('cErr').textContent = out.error; return; }
      msg.sent = true; toast('Message sent');
      track('generate_lead', { form: 'contact' });
      if (!here) return;
      $('cForm').hidden = true; $('cDone').hidden = false;
      focusHeading($('cDoneH'));
    }, { signal });
  },
};
