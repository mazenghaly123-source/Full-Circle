// The admin (/admin): staff sign in with a 6-digit code sent to their email, then work through
// Inbox, Orders, an order's page, Clients and Team. One page; the address after # says which screen
// (#/inbox, #/order/12...), so Back and links work. Phone first: under 860px the sidebar becomes a tab
// bar at the bottom.
import { BACKEND } from '../../data/backend';
import { readContact } from '../../../supabase/functions/_shared/forms';
import { AUTH_ERRORS } from '../core/auth';
import { humanToken } from '../core/turnstile';
import * as api from './api';
import { esc, toast, waitingOn } from './ui';
import { inboxView } from './views/inbox';
import { ordersView } from './views/orders';
import { orderView } from './views/order';
import { clientsView } from './views/clients';
import { teamView } from './views/team';
import { convertDialog } from './views/convert';

/** What a screen gets: where to draw, who is signed in, and a signal that ends when it is left. */
export type View = { main: HTMLElement; me: api.Staff; signal: AbortSignal; parts: string[]; go: (hash: string) => void; counts: () => void };

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let me: api.Staff | null = null;
let current: AbortController | null = null;

const SCREENS: Record<string, (v: View) => Promise<void>> = { inbox: inboxView, orders: ordersView, order: orderView, clients: clientsView, team: teamView };

