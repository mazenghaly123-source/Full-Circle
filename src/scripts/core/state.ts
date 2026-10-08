// State that outlives a page swap (the prototype kept it in one document). It resets on a full reload.
import type { RequestKey } from '../../data/site';
import { demoCode } from './util';

export const request = {
  sel: { path: null, product: null, qty: null, have: null } as Record<RequestKey, string | null>,
  sent: false,
  code: '',
  brand: '',
  contact: '',
  note: '',
  files: [] as File[],
  /** the error line under the form, kept when the page comes back */
  err: '',
};

export const picked = () => Object.values(request.sel).filter(Boolean).length;

/** The "you are the order" demo on How it works. */
export const yo = {
  code: demoCode(),
  path: null as string | null,
  product: 'Shirts',
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
