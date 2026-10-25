// Hash to blocks. A chain's running hash is 32 bytes; each byte decides one block in the left half of an 8 by 8 grid, and the right half is
// its mirror (the chain mirrors Pons, so its picture mirrors itself). Pure and deterministic: the server draws the same grid the browser animates,
// and two identical hashes always draw the same grid. It is a fingerprint (like an identicon); the hashes are the proof, the grid makes a match,
// or a mismatch, easy to see.

export const SIZE = 8;
export const HALF = 4;
export const CELLS = SIZE * SIZE;
export const SIGNAL_AT = 0.9; // a block this bright is drawn in the signal colour

export type Grid = { v: number[] }; // 32 values 0..1, row-major over the left half

export function bytesOf(hash: string): number[] {
  const h = hash.replace(/^0x/, "").padEnd(64, "0").slice(0, 64);
  return Array.from({ length: 32 }, (_, i) => parseInt(h.slice(i * 2, i * 2 + 2), 16) || 0);
}

export const gridOf = (hash: string): Grid => ({ v: bytesOf(hash).map((b) => b / 255) });

/** A grid part-way between two grids. */
export function mixGrid(a: Grid, b: Grid, k: number): Grid {
  if (k <= 0) return a;
  if (k >= 1) return b;
  return { v: a.v.map((x, i) => x + (b.v[i] - x) * k) };
}

export type Cell = { i: number; x: number; y: number; v: number; sig: boolean };

/** The 64 blocks of a grid. `phase` moves a slow scan across the columns (the idle state); 0 is rest. */
export function cellsOf(g: Grid, phase = 0, amount = 0): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const u = c < HALF ? c : SIZE - 1 - c; // the right half reads the left half backwards
      const base = g.v[r * HALF + u];
      const v = amount ? Math.min(1, Math.max(0, base + amount * Math.sin(phase - c * 0.75 + r * 0.2))) : base;
      out.push({ i: r * SIZE + c, x: c, y: r, v, sig: base >= SIGNAL_AT });
    }
  }
  return out;
}

/** Hashes used only to draw an example when no chain exists yet. Always labelled as a sample on screen. */
export const SAMPLE_GENESIS = "0x1c4e8a52d97f03b6e1a8c25d4f70b93a6e2d815c07f4a9b3d68e12c5a7f0394d";
export const SAMPLE_HEAD = "0x7f3a91c5d2e84b60a1f9c3d7e5b28a4c6d0e1f93b7a25c84d6e9f01a3b5c7d29";
