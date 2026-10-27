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
