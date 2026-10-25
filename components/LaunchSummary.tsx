"use client";
// The receipt beside the form: a preview of the token, the wallet, what this launch costs, and the chains this wallet has spawned.
import Link from "next/link";
import { connectWallet, ROBINHOOD_ID, shortAddr, switchToRobinhood, useWallet } from "@/lib/wallet";
import { costOf, eth, type Form, type WalletRead } from "@/lib/walletData";
import { EmptyBlocks } from "./Blocks.tsx";
import { BtnButton } from "./Btn.tsx";
import { Copy } from "./Copy.tsx";
import { toast } from "./Toast.tsx";

export function LaunchSummary({ f, wd }: { f: Form; wd: WalletRead }) {
  const w = useWallet();
  const { d, busy, err, reload } = wd;
  const wrong = !!w.account && w.chainId !== ROBINHOOD_ID;
  const cost = costOf(f, d);
  const logoOk = /^https:\/\//.test(f.logo.trim());

  return (
    <aside className="sum" aria-label="Launch summary">
      <div className="sum__sec sum__preview">
        <span className="sum__img" aria-hidden="true">{logoOk ? <img src={f.logo.trim()} alt="" width={64} height={64} /> : <EmptyBlocks size={64} />}</span>
        <div>
          <p className="k">Preview</p>
          <p className="sum__name">{f.name.trim() || "Token name"}</p>
          <p className="sum__sym data">{f.symbol.trim() || "SYMBOL"}</p>
        </div>
        {f.description.trim() && <p className="sum__desc muted">{f.description.trim()}</p>}
      </div>

      <div className="sum__sec">
        <p className="k">Wallet</p>
        {!w.account ? (
          <>
            <p className="muted small">Connect a wallet to see your balance and what this launch will cost.</p>
            <BtnButton
              small
              onClick={async () => {
                if (!w.providers.length) return toast("No wallet found in this browser. Install a wallet such as Rabby or MetaMask, then reload.");
                await connectWallet();
              }}
              disabled={w.connecting}
            >
              {w.connecting ? "Connecting…" : "Connect wallet"}
            </BtnButton>
          </>
        ) : (
          <dl className="rows">
            <div>
              <dt>Address</dt>
              <dd>
                <span className="data">{shortAddr(w.account)}</span>
                <Copy text={w.account} label="Copy" />
              </dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>
                {wrong ? (
                  <>
                    <span className="chip bad">Not Robinhood Chain</span>
                    <button type="button" className="mini" onClick={async () => { if (!(await switchToRobinhood())) toast("Could not switch. Add Robinhood Chain in your wallet."); }}>
                      Switch
                    </button>
                  </>
                ) : (
                  <span className="chip ok">Robinhood Chain</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Balance</dt>
              <dd>
                <b className="data">{d ? `${eth(cost.balance)} ETH` : busy ? "Reading…" : "unknown"}</b>
                <button type="button" className="mini" onClick={reload} disabled={busy}>
                  {busy ? "…" : "Refresh"}
                </button>
              </dd>
            </div>
            <div>
              <dt>Pons</dt>
              <dd>{d ? d.canLaunch ? <span className="chip ok">Allowed to launch</span> : <span className="chip bad">Not allowed right now</span> : "…"}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="sum__sec">
        <p className="k">This launch will cost</p>
        <dl className="rows">
          <div>
            <dt>Pons launch fee</dt>
            <dd className="data">{d ? `${eth(cost.fee)} ETH` : "…"}</dd>
          </div>
          <div>
            <dt>Your first buy</dt>
            <dd className="data">{cost.buy > 0n ? `${eth(cost.buy)} ETH` : "none"}</dd>
          </div>
          <div className="rows__total">
            <dt>Total</dt>
            <dd>
              <b className="data">{d ? `${eth(cost.total)} ETH` : "…"}</b>
              <span className="muted small">plus gas</span>
            </dd>
          </div>
          {w.account && d && (
            <div>
              <dt>Left after</dt>
              <dd className="data">{cost.short ? "not enough" : `${eth(cost.balance - cost.total)} ETH`}</dd>
            </div>
          )}
        </dl>
        {d?.capReason && <p className="sum__warn" role="alert">{d.capReason}</p>}
        {cost.short && <p className="sum__warn" role="alert">Not enough ETH on Robinhood Chain for this launch. Add funds to this wallet, or lower the first buy.</p>}
        {err && <p className="sum__warn" role="alert">{err}</p>}
      </div>

      {d && d.chains.length > 0 && (
        <div className="sum__sec">
          <p className="k">Your chains</p>
          <ul className="sum__chains">
            {d.chains.map((c) => (
              <li key={c.chainId}>
                <Link href={`/chain/${c.chainId}`} className="draw">
                  <b>{c.symbol}</b> <span className="muted">chain {c.chainId}, {c.count.toLocaleString()} trades</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
