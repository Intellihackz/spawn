import { Anatomy } from "@/components/Anatomy.tsx";
import { BtnLink } from "@/components/Btn.tsx";
import { HeroBlocks } from "@/components/HeroBlocks.tsx";
import { LiveRefresh } from "@/components/LiveRefresh.tsx";
import { ChainIndex } from "@/components/ChainIndex.tsx";
import { Ticker } from "@/components/Ticker.tsx";
import { VerifyBadge } from "@/components/VerifyBadge.tsx";
import { SAMPLE_GENESIS, SAMPLE_HEAD } from "@/lib/blocks.ts";
import { chainRows, feedInitial, featured, stats } from "@/lib/queries.ts";

export const dynamic = "force-dynamic";

export default function Home() {
  const s = stats();
  const hero = featured();
  const rows = chainRows(8);
  const now = Math.floor(Date.now() / 1000);
  const K = hero?.states.length ?? 0;
  return (
    <>
      <LiveRefresh every={8000} />
      <section className={`hero${K > 1 ? "" : " hero--still"}`} data-hero data-scrub={K > 1 ? "1" : "0"}>
        <div className="hero__stage">
          <div className="hero__copy">
            <h1 className="display" data-split="lines" data-intro>
              Every launch spawns its own chain.
            </h1>
            <p className="lede" data-reveal="up" data-intro data-delay="0.3">
              Launch a token on Pons through Spawn and a chain spawns for it. Every trade is mirrored onto it, and anyone can rebuild the hash from Pons to check.
            </p>
            <div className="actions" data-reveal="up" data-intro data-delay="0.45">
              <BtnLink href="/launch">Launch a token</BtnLink>
              <BtnLink href="/chains" variant="ghost">
                Browse chains
              </BtnLink>
            </div>
          </div>
          <HeroBlocks data={hero} />
          {K > 1 && <p className="hero__hint">Scroll to rewind the last {K} trades of {hero!.symbol}</p>}
        </div>
      </section>

      <section className="section" id="chains">
        <div className="wrap">
          <div className="head">
            <h2 className="display display--m">Chains</h2>
            <p className="count">
              {s.live} live, {s.trades.toLocaleString()} trades mirrored
            </p>
          </div>
          <div className="cabinet">
            <div>
              <ChainIndex rows={rows} now={now} />
              <p className="pager" style={{ justifyContent: "flex-start" }}>
                <BtnLink href="/chains" variant="ghost" small>
                  All chains
                </BtnLink>
              </p>
            </div>
            <aside className="tape" aria-label="Latest trades">
              <h3>Latest trades</h3>
              <Ticker initial={feedInitial()} />
            </aside>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap g12 statement-grid">
          <p className="statement" data-split="lines">
            Pons settles every trade. A chain <em>copies it</em> and hashes it onto the trade before. Nothing here moves money.
          </p>
          <aside className="proof" data-reveal="up">
            {hero ? (
              <>
                <VerifyBadge chainId={hero.chainId} />
                <p>
                  This is a live check of {hero.symbol}, chain {hero.chainId}. It rebuilds every trade from Pons and compares the result with the chain.
                </p>
              </>
            ) : (
              <p>Launch a token and its check runs here: every trade rebuilt from Pons and compared with the chain.</p>
            )}
          </aside>
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <div className="head">
            <h2 className="display display--m">How a chain is spawned</h2>
          </div>
          <Anatomy
            genesis={hero?.genesis ?? SAMPLE_GENESIS}
            head={hero?.head ?? SAMPLE_HEAD}
            label={hero ? hero.symbol : "A sample chain"}
            count={hero ? hero.count : null}
          />
        </div>
      </section>
    </>
  );
}
