"use client";
// Every chain as a row. On a fine pointer a large grid follows the cursor and re-colours into the hovered chain's picture.
// On touch each row carries its own small grid instead. Rows use the fill.
import Link from "next/link";
import { useRef } from "react";
import { gsap } from "gsap";
import { ease, isTouch, onScroll, prefersReducedMotion } from "@/engine";
import { usePage } from "@/engine/next";
import { BlockView, watchBlocks } from "@/motion/blocks";
import { ago } from "@/lib/format.ts";
import { Blocks } from "./Blocks.tsx";

export type IndexRow = { n: number; chainId: number; symbol: string; name: string; count: number; lastAt: number | null; hash: string; live: boolean };

export function ChainIndex({ rows, now }: { rows: IndexRow[]; now: number }) {
  const list = useRef<HTMLUListElement>(null);
  const box = useRef<HTMLDivElement>(null);

  usePage(() => {
    const ul = list.current;
    const bx = box.current;
    const svg = bx?.querySelector<SVGSVGElement>("svg.blocks");
    if (!ul || !bx || !svg || isTouch()) return;
    const view = new BlockView(svg);
    const unwatch = watchBlocks(view);
    view.visible = true;
    const x = gsap.quickTo(bx, "x", { duration: 0.6, ease: "power3.out" });
    const y = gsap.quickTo(bx, "y", { duration: 0.6, ease: "power3.out" });
    const rot = gsap.quickTo(bx, "rotate", { duration: 0.8, ease: "power3.out" });
    let lastX = 0, px = 0, py = 0;
    const move = (e: PointerEvent) => {
      px = e.clientX; py = e.clientY;
      x(px + 40); y(py); rot(gsap.utils.clamp(-10, 10, (px - lastX) * 0.5)); lastX = px;
    };
    const show = (e: Event) => {
      const a = e.currentTarget as HTMLElement;
      view.morphTo(a.dataset.hash ?? "", 0.9);
      gsap.to(bx, { autoAlpha: 1, scale: 1, duration: 0.5, ease: ease.out, overwrite: "auto" });
    };
    const hide = () => { gsap.to(bx, { autoAlpha: 0, scale: 0.85, duration: 0.4, ease: ease.out, overwrite: "auto" }); };
    const links = ul.querySelectorAll<HTMLAnchorElement>("a[data-hash]");
    links.forEach((a) => { a.addEventListener("pointerenter", show); a.addEventListener("focus", show); a.addEventListener("blur", hide); });
    ul.addEventListener("pointerleave", hide);
    addEventListener("pointermove", move, { passive: true });
    // pointerleave never fires when the page scrolls out from under a still pointer: check on scroll
    const off = onScroll(() => { if (!ul.contains(document.elementFromPoint(px, py))) hide(); });
    gsap.set(bx, { autoAlpha: 0, scale: 0.85 });
    return () => {
      removeEventListener("pointermove", move);
      off();
      unwatch();
      view.destroy();
    };
  });

  if (!rows.length) return <p className="empty">No chains yet. Launch the first one.</p>;
  return (
    <>
      <ul className="index" ref={list} data-index>
        {rows.map((r) => (
          <li key={r.n}>
            <Link href={`/chain/${r.chainId}`} className="row" data-fill data-hash={r.hash}>
              <span className="fill" aria-hidden="true" />
              <span className="row__art">
                <Blocks hash={r.hash} size={56} seam={false} />
              </span>
              <span className="row__name">
                <b>{r.symbol}</b>
                <span>{r.name.length > 30 ? r.name.slice(0, 29) + "…" : r.name}, chain {r.chainId}</span>
              </span>
              <span className="row__meta">
                <b>{r.count.toLocaleString()}</b>trades
              </span>
              <span className="row__meta row__meta--last">
                <b>{r.live ? (r.lastAt ? ago(r.lastAt, now) : "waiting") : "starting"}</b>last trade
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="preview" ref={box} aria-hidden="true">
        <Blocks hash={rows[0].hash} />
      </div>
    </>
  );
}