async function route() {
  if (!me) return;
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const name = SCREENS[parts[0]] ? parts[0] : 'inbox';
  // the order page sits under Orders in the nav
  const nav = name === 'order' ? 'orders' : name;
  document.querySelectorAll<HTMLElement>('[data-nav]').forEach((a) => { if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  current?.abort(); current = new AbortController();
  const main = $('main');
  main.innerHTML = '<p class="kick" style="padding:8px 2px">Loading</p>';
  const v: View = { main, me, signal: current.signal, parts, go: (h) => { location.hash = h; }, counts: () => { counts(); } };
  try {
    await SCREENS[name](v);
    if (!v.signal.aborted) main.focus({ preventScroll: true });
  } catch (e) {
    if (v.signal.aborted) return;
    if (e instanceof api.SignedOut) return signIn(AUTH_ERRORS.signedOut);
    main.innerHTML = `<div class="empty" role="alert">${esc(e instanceof api.Refused ? e.message : 'Something went wrong drawing this screen. Reload the page.')}<button type="button" class="pill" data-retry>Try again</button></div>`;
    main.querySelector('[data-retry]')!.addEventListener('click', route, { signal: v.signal });
  }
}

/** The counts next to Inbox and Orders: what needs a reply, and orders waiting on us. */
async function counts() {
  try {
    const [rq, ms, os] = await Promise.all([api.requests(), api.messages(), api.orders()]);
    const inbox = rq.filter((r) => r.status === 'new').length + ms.filter((m) => m.status === 'new').length;
    const ours = os.filter((o) => waitingOn(o) === 'us').length;
    for (const [k, n] of [['inbox', inbox], ['orders', ours]] as const) {
      document.querySelectorAll<HTMLElement>(`[data-count="${k}"]`).forEach((c) => {
        c.innerHTML = n ? `<span class="mk mk-us" aria-hidden="true"></span>${n}` : '';
        c.closest('a')?.setAttribute('aria-label', `${c.closest('a')!.dataset.label}${n ? `, ${n} ${k === 'inbox' ? 'new' : 'waiting on us'}` : ''}`);
      });
    }
  } catch { /* the counts are a convenience; the screens say the same */ }
}

/** The sign-in: email, then the 6-digit code. Staff only: anyone else is told so and signed out. */
function signIn(note = '') {
  me = null; current?.abort();
  $('app').hidden = true; $('tabbar').hidden = true;
  const box = $('signin'); box.hidden = false;
  const state = { step: 'email' as 'email' | 'code', email: '', busy: false };
  const draw = (err = '') => {
    box.innerHTML = `<section class="card focus" aria-labelledby="si-h">
<span class="kick">Studio OS · ${state.step === 'email' ? 'Step 1 of 2' : 'Step 2 of 2'}</span>
<h1 id="si-h" class="sc" tabindex="-1">${state.step === 'email' ? 'Sign in' : 'Enter the code'}</h1>
<p class="t2" style="margin:0">${state.step === 'email' ? 'Full Circle staff only. We send a 6-digit code to your email.' : `If ${esc(state.email)} is on the team, a code is on its way. It works for a few minutes.`}</p>
<form id="si-f" class="stack" novalidate>
${state.step === 'email'
    ? `<div class="fl"><label for="si-e">Work email</label><div class="inp"><input id="si-e" name="email" type="email" autocomplete="username" value="${esc(state.email)}" required></div></div>`
    : `<div class="fl"><label for="si-c">6-digit code</label><div class="inp"><input id="si-c" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required style="font-family:var(--font-plex-mono);letter-spacing:.3em;font-size:18px"></div></div>`}
<span class="errline" id="si-err" role="alert">${esc(err)}</span>
<div class="ts" id="si-ts"></div>
<div class="row"><button class="pill red" type="submit"${state.busy ? ' disabled' : ''}>${state.step === 'email' ? 'Send me a code' : 'Sign in'}</button>
${state.step === 'code' ? '<button class="pill ghost" type="button" id="si-back">Use another email</button>' : ''}</div>
</form></section>`;
    box.querySelector<HTMLInputElement>('input')!.focus();
    box.querySelector('#si-back')?.addEventListener('click', () => { state.step = 'email'; draw(); });
    box.querySelector('#si-f')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (state.busy) return;
      const input = box.querySelector<HTMLInputElement>('input')!;
      if (state.step === 'email') {
        const c = readContact(input.value);
        if (c?.channel !== 'email') return draw('Add your work email');
        state.email = c.email; state.busy = true; draw();
        let captcha: string;
        try { captcha = await humanToken($('si-ts')); } catch { state.busy = false; return draw(AUTH_ERRORS.robot); }
        const problem = await api.session.sendCode({ email: state.email }, captcha);
        state.busy = false;
        if (problem) return draw(problem.error);
        state.step = 'code'; draw(); toast('Code sent');
      } else {
        if (!/^\d{6}$/.test(input.value.trim())) return draw(AUTH_ERRORS.code);
        state.busy = true; draw();
        const problem = await api.session.verifyCode({ email: state.email }, input.value.trim());
        state.busy = false;
        if (problem) return draw(problem.error);
        start();
      }
    });
  };
  draw(note);
}

/** Signed in: checks the account is on the team, then shows the app. */
async function start() {
  try {
    me = await api.me();
  } catch (e) {
    return signIn(e instanceof api.SignedOut ? AUTH_ERRORS.signedOut : AUTH_ERRORS.failed);
  }
  if (!me) {
    api.session.signOut();
    return signIn('That email is not on the Full Circle team. An owner can add you under Team.');
  }
  $('signin').hidden = true; $('app').hidden = false; $('tabbar').hidden = false;
  $('who-name').textContent = me.name; $('who-role').textContent = me.role === 'owner' ? 'Owner' : 'Staff';
  route(); counts();
}

function boot() {
  // staging holds test data only, and says so on every screen
  if (/kmsrzeqxgufrodefclty/.test(BACKEND.url)) $('stage-tag').hidden = false;
  addEventListener('hashchange', route);
  addEventListener('fc-signed-out', () => signIn(AUTH_ERRORS.signedOut));
  $('sign-out').addEventListener('click', () => { api.session.signOut(); location.hash = ''; signIn(); });
  $('new-order').addEventListener('click', () => convertDialog({ me: me!, go: (h) => { location.hash = h; } }));
  if (api.session.signedIn()) start(); else signIn();
}

boot();
