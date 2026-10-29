// How it works: the demo order's garment, one per product, drawn as a line figure with depth (the
// Hairline style, 29 Oct 2026). Each piece is a cut outline with a front and a back face a few units
// apart, the front gently rounded, so the figure turns like a real garment when the pointer moves.
// Pure geometry: the page renders the figure at rest, and the browser redraws it as it turns.
// The classes keep the stage styling of the prototype's flat shirt (.pc, .detail, .stitch, .anno…).

type P2 = readonly [number, number];
type P3 = readonly [number, number, number];
export type Pose = { yaw: number; pitch: number };

/** How the figure stands when nothing moves it: turned a little, seen a little from above. */
export const REST: Pose = { yaw: -0.34, pitch: 0.3 };
/** How far the pointer can turn it either way. */
export const REACH: Pose = { yaw: 0.55, pitch: 0.16 };

type Piece = {
  cls: 'pcL' | 'pcR' | 'pcB' | 'pcC';
  pts: P2[];
  /** Half the thickness, the extra rounding of the front, and where that rounding is centred. */
  d: number; b: number; cx: number; hw: number;
  r?: number;
};
/** A line on a piece's front: the piece's index, its points, and whether it closes. */
type Line = { on: number; pts: P2[]; close?: boolean; acc?: boolean };
type Note = { at: [number, number, number]; end: P2; text: P2; t: string };
type Meas = { a: [number, number, number]; b: [number, number, number]; text: P2; t: string };

type Garment = {
  label: string;
  pieces: Piece[];
  detail: Line[];
  stitch: Line[];
  anno: Note[];
  notch: [number, number, string][];
  meas: Meas[];
};

// ----- shapes -----

const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 10): P2[] =>
  Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as P2; });
const circ = (cx: number, cy: number, r: number): P2[] => arc(cx, cy, r, r, 0, Math.PI * 2, 12).slice(0, -1);
const rect = (x0: number, y0: number, x1: number, y1: number): P2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const mirror = (pts: P2[]): P2[] => pts.map(([x, y]) => [-x, y] as P2).reverse();
const L = (on: number, pts: P2[], close = false, acc = false): Line => ({ on, pts, close, acc });

/** Rounds every corner of an outline (radius r), then adds points along long edges so they bend with the front. */
function soften(pts: P2[], r: number, close: boolean): P2[] {
  const out: P2[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (!close && (i === 0 || i === n - 1)) { out.push(p); continue; }
    const a = pts[(i - 1 + n) % n], c = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lc = Math.hypot(c[0] - p[0], c[1] - p[1]);
    const k = Math.min(r, la / 2.2, lc / 2.2);
    if (k < 0.3) { out.push(p); continue; }
    const p1: P2 = [p[0] + ((a[0] - p[0]) / la) * k, p[1] + ((a[1] - p[1]) / la) * k];
    const p2: P2 = [p[0] + ((c[0] - p[0]) / lc) * k, p[1] + ((c[1] - p[1]) / lc) * k];
    for (let s = 0; s <= 4; s++) {
      const t = s / 4, u = 1 - t;
      out.push([u * u * p1[0] + 2 * u * t * p[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * p[1] + t * t * p2[1]]);
    }
  }
  return subdivide(out, close);
}

function subdivide(pts: P2[], close: boolean, step = 7): P2[] {
  const out: P2[] = [];
  const m = close ? pts.length : pts.length - 1;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let s = 0; s < k; s++) out.push([a[0] + ((b[0] - a[0]) * s) / k, a[1] + ((b[1] - a[1]) * s) / k]);
  }
  if (!close) out.push(pts[pts.length - 1]);
  return out;
}

// ----- the five garments (x right, y down, centred on the chest) -----

const neck = (w: number, top: number, dip: number) => arc(0, top, w, dip, Math.PI, 0, 8).slice(1, -1).reverse();

