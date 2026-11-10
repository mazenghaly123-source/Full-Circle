// State that outlives a page swap (the prototype kept it in one document). It resets on a full reload.
import { DEMO_FABRICS, DEMO_LAUNCH, DEMO_PRODUCTS, type RequestKey } from '../../data/site';
import { demoCode } from './util';

export const request = {
  sel: { path: null, product: null, qty: null, have: null } as Record<RequestKey, string | null>,
  /** question 05: the rest of the circle, any number */
  also: [] as string[],
  /** the key the server gave with the code, for the answers after sending */
  followUp: '',
  /** the answers after sending, by question */
  after: {} as Record<string, string>,
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

/** Booking a call: the calendar's free times as last fetched, the picks, the details and the outcome. */
export const book = {
  /** null until the calendar has answered; false when it cannot be used (WhatsApp then) */
  calendar: null as boolean | null,
  days: [] as { date: string; slots: string[] }[],
  /** when the free times were fetched (ms), so a page kept open long fetches them again */
  fetched: 0,
  kind: '' as string, day: '', start: '',
  name: '', phone: '', email: '', brand: '', note: '',
  sending: false, sent: false, when: '', meet: null as string | null,
  err: '', bad: [] as string[],
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
