// The browser side of the blocks: morphing between hashes, and the scan (the slow light that moves across every visible grid at rest).
// One clock: everything runs on gsap.ticker.
import { gsap } from 'gsap';
import { cellsOf, gridOf, mixGrid, type Grid } from '@/lib/blocks';
import { ease, isTouch, onScroll, prefersReducedMotion } from '@/engine';

export class BlockView {
  readonly svg: SVGSVGElement;
  private rects: SVGRectElement[] = [];
  shown: Grid;
  hash: string;
  visible = true;
  private tween: gsap.core.Tween | null = null;
  constructor(svg: SVGSVGElement) {
    this.svg = svg;
    svg.querySelectorAll<SVGRectElement>('rect.c[data-i]').forEach((r) => { this.rects[Number(r.dataset.i)] = r; });
    this.hash = svg.dataset.hash || '0x';
    this.shown = gridOf(this.hash);
  }
  /** Draw the shown grid, with the scan on top. */
  draw(phase = scan.phase, amount = scan.amount) {
    for (const c of cellsOf(this.shown, phase, amount)) {
      const r = this.rects[c.i];
      if (!r) continue;
      r.style.setProperty('--v', c.v.toFixed(3));
      r.classList.toggle('sig', c.sig);
    }
  }
  /** Re-crystallise into another hash. A quick re-aim starts from whatever is on screen. */
  morphTo(hash: string, duration = 1.1) {
    if (hash === this.hash) return;
    this.hash = hash;
    this.svg.dataset.hash = hash;
    const from = this.shown;
    const to = gridOf(hash);
    this.tween?.kill();
    if (prefersReducedMotion() || duration <= 0) {
      this.shown = to;
      this.draw();
      return;
    }
    const k = { v: 0 };
    this.tween = gsap.to(k, { v: 1, duration, ease: ease.out, onUpdate: () => { this.shown = mixGrid(from, to, k.v); this.draw(); } });
  }
  /** Show a grid part-way between two grids (scroll-driven), with no tween of its own. */
  between(a: Grid, b: Grid, k: number) {
    this.tween?.kill();
    this.hash = ''; // the shown grid no longer belongs to one hash
    this.shown = mixGrid(a, b, k);
    this.draw();
  }
  destroy() { this.tween?.kill(); scan.views.delete(this); }
}

/** The scan: a slow wave of brightness crosses every registered visible grid, and leans toward the pointer. */
export const scan = { phase: 0, amount: 0.09, px: 0, views: new Set<BlockView>() };
let started = false;

export function startScan() {
  if (started || prefersReducedMotion()) return;
  started = true;
  const touch = isTouch();
  let aim = 0;
  if (touch) onScroll(({ velocity }) => { aim = gsap.utils.clamp(-0.6, 0.6, velocity / 50); });
  else addEventListener('pointermove', (e) => { aim = e.clientX / innerWidth - 0.5; }, { passive: true });
  gsap.ticker.add((t) => {
    const r = gsap.ticker.deltaRatio();
    scan.px += (aim - scan.px) * (1 - Math.pow(0.94, r));
    if (touch) aim *= Math.pow(0.92, r);
    scan.phase = t * 1.1 + scan.px * 3; // a slow wave, a little faster toward the pointer's side
    for (const v of scan.views) if (v.visible) v.draw(scan.phase, scan.amount);
  });
}

/** Register a grid for the scan. It only redraws while it is on screen. */
export function watchBlocks(view: BlockView): () => void {
  scan.views.add(view);
  const io = new IntersectionObserver((e) => { view.visible = e[0]?.isIntersecting ?? true; });
  io.observe(view.svg as unknown as Element);
  return () => { io.disconnect(); scan.views.delete(view); };
}
