// A hash drawn as blocks. Server-safe: no hooks, no DOM. The browser can take over its rects (motion/blocks.ts) and animate them.
import { cellsOf, gridOf, SIZE } from "@/lib/blocks.ts";
import type { CSSProperties } from "react";

const PAD = 0.1;

export function Blocks({ hash, size, className = "", label, seam = true }: { hash: string; size?: number; className?: string; label?: string; seam?: boolean }) {
  const cells = cellsOf(gridOf(hash));
  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${SIZE + PAD * 2} ${SIZE + PAD * 2}`}
      width={size}
      height={size}
      className={`blocks ${className}`}
      data-hash={hash}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {cells.map((c) => (
        <rect key={c.i} className={c.sig ? "c sig" : "c"} data-i={c.i} x={c.x + 0.05} y={c.y + 0.05} width={0.9} height={0.9} style={{ "--v": c.v.toFixed(3) } as CSSProperties} />
      ))}
      {seam && <line className="seam" x1={SIZE / 2} y1={-PAD} x2={SIZE / 2} y2={SIZE + PAD} />}
    </svg>
  );
}

/** An empty frame: the grid a chain has before its first trade. */
export function EmptyBlocks({ size, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox={`${-PAD} ${-PAD} ${SIZE + PAD * 2} ${SIZE + PAD * 2}`} width={size} height={size} className={`blocks blocks--empty ${className}`} aria-hidden="true">
      {Array.from({ length: SIZE * SIZE }, (_, i) => (
        <rect key={i} className="c" x={(i % SIZE) + 0.05} y={Math.floor(i / SIZE) + 0.05} width={0.9} height={0.9} />
      ))}
      <line className="seam" x1={SIZE / 2} y1={-PAD} x2={SIZE / 2} y2={SIZE + PAD} />
    </svg>
  );
}
