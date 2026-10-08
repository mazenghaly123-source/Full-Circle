// Contact: copy buttons and the message form. Phase 1 keeps the prototype's behaviour (the form
// is checked but not sent); phase 2 sends it to the server.
import type { Feature } from '../core/lifecycle';
import { $, toast } from '../core/util';

const msg = { sent: false, name: '', reach: '', text: '' };

function restore(doc: Document) {
  const form = doc.getElementById('cForm') as HTMLFormElement | null; if (!form) return;
  (doc.getElementById('cName') as HTMLInputElement).value = msg.name;
  (doc.getElementById('cReach') as HTMLInputElement).value = msg.reach;
  (doc.getElementById('cMsg') as HTMLTextAreaElement).value = msg.text;
  form.hidden = msg.sent; doc.getElementById('cDone')!.hidden = !msg.sent;
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
      if (!$<HTMLInputElement>('cName').value.trim() || $<HTMLInputElement>('cReach').value.trim().length < 6 || !$<HTMLTextAreaElement>('cMsg').value.trim()) { $('cErr').textContent = 'Fill in your name, contact and message'; return; }
      // TODO(phase 2): send to the submit-contact function
      msg.sent = true; form.hidden = true; $('cDone').hidden = false; toast('Message sent');
    }, { signal });
  },
};
