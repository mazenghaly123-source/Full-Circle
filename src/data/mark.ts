// The mark is three arcs, each starting inside the end of the one before. Home's How it works draws
// them one at a time, one per part of the work (Design, Build, Launch, Mazen 27 Oct 2026), and they
// close into the mark. The arcs come from the sprite, so they stay the logo's own.

/** The mark's centre, in the sprite's viewBox (0 0 256.86 262.30). */
export const MARK_C = [128.43, 131.15] as const;

/**
 * Where each arc starts and how far it runs, in degrees clockwise from 3 o'clock (SVG's y-down
 * angles), in drawing order: the arc that starts at 9 o'clock (Design), then 4 o'clock (Build),
 * then 1 o'clock (Launch). `path` is the arc's index among the mark's subpaths.
 */
export const MARK_ARCS = [
  { path: 2, start: 170, span: 199 },
  { path: 1, start: 18, span: 253 },
  { path: 0, start: 279, span: 245 },
] as const;

/** Degrees each arc's reveal starts early and ends late, so its rounded ends are fully drawn. */
export const ARC_PAD = 10;

/** The mark's three subpaths, from the sprite's markup, in drawing order. */
export function markArcPaths(sprite: string): string[] {
  const symbol = sprite.match(/<symbol id="fc-mark"[\s\S]*?<\/symbol>/)![0];
  const subs = symbol.match(/ d="([^"]*)"/)![1].split(/(?=M)/);
  return MARK_ARCS.map((a) => subs[a.path]);
}

/**
 * The middle of each arc's band (halfway between its inner and outer edge), in the sprite's units, at every
 * whole degree clockwise from 3 o'clock; 0 where the arc does not reach. How it works rides its demo order
 * on it. Worked out at build time: measuring the outline in the browser held a page switch for a second.
 * The outlines are absolute M, C, L and Z only, so each segment is sampled as it is.
 */
export function arcMidRadii(paths: string[]): number[][] {
  return paths.map((d) => {
    const lo = new Array<number>(360).fill(Infinity), hi = new Array<number>(360).fill(0);
    const add = (x: number, y: number) => {
      const dx = x - MARK_C[0], dy = y - MARK_C[1], r = Math.hypot(dx, dy);
      const a = (Math.round((Math.atan2(dy, dx) * 180) / Math.PI) % 360 + 360) % 360;
      lo[a] = Math.min(lo[a], r); hi[a] = Math.max(hi[a], r);
    };
    let x = 0, y = 0;
    for (const [, cmd, args] of d.matchAll(/([MCLZ])([^MCLZ]*)/g)) {
      const n = (args.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
      if (cmd === 'M') { [x, y] = n; add(x, y); }
      if (cmd === 'L') for (let i = 0; i + 1 < n.length; i += 2) {
        for (let k = 1; k <= 40; k++) add(x + ((n[i] - x) * k) / 40, y + ((n[i + 1] - y) * k) / 40);
        [x, y] = [n[i], n[i + 1]];
      }
      if (cmd === 'C') for (let i = 0; i + 5 < n.length; i += 6) {
        const [x1, y1, x2, y2, x3, y3] = n.slice(i, i + 6);
        for (let k = 1; k <= 40; k++) {
          const t = k / 40, u = 1 - t;
          add(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
        }
        [x, y] = [x3, y3];
      }
    }
    return lo.map((l, a) => (hi[a] - l > 2 ? Math.round(((l + hi[a]) / 2) * 10) / 10 : 0));
  });
}