const SHIRT: Garment = {
  label: 'Shirts',
  pieces: [
    { cls: 'pcL', pts: [[-64, -82], [-108, -48], [-90, -16], [-57, -36]], d: 5, b: 3, cx: -84, hw: 30 },
    { cls: 'pcR', pts: mirror([[-64, -82], [-108, -48], [-90, -16], [-57, -36]]), d: 5, b: 3, cx: 84, hw: 30 },
    { cls: 'pcB', pts: [[-24, -94], [-66, -80], [-58, -34], [-56, 98], [56, 98], [58, -34], [66, -80], [24, -94], [0, -60]], d: 7, b: 9, cx: 0, hw: 72 },
    { cls: 'pcC', pts: [[-27, -96], [0, -102], [27, -96], [31, -86], [14, -58], [3, -66], [0, -74], [-3, -66], [-14, -58], [-31, -86]], d: 2, b: 2, cx: 0, hw: 34, r: 3 },
  ],
  detail: [
    L(2, [[-4, -60], [-4, 98]]),
    L(2, rect(-42, -42, -16, -14), true), L(2, rect(16, -42, 42, -14), true),
    ...[-44, -16, 12, 40, 68].map((y) => L(2, circ(0, y, 1.7), true)),
    L(3, circ(0, -66, 1.9), true, true),
  ],
  stitch: [
    L(2, [[-53, 93], [53, 93]]), L(2, rect(-39, -39, -19, -17), true), L(2, rect(19, -39, 39, -17), true),
    L(0, [[-104, -45], [-87, -19]]), L(1, [[104, -45], [87, -19]]), L(2, [[4, -56], [4, 94]]),
  ],
  anno: [
    { at: [3, 18, -78], end: [246, 40], text: [248, 42], t: 'Camp collar' },
    { at: [2, -30, -30], end: [30, 232], text: [0, 244], t: 'Patch pocket x2' },
    { at: [2, 40, 98], end: [258, 270], text: [232, 282], t: 'Straight hem' },
  ],
  notch: [[54, 210, 'Sleeve x2'], [128, 282, 'Body / cut 2'], [128, 28, 'Collar']],
  meas: [
    { a: [2, -57, -26], b: [2, 57, -26], text: [104, 108], t: 'Chest 56.0 ✓' },
    { a: [2, 64, -80], b: [2, 64, 98], text: [228, 160], t: '74.0 ✓' },
  ],
};

const HOOD_BACK: P2[] = [[-38, -84], ...arc(0, -90, 46, 36, Math.PI * 1.08, Math.PI * 1.92, 12), [38, -84]];
const HOODIE: Garment = {
  label: 'Hoodies',
  pieces: [
    { cls: 'pcC', pts: HOOD_BACK, d: 8, b: 6, cx: 0, hw: 44, r: 6 },
    { cls: 'pcL', pts: [[-70, -80], [-104, -48], [-116, 62], [-92, 68], [-63, -30]], d: 7, b: 4, cx: -92, hw: 30 },
    { cls: 'pcR', pts: mirror([[-70, -80], [-104, -48], [-116, 62], [-92, 68], [-63, -30]]), d: 7, b: 4, cx: 92, hw: 30 },
    { cls: 'pcB', pts: [[-27, -92], [-70, -80], [-63, -30], [-60, 100], [60, 100], [63, -30], [70, -80], [27, -92], ...neck(27, -92, 13)], d: 8, b: 11, cx: 0, hw: 76, r: 6 },
  ],
  detail: [
    L(0, arc(0, -86, 26, 30, Math.PI * 1.1, Math.PI * 1.9, 10)),
    L(3, [[-46, 74], [-44, 44], [-31, 16], [31, 16], [44, 44], [46, 74]], true),
    L(3, [[-60, 84], [60, 84]]), L(1, [[-114, 50], [-92, 56]]), L(2, [[114, 50], [92, 56]]),
    L(3, [[-9, -80], [-11, -42]]), L(3, [[9, -80], [11, -44]]),
    L(3, [[-11, -42], [-11.6, -34]], false, true), L(3, [[11, -44], [11.6, -36]], false, true),
  ],
  stitch: [
    L(3, [[-41, 70], [-39, 46], [-28, 21], [28, 21], [39, 46], [41, 70]]),
    L(3, [[-58, 92], [58, 92]]), L(1, [[-112, 58], [-92, 62]]), L(2, [[112, 58], [92, 62]]),
    L(3, neck(23, -89, 11)),
  ],
  anno: [
    { at: [0, -26, -110], end: [56, 30], text: [0, 22], t: 'Lined hood' },
    { at: [3, -32, 52], end: [28, 236], text: [0, 248], t: 'Kangaroo pocket' },
    { at: [2, 104, 60], end: [262, 236], text: [228, 250], t: 'Rib cuffs' },
  ],
  notch: [[38, 214, 'Sleeve x2'], [128, 284, 'Body / cut 2'], [138, 22, 'Hood']],
  meas: [
    { a: [3, -64, -22], b: [3, 64, -22], text: [104, 112], t: 'Chest 61.0 ✓' },
    { a: [3, 70, -80], b: [3, 70, 100], text: [230, 160], t: '72.0 ✓' },
  ],
};

