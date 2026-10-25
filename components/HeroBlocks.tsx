"use client";
// The signature. The blocks on the home page are the real running hash of the chain that traded most recently. Scrolling the hero
// rewinds that chain trade by trade, and the blocks re-colour into the picture of each earlier hash. A new trade changes them live.
// One driver variable (pos.f, a fractional trade index) feeds the blocks, the card and the ruler, so they always agree.
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ease, prefersReducedMotion } from "@/engine";
import { usePage } from "@/engine/next";
import { gridOf, SAMPLE_HEAD } from "@/lib/blocks";
import { BlockView, watchBlocks } from "@/motion/blocks";
import type { HeroData, HeroState } from "@/lib/queries";
import { Blocks } from "./Blocks.tsx";

const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-4)}`;

type Ctl = { update: (d: HeroData | null) => void };

export function HeroBlocks({ data }: { data: HeroData | null }) {
  const root = useRef<HTMLElement>(null);
  const ctl = useRef<Ctl | null>(null);
  const states: HeroState[] = data?.states ?? [];
  const last = states[states.length - 1];
  const hash = last?.hash ?? SAMPLE_HEAD;
  const sym = data?.symbol ?? "";
  const pair = data?.pair ?? "";

  usePage(({ intro }) => {
    const el = root.current;
    const svg = el?.querySelector<SVGSVGElement>("svg.blocks");
    const heroEl = el?.closest<HTMLElement>("[data-hero]");
    if (!el || !svg || !heroEl) return;
    const view = new BlockView(svg);
    const unwatch = watchBlocks(view);
    let st: HeroState[] = states;
    let grids = st.map((s) => gridOf(s.hash));
    const pos = { f: Math.max(0, st.length - 1) };
    const field = (k: string) => el.querySelector<HTMLElement>(`[data-f="${k}"]`);
    let shownIdx = -1;

    const label = (near: number, force = false) => {
      const s = st[near];
      if (!s || (near === shownIdx && !force)) return;
      shownIdx = near;
      const t = field("trade");
      const a = field("amount");
      const h = field("head");
      if (t) t.textContent = `#${s.idx} ${s.buy ? "buy" : "sell"}`;
      if (a) a.textContent = `${s.tokens} ${sym} for ${s.quote} ${pair}`;
      if (h) h.textContent = shortHash(s.hash);
      el.querySelectorAll<HTMLElement>(".ruler i").forEach((tick, i) => {
        tick.classList.toggle("is-on", i === near);
        tick.classList.toggle("is-past", i > near);
      });
    };
    const apply = () => {
      const K = st.length;
      if (!K) return;
      const f = gsap.utils.clamp(0, K - 1, pos.f);
      const i = Math.floor(f);
      view.between(grids[i], grids[Math.min(K - 1, i + 1)], f - i);
      label(Math.round(f));
    };

    const scrub = heroEl.dataset.scrub === "1" && !prefersReducedMotion();
    const setF = gsap.quickTo(pos, "f", { duration: 0.8, ease: "power3.out", onUpdate: apply });
    const trig = ScrollTrigger.create({
      trigger: heroEl,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => { if (scrub && st.length > 1) setF((st.length - 1) * (1 - self.progress)); },
    });

    if (!prefersReducedMotion()) {
      // the blocks spawn outward from the seam
      intro.from(svg.querySelectorAll("rect.c"), { scale: 0, autoAlpha: 0, transformOrigin: "50% 50%", duration: 0.8, ease: ease.out, stagger: { each: 0.012, from: "center", grid: [8, 8] } }, 0.1);
      intro.from(el.querySelector(".label"), { autoAlpha: 0, y: 24, duration: 1, ease: ease.out }, 0.5);
      intro.from(el.querySelector(".ruler"), { autoAlpha: 0, duration: 0.8, ease: ease.out }, 0.8);
    }
    label(Math.max(0, st.length - 1), true);

    ctl.current = {
      update(d) {
        const prev = st[st.length - 1]?.hash;
        st = d?.states ?? [];
        grids = st.map((s) => gridOf(s.hash));
        const K = st.length;
        if (!K) return;
        const grew = st[K - 1].hash !== prev;
        if (trig.progress < 0.03 || !scrub) {
          pos.f = K - 1;
          if (grew) view.morphTo(st[K - 1].hash, 1.2);
          label(K - 1, true);
        } else {
          pos.f = (K - 1) * (1 - trig.progress);
          apply();
          label(Math.round(pos.f), true);
        }
      },
    };
    return () => {
      ctl.current = null;
      trig.kill();
      unwatch();
      view.destroy();
    };
  });

  useEffect(() => {
    ctl.current?.update(data);
  }, [data]);

  return (
    <figure className="hero__art" ref={root}>
      <Blocks hash={hash} label={data ? `A grid of blocks drawn from the running hash of ${data.symbol}, chain ${data.chainId}` : "A sample grid of blocks drawn from an example hash"} />
      <figcaption>
        <div className="label">
          <span className="no">{data ? `Chain ${data.chainId}` : "Sample, no chains yet"}</span>
          <span className="name">
            {data ? data.symbol : "Example"} <span>{data ? data.name : "Launch the first one"}</span>
          </span>
          <dl>
            <dt>Trade</dt>
            <dd data-f="trade">{last ? `#${last.idx} ${last.buy ? "buy" : "sell"}` : "none yet"}</dd>
            <dt>Amount</dt>
            <dd data-f="amount">{last ? `${last.tokens} ${sym} for ${last.quote} ${pair}` : "Waiting for a trade"}</dd>
            <dt>Head</dt>
            <dd data-f="head" className="data">
              {shortHash(hash)}
            </dd>
            <dt>Mirrors</dt>
            <dd>Pons, Robinhood Chain</dd>
          </dl>
        </div>
        {states.length > 1 && (
          <div className="ruler" aria-hidden="true" style={{ marginTop: 14 }}>
            {states.map((s, i) => (
              <i key={s.idx} className={i === states.length - 1 ? "is-on" : ""} />
            ))}
          </div>
        )}
      </figcaption>
    </figure>
  );
}
