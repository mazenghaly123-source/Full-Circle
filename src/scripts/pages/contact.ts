// Contact: copy buttons and the message form. Phase 1 keeps the prototype's behaviour (the form
// is checked but not sent); phase 2 sends it to the server.
import type { Feature } from '../core/lifecycle';
import { $, focusHeading, markInvalid, toast } from '../core/util';

const msg = { sent: false, name: '', reach: '', text: '', err: '', bad: [] as string[] };
const FIELDS = ['cName', 'cReach', 'cMsg'] as const;

function restore(doc: Document) {
  const form = doc.getElementById('cForm') as HTMLFormElement | null; if (!form) return;
  (doc.getElementById('cName') as HTMLInputElement).value = msg.name;
  (doc.getElementById('cReach') as HTMLInputElement).value = msg.reach;
  (doc.getElementById('cMsg') as HTMLTextAreaElement).value = msg.text;
  form.hidden = msg.sent; doc.getElementById('cDone')!.hidden = !msg.sent;
  doc.getElementById('cErr')!.textContent = msg.err; markInvalid(doc, FIELDS, msg.bad, 'cErr');
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
    $('cReach').addEventListener('input', (e) => { msg.reach = (e.target as HTMLInputElement).value; }, { signal });
    $('cMsg').addEventListener('input', (e) => { msg.text = (e.target as HTMLTextAreaElement).value; }, { signal });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // every missing field is marked and tied to the error line; focus goes to the first
      const ok = { cName: !!$<HTMLInputElement>('cName').value.trim(), cReach: $<HTMLInputElement>('cReach').value.trim().length >= 6, cMsg: !!$<HTMLTextAreaElement>('cMsg').value.trim() };
      msg.bad = FIELDS.filter((id) => !ok[id]); markInvalid(document, FIELDS, msg.bad, 'cErr');
      if (msg.bad.length) { msg.err = 'Fill in your name, contact and message'; $('cErr').textContent = msg.err; $(msg.bad[0]).focus(); return; }
      // TODO(phase 2): send to the submit-contact function
      msg.sent = true; form.hidden = true; $('cDone').hidden = false; toast('Message sent');
      focusHeading($('cDoneH'));
    }, { signal });
  },
};