const TEE: Garment = {
  label: 'Tees',
  pieces: [
    { cls: 'pcL', pts: [[-62, -82], [-98, -58], [-84, -24], [-56, -36]], d: 5, b: 3, cx: -78, hw: 26 },
    { cls: 'pcR', pts: mirror([[-62, -82], [-98, -58], [-84, -24], [-56, -36]]), d: 5, b: 3, cx: 78, hw: 26 },
    { cls: 'pcB', pts: [[-24, -94], [-62, -82], [-56, -36], [-54, 98], [54, 98], [56, -36], [62, -82], [24, -94], ...neck(24, -94, 14)], d: 6, b: 8, cx: 0, hw: 70 },
    { cls: 'pcC', pts: [...arc(0, -95, 28, 18, Math.PI, 0, 12).slice(2, -2).reverse(), ...arc(0, -95, 22, 11, Math.PI, 0, 12).slice(2, -2)], d: 2, b: 1, cx: 0, hw: 30, r: 2 },
  ],
  detail: [
    L(2, [[-54, 78], [-60, 78], [-60, 86], [-54, 86]], false, true),
  ],
  stitch: [
    L(2, [[-51, 93], [51, 93]]), L(2, [[-51, 90], [51, 90]]),
    L(0, [[-95, -54], [-82, -27]]), L(1, [[95, -54], [82, -27]]),
  ],
  anno: [
    { at: [3, 16, -86], end: [246, 40], text: [248, 42], t: 'Rib collar' },
    { at: [0, -84, -48], end: [26, 226], text: [0, 238], t: 'Set-in sleeve' },
    { at: [2, 36, 92], end: [258, 270], text: [222, 282], t: 'Twin-needle hem' },
  ],
  notch: [[44, 204, 'Sleeve x2'], [128, 282, 'Body / cut 2'], [128, 26, 'Neck rib']],
  meas: [
    { a: [2, -55, -26], b: [2, 55, -26], text: [104, 108], t: 'Chest 54.0 ✓' },
    { a: [2, 62, -82], b: [2, 62, 98], text: [226, 160], t: '71.0 ✓' },
  ],
};

const LEG: P2[] = [[-64, -44], [-2, -44], [-3, -20], [-13, 108], [-50, 108], [-60, 20]];
const DENIM: Garment = {
  label: 'Denim',
  pieces: [
    { cls: 'pcL', pts: LEG, d: 6, b: 6, cx: -32, hw: 34, r: 3 },
    { cls: 'pcR', pts: mirror(LEG), d: 6, b: 6, cx: 32, hw: 34, r: 3 },
    { cls: 'pcB', pts: [[-59, -90], [59, -90], [64, -38], [0, -30], [-64, -38]], d: 7, b: 8, cx: 0, hw: 72, r: 3 },
    { cls: 'pcC', pts: [[-60, -104], [60, -104], [59, -89], [-59, -89]], d: 7.5, b: 8, cx: 0, hw: 72, r: 2 },
  ],
  detail: [
    L(2, [[10, -88], [10, -50], [6, -42], [0, -38]]), L(2, [[0, -89], [0, -36]]),
    L(2, [[-32, -89], [-36, -72], [-46, -62], [-61, -58]]), L(2, [[32, -89], [36, -72], [46, -62], [61, -58]]),
    L(2, rect(36, -86, 48, -72), true),
    ...[-50, -20, 20, 50].map((x) => L(3, rect(x - 2.5, -105, x + 2.5, -84), true)),
    L(3, circ(0, -96.5, 3.2), true, true),
    L(2, circ(-59, -59, 1.3), true), L(2, circ(59, -59, 1.3), true),
  ],
  stitch: [
    L(0, [[-49, 103], [-14, 103]]), L(1, [[49, 103], [14, 103]]),
    L(2, [[-29, -89], [-33, -70], [-44, -59], [-61, -55]]), L(2, [[29, -89], [33, -70], [44, -59], [61, -55]]),
    L(3, [[-58, -92], [58, -92]]), L(0, [[-58, 18], [-62, -40]]), L(1, [[58, 18], [62, -40]]),
  ],
  anno: [
    { at: [3, 0, -97], end: [228, 30], text: [230, 26], t: 'Shank button' },
    { at: [2, -44, -66], end: [26, 104], text: [0, 96], t: 'Scoop pocket' },
    { at: [0, -32, 106], end: [36, 268], text: [0, 280], t: 'Chain-stitch hem' },
  ],
  notch: [[34, 212, 'Leg x2'], [124, 284, 'Seat / cut 2'], [116, 26, 'Waistband']],
  meas: [
    { a: [3, -60, -110], b: [3, 60, -110], text: [112, 36], t: 'Waist 41.0 ✓' },
    { a: [2, 72, -104], b: [1, 72, 108], text: [232, 160], t: '104.0 ✓' },
  ],
};

