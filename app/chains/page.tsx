import Link from "next/link";
import { BtnLink } from "@/components/Btn.tsx";
import { ChainIndex } from "@/components/ChainIndex.tsx";
import { chainRows } from "@/lib/queries.ts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chains", description: "Every token that has its own chain: the chain, how many trades it has mirrored, and when the last one landed." };

export default async function Chains({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = "", page = "0" } = await searchParams;
  const p = Math.max(0, Number(page) || 0);
  const per = 30;
  const list = chainRows(per + 1, p * per, q.trim());
  const more = list.length > per;
  const now = Math.floor(Date.now() / 1000);
  return (
    <div className="page wrap">
      <div className="page__head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Spawn</Link>
          <span>Chains</span>
        </nav>
        <h1 className="display" data-split="lines" data-intro>
          Chains
        </h1>
        <p className="lede" data-reveal="up" data-intro data-delay="0.25">
          Every token that has a chain, newest first. Point at a row to see the blocks its hash draws.
        </p>
      </div>
      <form className="searchbar" action="/chains" role="search">
        <label className="sr-only" htmlFor="q">
          Search chains
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="Name, symbol or token address" />
        <button className="btn btn--ghost" type="submit" data-fill>
          <span className="fill" aria-hidden="true" />
          Search
        </button>
      </form>
      <ChainIndex rows={list.slice(0, per)} now={now} />
      {(p > 0 || more) && (
        <div className="pager">
          {p > 0 ? <Link className="mini" href={`/chains?q=${encodeURIComponent(q)}&page=${p - 1}`}>Newer</Link> : <span />}
          {more && <Link className="mini" href={`/chains?q=${encodeURIComponent(q)}&page=${p + 1}`}>Older</Link>}
        </div>
      )}
      {list.length === 0 && !q && (
        <p style={{ marginTop: 20 }}>
          <BtnLink href="/launch">Launch the first one</BtnLink>
        </p>
      )}
    </div>
  );
}
