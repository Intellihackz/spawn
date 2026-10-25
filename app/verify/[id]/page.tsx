import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Blocks, EmptyBlocks } from "@/components/Blocks.tsx";
import type { ChainRow } from "@/lib/db.ts";
import { ago } from "@/lib/format.ts";
import { ipFromHeaders, limited } from "@/lib/limit.ts";
import { PONS } from "@/lib/pons.ts";
import { chainFor } from "@/lib/queries.ts";
import { verifyChain } from "@/lib/verify.ts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify", description: "Rebuild a chain's running hash straight from the Pons logs and compare it with the chain, with the three pictures side by side." };

// The check reads every trade from Pons, which takes a moment. The page shell streams at once; the verdict fills in when it is ready.
async function Result({ chain: c, throttled }: { chain: ChainRow; throttled: boolean }) {
  let v;
  try {
    if (throttled) throw new Error("Too many checks from this address. Wait a minute and reload.");
    v = await verifyChain(c);
  } catch (e) {
    return (
      <div className="verdict wait" role="status">
        <h2 className="display">
          The check <span>did not run.</span>
        </h2>
        <p>{(e as Error).message}</p>
      </div>
    );
  }
  return (
    <>
      <div className={`verdict ${v.ok ? "ok" : "bad"}`}>
        <h2 className="display">
          The mirror <span>{v.ok ? "matches Pons." : "does not match Pons."}</span>
        </h2>
        <p>
          {v.ok
            ? `All ${v.mirrored.toLocaleString()} mirrored trades were rebuilt from the Pons logs just now, and the hash on the chain is the same.`
            : `${v.reason}. Pons shows ${v.ponsTrades.toLocaleString()} trades, the mirror has ${v.mirrored.toLocaleString()}.`}
        </p>
      </div>
      <div className="trio">
        <figure>
          <Blocks hash={v.expectedHead} label="Blocks drawn from the hash rebuilt from Pons" />
          <figcaption>
            <b>Rebuilt from Pons</b>
            {v.ponsTrades.toLocaleString()} trades read from the logs
            <span className="mono">{v.expectedHead}</span>
          </figcaption>
        </figure>
        <figure>
          <Blocks hash={v.storedHead ?? v.expectedHead} label="Blocks drawn from the hash Spawn stored" />
          <figcaption>
            <b>Stored by Spawn</b>
            {v.mirrored.toLocaleString()} trades in the database
            <span className="mono">{v.storedHead}</span>
          </figcaption>
        </figure>
        <figure>
          {v.ledgerHead ? <Blocks hash={v.ledgerHead} label="Blocks drawn from the hash read from the chain" /> : <EmptyBlocks />}
          <figcaption>
            <b>Read from the chain</b>
            {v.ledgerHead ? "the ledger's own head" : "the chain did not answer"}
            <span className="mono">{v.ledgerHead ?? ""}</span>
          </figcaption>
        </figure>
      </div>
      <p className="muted small" style={{ marginBottom: 40 }}>
        Checked {ago(v.checkedAt)}. The pictures are drawn from the hashes, so equal hashes draw equal blocks. The hashes are the proof; the blocks just make a match, or a mismatch, easy to see.
      </p>
    </>
  );
}

export default async function Verify({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const c = chainFor(id);
  if (!c || c.status !== "live") notFound();
  const throttled = limited("verifypage:" + ipFromHeaders(await headers()), 20, 60_000);
  return (
    <div className="page wrap">
      <div className="page__head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/chains">Chains</Link>
          <Link href={`/chain/${id}`}>{c.symbol}</Link>
          <span>Verify</span>
        </nav>
        <h1 className="display" data-split="lines" data-intro>
          Verify {c.symbol}
        </h1>
        <p className="lede" data-reveal="up" data-intro data-delay="0.2">
          Every trade is read from Pons, the hash is rebuilt, and the result is compared with the chain.
        </p>
      </div>
      <Suspense
        fallback={
          <>
            <div className="verdict wait" role="status">
              <h2 className="display">
                The mirror <span>is being checked.</span>
              </h2>
              <p>Reading all {c.count.toLocaleString()} trades from the Pons logs, rebuilding the hash and comparing it with the chain.</p>
            </div>
            <div className="trio" aria-hidden="true">
              {["Rebuilt from Pons", "Stored by Spawn", "Read from the chain"].map((t) => (
                <figure key={t}>
                  <EmptyBlocks />
                  <figcaption>
                    <b>{t}</b>
                    Waiting for the result
                    <span className="mono" style={{ visibility: "hidden" }}>{"0x" + "0".repeat(64)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="muted small" style={{ marginBottom: 40 }}>
              Checking.
            </p>
          </>
        }
      >
        <Result chain={c} throttled={throttled} />
      </Suspense>

      <h2 className="display display--m" style={{ fontSize: "var(--t-l)", marginBottom: 14 }}>
        Check it yourself
      </h2>
      <p className="muted" style={{ maxWidth: "62ch", marginBottom: 14 }}>
        Do not trust this page. Read the trades straight from the Pons chain and rebuild the hash with the same rule:
      </p>
      <ol className="steps" style={{ marginBottom: 20 }}>
        <li>
          Start from <code>keccak256(abi.encode(&quot;spawn&quot;, token, curve))</code>.
        </li>
        <li>
          For each <code>CurveBuy</code> or <code>CurveSell</code> log from the curve, in chain order, set the hash to{" "}
          <code>keccak256(abi.encode(previousHash, txHash, logIndex, side, wallet, quote, tokens))</code>, where side is 1 for a buy and 0 for a sell.
        </li>
        <li>The last hash is the head. It should equal the head on this chain&apos;s ledger.</li>
      </ol>
      <pre>{`# the trades, from Pons (curve ${c.curve})
cast logs --rpc-url ${PONS.rpc} \\
  --address ${c.curve} \\
  --from-block ${c.launch_block} \\
  "CurveBuy(address,address,uint256,uint256,uint256,uint256)"

# the head this chain reports
cast call ${c.ledger} "head()(bytes32)" --rpc-url <this site>/rpc/${id}`}</pre>
      <p className="muted small" style={{ margin: "12px 0 40px" }}>
        The same rule is written in the open: the ledger contract and the hashing code are in the Spawn repository.
      </p>
    </div>
  );
}