const JACKET: Garment = {
  label: 'Outerwear',
  pieces: [
    { cls: 'pcL', pts: [[-74, -80], [-108, -46], [-120, 60], [-96, 66], [-66, -28]], d: 7, b: 5, cx: -95, hw: 30 },
    { cls: 'pcR', pts: mirror([[-74, -80], [-108, -46], [-120, 60], [-96, 66], [-66, -28]]), d: 7, b: 5, cx: 95, hw: 30 },
    { cls: 'pcB', pts: [[-28, -92], [-74, -80], [-66, -28], [-64, 80], [-60, 96], [60, 96], [64, 80], [66, -28], [74, -80], [28, -92], ...neck(28, -92, 12)], d: 9, b: 12, cx: 0, hw: 80, r: 6 },
    { cls: 'pcC', pts: [[-32, -106], [32, -106], [29, -91], ...neck(29, -91, 12), [-29, -91]], d: 3, b: 3, cx: 0, hw: 34, r: 3 },
  ],
  detail: [
    L(3, [[-30, -103], ...neck(30, -103, 12).reverse(), [30, -103]]),
    L(2, [[-1.5, -80], [-1.5, 96]]), L(2, [[1.5, -80], [1.5, 96]]),
    L(2, [[-60, 80], [60, 80]]), L(0, [[-118, 46], [-96, 52]]), L(1, [[118, 46], [96, 52]]),
    L(2, [[-52, 14], [-38, 46], [-34, 44], [-48, 12]], true), L(2, [[52, 14], [38, 46], [34, 44], [48, 12]], true),
    L(0, rect(-104, -30, -90, -12), true),
    L(2, [[2.5, -78], [6, -78], [6, -64], [2.5, -64]], false, true),
  ],
  stitch: [
    L(2, [[-58, 76], [58, 76]]), L(2, [[-5, -78], [-5, 92]]), L(2, [[5, -60], [5, 92]]),
    L(0, [[-116, 42], [-95, 48]]), L(1, [[116, 42], [95, 48]]),
  ],
  anno: [
    { at: [3, -20, -102], end: [56, 30], text: [0, 22], t: 'Rib collar' },
    { at: [2, 4, -70], end: [244, 40], text: [246, 36], t: 'Imported zip' },
    { at: [2, -44, 30], end: [26, 236], text: [0, 248], t: 'Welt pocket x2' },
  ],
  notch: [[34, 214, 'Sleeve x2'], [128, 284, 'Body / cut 2'], [126, 20, 'Collar rib']],
  meas: [
    { a: [2, -66, -22], b: [2, 66, -22], text: [104, 112], t: 'Chest 62.0 ✓' },
    { a: [2, 74, -80], b: [2, 74, 96], text: [232, 160], t: '68.0 ✓' },
  ],
};

export const GARMENTS = { Shirts: SHIRT, Hoodies: HOODIE, Tees: TEE, Denim: DENIM, Outerwear: JACKET } as const;
export type GarmentKey = keyof typeof GARMENTS;
export const garmentKey = (label: string): GarmentKey => (label in GARMENTS ? label : 'Shirts') as GarmentKey;

// ----- drawing -----

type Ready = { g: Garment; pieces: (Piece & { soft: P2[] })[]; detail: (Line & { soft: P2[] })[]; stitch: (Line & { soft: P2[] })[] };
const cache = new Map<GarmentKey, Ready>();
function ready(key: GarmentKey): Ready {
  let r = cache.get(key);
  if (!r) {
    const g = GARMENTS[key];
    const line = (l: Line) => ({ ...l, soft: subdivide(l.pts, !!l.close, 5) });
    r = { g, pieces: g.pieces.map((p) => ({ ...p, soft: soften(p.pts, p.r ?? 5, true) })), detail: g.detail.map(line), stitch: g.stitch.map(line) };
    cache.set(key, r);
  }
  return r;
}

/** The front's height off the piece's middle at a point: the half thickness plus a rounding across. */
const front = (p: Piece, x: number) => p.d + p.b * Math.max(0, 1 - ((x - p.cx) / p.hw) ** 2);

function camera({ yaw, pitch }: Pose) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return ([x, y, z]: P3): P2 => {
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    const y2 = y * cp + z1 * sp, z2 = -y * sp + z1 * cp;
    const f = 1 + z2 / 900;
    return [150 + x1 * f, 154 + y2 * f];
  };
}

