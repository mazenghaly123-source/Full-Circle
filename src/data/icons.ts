// Line icons (Mazen, 23 Oct 2026): 24px, a 1.5px stroke with round caps and joins (as the corners are
// rounded), one red accent each: a dot (.rd), a measuring line (.rl) or a fill (.fl). Drawn for Full
// Circle; inner SVG only, wrapped by src/components/Icon.astro (the parity tests use the same strings).

const TEE = '<path d="M8.2 4.5L3.8 7.4l2 3.4 2.4-1.2V19.5h7.6V9.6l2.4 1.2 2-3.4-4.4-2.9c-.6 1.4-2 2.3-3.8 2.3s-3.2-.9-3.8-2.3z"/>';

export const ICONS = {
  // facts
  pieces: '<rect x="4" y="13.5" width="16" height="6" rx="2"/><rect x="5.5" y="8.5" width="13" height="5" rx="2"/><rect x="7" y="4.5" width="10" height="4" rx="1.5"/><circle class="rd" cx="19.5" cy="5" r="1.7"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/><circle class="rd" cx="12" cy="12" r="1.4"/>',
  trims: '<circle cx="12" cy="12" r="8.5"/><circle cx="10" cy="10" r="1"/><circle cx="14" cy="10" r="1"/><circle cx="10" cy="14" r="1"/><circle cx="14" cy="14" r="1"/><circle class="rd" cx="18.2" cy="5.8" r="1.4"/>',
  denim: '<path d="M7 3.5h10l1.2 17h-4.4L12 10.5l-1.8 10H5.8z"/><path d="M7.1 6.8h9.8"/><circle class="rd" cx="9.3" cy="9" r="1.1"/>',
  ring: '<circle cx="12" cy="12" r="7.5"/><circle class="rd" cx="12" cy="4.5" r="2.2"/>',
  // the eight stages, in order (STAGE_ICONS)
  research: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/><circle class="rd" cx="10.5" cy="10.5" r="1.4"/>',
  design: '<path d="M4.5 19.5l3.8-.9L19 7.9a2 2 0 0 0 0-2.8l-.1-.1a2 2 0 0 0-2.8 0L5.4 15.7z"/><path d="M14.5 6.5l3 3"/><circle class="rd" cx="5" cy="19" r="1.3"/>',
  source: '<path d="M7 5h10c1.7 0 3 3.1 3 7s-1.3 7-3 7H7"/><ellipse cx="7" cy="12" rx="3" ry="7"/><circle class="rd" cx="7" cy="12" r="1.3"/>',
  develop: '<circle cx="6.5" cy="7" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M8.6 8.4L20 16.5M8.6 15.6L20 7.5"/><circle class="rd" cx="13.2" cy="12" r="1.2"/>',
  sample: '<path d="M10 6.2a2 2 0 1 1 2 2v1.2"/><path d="M12 9.4l8.3 6.1a1.4 1.4 0 0 1-.8 2.5h-15a1.4 1.4 0 0 1-.8-2.5z"/><circle class="rd" cx="12" cy="14.5" r="1.3"/>',
  produce: '<path d="M4 19h16M6 19V8.5a2.5 2.5 0 0 1 2.5-2.5h8a2.5 2.5 0 0 1 2.5 2.5V11h-6v8"/><path d="M15.5 11v3"/><circle class="rd" cx="15.5" cy="15.6" r="1.2"/>',
  qc: '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.4l2.5 2.5 4.9-5.2"/><circle class="rd" cx="18" cy="6" r="1.5"/>',
  deliver: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/><circle class="rd" cx="16" cy="6" r="1.2"/>',
  // the two ways in
  techpack: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3"/><circle class="rd" cx="15.5" cy="16" r="1.3"/>',
  pattern: '<path d="M4.5 19.5v-15l15 15z"/><path d="M8.5 15.5v-4l4 4z"/><circle class="rd" cx="4.5" cy="4.5" r="1.5"/>',
  bulk: '<rect x="3.5" y="11.5" width="7.5" height="7.5" rx="1.8"/><rect x="13" y="11.5" width="7.5" height="7.5" rx="1.8"/><rect x="8.2" y="3.5" width="7.5" height="7.5" rx="1.8"/><circle class="rd" cx="12" cy="7.2" r="1.2"/>',
  // following an order
  phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M9.8 12.2l1.6 1.6 3-3.2"/><circle class="rd" cx="12" cy="18" r="1"/>',
  camera: '<rect x="3.5" y="7" width="17" height="12" rx="2.5"/><path d="M9 7l1.4-2.5h3.2L15 7"/><circle cx="12" cy="13" r="3.2"/><circle class="rd" cx="17.5" cy="10" r="1"/>',
  log: '<path d="M9 7h11M9 12h11M9 17h7"/><circle cx="5" cy="7" r="1.1"/><circle cx="5" cy="12" r="1.1"/><circle class="rd" cx="5" cy="17" r="1.3"/>',
  // what bulk is checked against
  chest: TEE + '<path class="rl" d="M8.4 12.5h7.2"/>',
  length: TEE + '<path class="rl" d="M12 9.2v9"/>',
  sleeve: TEE + '<path class="rl" d="M15.9 5.6l3.1 2.1"/>',
  stitch: '<path d="M3.5 16c3-6 6-6 8.5 0s5.5 6 8.5 0" stroke-dasharray="2 2.4"/><circle class="rd" cx="12" cy="16" r="1.3"/>',
  colour: '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/><rect class="fl" x="8" y="8" width="8" height="8" rx="2"/>',
} as const;

export type IconName = keyof typeof ICONS;

/** The icon for each of the eight stages, in STAGES order. */
export const STAGE_ICONS: IconName[] = ['research', 'design', 'source', 'develop', 'sample', 'produce', 'qc', 'deliver'];

/** The whole SVG for an icon, as the site renders it. */
export const iconSvg = (name: IconName) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
