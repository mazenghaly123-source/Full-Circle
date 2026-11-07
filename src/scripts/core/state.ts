// State that outlives a page swap (the prototype kept it in one document). It resets on a full reload.
import { DEMO_FABRICS, DEMO_LAUNCH, DEMO_PRODUCTS, type RequestKey } from '../../data/site';
import { demoCode } from './util';

export const request = {
  sel: { path: null, product: null, qty: null, have: null } as Record<RequestKey, string | null>,
  sent: false,
  /** waiting for the server's answer (the button reads "Sending…") */
  sending: false,
  /** the code the server gave the request */
  code: '',
  /** the server opened a sign-in for the request's email: it can be followed on Track */
  track: false,
  brand: '',
  contact: '',
  note: '',
  /** the opt-in box under a WhatsApp number: order updates on WhatsApp */
  waUpdates: false,
  /** the error line under the form, kept when the page comes back, and the fields it is about */
  err: '',
  bad: [] as string[],
};

export const picked = () => Object.values(request.sel).filter(Boolean).length;

/** The "you are the order" demo on How it works. */
export const yo = {
  code: demoCode(),
  path: null as string | null,
  product: DEMO_PRODUCTS[0].label as string,
  fab: DEMO_FABRICS[0].fab as string,
  fabName: DEMO_FABRICS[0].name as string,
  launch: [...DEMO_LAUNCH] as string[],
  ok: false,
  at: '',
  /** the station on screen (the steps, then "Full circle") */
  here: 0,
  units: 0,
  checked: false,
  visible: false,
};