const n1 = (v: number) => (Math.round(v * 10) / 10).toString();
const path = (pts: P2[], close: boolean) => pts.map(([x, y], i) => (i ? 'L' : 'M') + n1(x) + ' ' + n1(y)).join('') + (close ? 'Z' : '');
/** Edges collected into as few lines as they join up into, so a dashed stroke runs on along them. */
function runs() {
  const all: { src: P2[]; i: number[] }[] = [];
  return {
    add(src: P2[], i: number, j: number) {
      const last = all[all.length - 1];
      if (last && last.src === src && last.i[last.i.length - 1] === i) last.i.push(j); else all.push({ src, i: [i, j] });
    },
    d: () => all.map((r) => path(r.i.map((k) => r.src[k]), false)).join(''),
  };
}
const signedArea = (q: P2[]) => q.reduce((s, p, i) => { const o = q[(i + 1) % q.length]; return s + p[0] * o[1] - o[0] * p[1]; }, 0);

/**
 * Every path of the figure for a pose, in the order the markup holds them (each element with data-d).
 * Per piece: the back's fill, the sides' fill, the front's ground, the front (cloth), the creases
 * inside the outline (dim), and the outline (bright: the stroke the stages style).
 */
export function figurePaths(key: GarmentKey, pose: Pose): string[] {
  const { g, pieces, detail, stitch } = ready(key);
  const P = camera(pose);
  const out: string[] = [];
  const fronts: string[] = [];
  const faceOf = pieces.map((p) => p.soft.map(([x, y]) => [P([x, y, front(p, x)]), P([x, y, -front(p, x)])] as const));
  pieces.forEach((p, k) => {
    const f = faceOf[k].map((v) => v[0]), b = faceOf[k].map((v) => v[1]);
    const turn = Math.sign(signedArea(f)) || 1;
    let sides = '';
    const crease = runs(), sil = runs();
    f.forEach((_, i) => {
      const j = (i + 1) % f.length, q = [f[i], f[j], b[j], b[i]];
      const a = signedArea(q);
      sides += path(a < 0 ? [...q].reverse() : q, true);
      // a side you can see: its back edge is the outline and its front edge a crease inside it
      if (a * turn < 0) { sil.add(b, i, j); crease.add(f, i, j); } else sil.add(f, i, j);
    });
    const fd = path(f, true);
    out.push(path(b, true), sides, fd, fd, crease.d() || 'M0 0', sil.d());
    fronts.push(fd);
  });
  out.unshift(fronts.join(''), fronts.join(''));
  const on = (l: Line & { soft: P2[] }) => path(l.soft.map(([x, y]) => P([x, y, front(g.pieces[l.on], x) + 0.4])), !!l.close);
  out.push(...detail.map(on), ...stitch.map(on));
  const at = ([i, x, y]: [number, number, number]) => P([x, y, front(g.pieces[i], x)]);
  for (const a of g.anno) out.push(path([at(a.at), a.end], false));
  for (const m of g.meas) {
    const [pa, pb] = [at(m.a), at(m.b)];
    out.push(path([pa, pb], false));
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** The figure's markup (inside the garment's svg, after its defs), drawn at a pose. */
export function figureSvg(key: GarmentKey, pose: Pose = REST): string {
  const { g, detail, stitch } = ready(key);
  const d = figurePaths(key, pose);
  let i = 0;
  const p = (attrs = '') => `<path data-d${attrs} d="${d[i++]}"/>`;
  const ground = ' fill="#11110F" stroke="none"';
  return [
    `<g class="ghost">${p(' transform="translate(18,-14)"')}${p(' transform="translate(36,-28)"')}</g>`,
    ...g.pieces.map((pc) => `<g class="pc ${pc.cls}">${p(ground)}${p(ground)}${p(ground)}${p(' stroke="none"')}${p(' class="cr" fill="none"')}${p(' fill="none"')}</g>`),
    `<g class="detail">${detail.map((l) => p(l.acc ? ' class="acc"' : '')).join('')}</g>`,
    `<g class="stitch">${stitch.map(() => p()).join('')}</g>`,
    `<g class="anno">${g.anno.map((a) => p(' class="ld"') + `<text x="${a.text[0]}" y="${a.text[1]}">${esc(a.t)}</text>`).join('')}</g>`,
    `<g class="notch">${g.notch.map(([x, y, t]) => `<text x="${x}" y="${y}">${esc(t)}</text>`).join('')}</g>`,
    `<g class="meas">${g.meas.map((m) => p() + `<text x="${m.text[0]}" y="${m.text[1]}">${esc(m.t)}</text>`).join('')}</g>`,
  ].join('');
}
