"use client";
// The explorer's picture. On a wide screen the blocks follow the trade you are reading: the row nearest the reading line decides
// which hash they are drawn from, and they re-colour as you scroll the ledger.
import { useRef } from "react";
import { onScroll } from "@/engine";
import { usePage } from "@/engine/next";
import { BlockView, watchBlocks } from "@/motion/blocks";
import { short } from "@/lib/format.ts";
import { Blocks } from "./Blocks.tsx";

export function ChainPicture({ hash, symbol, chainId, count }: { hash: string; symbol: string; chainId: number; count: number }) {
  const root = useRef<HTMLDivElement>(null);

  usePage(() => {
    const el = root.current;
    const svg = el?.querySelector<SVGSVGElement>("svg.blocks");
    if (!el || !svg) return;
    const view = new BlockView(svg);
    const unwatch = watchBlocks(view);
    const nowIdx = el.querySelector<HTMLElement>("[data-now-idx]");
    const nowHash = el.querySelector<HTMLElement>("[data-now-hash]");
    const wide = matchMedia("(min-width: 900px)");
    let rows: HTMLElement[] = [];
    let current: HTMLElement | null = null;
    const collect = () => { rows = [...document.querySelectorAll<HTMLElement>("tr[data-hash]")]; };
    collect();
    const follow = () => {
      if (!wide.matches || !rows.length) return;
      const line = innerHeight * 0.42;
      let best: HTMLElement | null = null;
      let bestD = Infinity;
      for (const r of rows) {
        const b = r.getBoundingClientRect();
        if (b.bottom < 0 || b.top > innerHeight) continue;
        const d = Math.abs((b.top + b.bottom) / 2 - line);
        if (d < bestD) { bestD = d; best = r; }
      }
      if (!best || best === current) return;
      current?.classList.remove("is-reading");
      best.classList.add("is-reading");
      current = best;
      view.morphTo(best.dataset.hash ?? "", 0.8);
      if (nowIdx) nowIdx.textContent = `#${best.dataset.idx}`;
      if (nowHash) nowHash.textContent = short(best.dataset.hash ?? "", 8, 4);
    };
    const off = onScroll(follow);
    return () => {
      off();
      current?.classList.remove("is-reading");
      unwatch();
      view.destroy();
    };
  });

  return (
    <div className="specimen__art" ref={root}>
      <Blocks hash={hash} label={`A grid of blocks drawn from the running hash of ${symbol}, chain ${chainId}`} />
      <p className="specimen__now">
        <span>
          {count > 0 ? (
            <>
              Reading trade <b data-now-idx>#{count}</b>
            </>
          ) : (
            "No trades yet"
          )}
        </span>
        <b className="data" data-now-hash>
          {short(hash, 8, 4)}
        </b>
      </p>
    </div>
  );
}
