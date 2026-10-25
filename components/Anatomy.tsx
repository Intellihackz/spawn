"use client";
// How a chain is spawned, as a sticky narrative: the picture on the left changes state with the chapter on the right.
// an empty frame, then the chain's starting hash, then the grown chain, then the grid with Pons's rebuild laid over it.
import { useRef } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePage } from "@/engine/next";
import { BlockView, watchBlocks } from "@/motion/blocks";
import { Blocks, EmptyBlocks } from "./Blocks.tsx";

type Props = { genesis: string; head: string; label: string; count: number | null };

export function Anatomy({ genesis, head, label, count }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const caps = [
    "Before the first trade the frame is empty.",
    `${label} at its start, drawn from a hash of the token and its curve.`,
    count ? `${label} after ${count.toLocaleString()} trades. Every trade changed the hash, so the blocks changed too.` : `${label} after its trades.`,
    "Rebuilt from Pons (outlined) over the chain's own hash. Same hash, same blocks.",
  ];

  usePage(() => {
    const el = root.current;
    const svg = el?.querySelector<SVGSVGElement>('[data-layer="grid"] svg.blocks');
    if (!el || !svg) return;
    const view = new BlockView(svg);
    const unwatch = watchBlocks(view);
    const chapters = [...el.querySelectorAll<HTMLElement>("[data-chapter]")];
    const cap = el.querySelector<HTMLElement>("[data-cap]");
    const set = (i: number) => {
      if (el.dataset.state === String(i)) return;
      el.dataset.state = String(i);
      chapters.forEach((c, k) => c.classList.toggle("is-on", k === i));
      if (cap) cap.textContent = caps[i];
      if (i === 1) view.morphTo(genesis, 0.9);
      if (i >= 2) view.morphTo(head, 1.2);
    };
    chapters[0]?.classList.add("is-on");
    const last = chapters.length - 1;
    // onLeave covers a jump (a reload or back navigation far down the page): passing a chapter sets the next one, and the last chapter holds
    const triggers = chapters.map((ch, i) => ScrollTrigger.create({ trigger: ch, start: "top 58%", end: "bottom 58%", onToggle: (s) => { if (s.isActive) set(i); }, onLeave: () => set(Math.min(i + 1, last)) }));
    return () => {
      triggers.forEach((t) => t.kill());
      unwatch();
      view.destroy();
    };
  });

  return (
    <div className="anatomy" data-state="0" ref={root}>
      <div className="anatomy__stage">
        <div className="anatomy__fig" role="img" aria-label="A grid of blocks that changes as the chapters beside it are read">
          <div data-layer="empty">
            <EmptyBlocks />
          </div>
          <div data-layer="grid">
            <Blocks hash={genesis} />
          </div>
          <div data-layer="proof">
            <Blocks hash={head} className="blocks--proof" seam={false} />
          </div>
        </div>
        <p className="anatomy__cap" data-cap aria-live="off">
          {caps[0]}
        </p>
      </div>
      <div className="anatomy__chapters">
        <article className="chapter" data-chapter>
          <span className="n">1</span>
          <h3>Launch on Pons.</h3>
          <p>Your wallet calls Pons directly. Spawn builds the call and checks it first, but it never holds your funds.</p>
        </article>
        <article className="chapter" data-chapter>
          <span className="n">2</span>
          <h3>A chain spawns.</h3>
          <p>Spawn starts a chain with its own id and a small ledger. The ledger begins from a hash of your token and its curve, so it cannot be reused for another token.</p>
          <p className="formula">keccak256(&quot;spawn&quot;, token, curve)</p>
        </article>
        <article className="chapter" data-chapter>
          <span className="n">3</span>
          <h3>Every trade extends the hash.</h3>
          <p>Each Pons trade is copied onto the chain. Its hash is the hash of the one before it, plus the trade itself. Change any old trade and every hash after it changes, and so does the picture.</p>
          <p className="formula">keccak256(previous, txHash, logIndex, side, wallet, quote, tokens)</p>
        </article>
        <article className="chapter" data-chapter>
          <span className="n">4</span>
          <h3>Anyone can rebuild it.</h3>
          <p>The verify page reads the trades straight from Pons, rebuilds the hash and compares it with the chain. When the two are equal, the blocks match cell for cell.</p>
        </article>
      </div>
    </div>
  );
}
