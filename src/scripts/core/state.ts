// State that outlives a page swap (the prototype kept it in one document). It resets on a full reload.
import { DEMO_PRODUCTS, type RequestKey } from '../../data/site';
import { demoCode } from './util';

export const request = {
  sel: { path: null, product: null, qty: null, have: null } as Record<RequestKey, string | null>,
  sent: false,
  /** waiting for the server's answer (the button reads "Sending…") */
  sending: false,
  /** the code the server gave the request */
  code: '',
  brand: '',
  contact: '',
  note: '',
  /** the opt-in box under a WhatsApp number: order updates on WhatsApp */
  waUpdates: false,
  files: [] as File[],
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
  fab: 'denim',
  fabName: 'Denim 12 oz',
  ok: false,
  at: '',
  here: 0,
  units: 0,
  checked: false,
  visible: false,
  photoAsked: false,
  photoPending: false,
};
