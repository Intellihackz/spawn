"use client";
// The form, in three short steps: the token, the first buy, the links. The button at the end says what will happen and what it costs.
import { useState } from "react";
import { connectWallet, ROBINHOOD_ID, switchToRobinhood, useWallet, walletRequest } from "@/lib/wallet";
import { costOf, eth, type Form, type WalletRead } from "@/lib/walletData";
import { BtnButton } from "./Btn.tsx";
import { toast } from "./Toast.tsx";

const BUYS = ["", "0.01", "0.05", "0.1"];

type Props = { f: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void; wd: WalletRead };

function Field({ name, hint, children }: { name: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="fld">
      <span className="fld__top">
        <span className="fld__name">{name}</span>
        {hint && <span className="fld__hint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function LaunchForm({ f, set, wd }: Props) {
  const w = useWallet();
  const [step, setStep] = useState<"idle" | "prepare" | "sign" | "wait" | "chain">("idle");
  const wrong = !!w.account && w.chainId !== ROBINHOOD_ID;
  const cost = costOf(f, wd.d);
  const blocked = !!w.account && !wrong && wd.d && wd.d.capReason ? "Spawn has no room for this wallet" : !!w.account && !wrong && wd.d && !wd.d.canLaunch ? "Pons is not letting this wallet launch" : cost.short ? "Not enough ETH for this launch" : null;
  const busy = step !== "idle";
  const label = !w.account
    ? "Connect wallet to launch"
    : wrong
      ? "Switch to Robinhood Chain"
      : blocked
        ? blocked
        : { idle: "Launch and spawn a chain", prepare: "Checking the launch…", sign: "Confirm in your wallet…", wait: "Waiting for Pons…", chain: "Spawning your chain…" }[step];

  async function go() {
    // step one is always the wallet: connect it, then be on Robinhood Chain, then launch
    if (!w.account) {
      if (!w.providers.length) return toast("No wallet found in this browser. Install a wallet such as Rabby or MetaMask, then reload.");
      await connectWallet();
      return;
    }
    if (wrong) {
      if (!(await switchToRobinhood())) toast("Could not switch. Add Robinhood Chain in your wallet.");
      return;
    }
    if (blocked) return;
    if (!f.name.trim() || !f.symbol.trim()) return toast("Give the token a name and a symbol.");
    try {
      setStep("prepare");
      const from = w.account;
      const r = await fetch("/api/launch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, name: f.name, symbol: f.symbol, description: f.description, logo: f.logo, socials: { twitter: f.twitter, telegram: f.telegram, website: f.website }, buybackEnabled: f.buyback, buyEth: f.buyEth }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error ?? "The launch would fail.");
      setStep("sign");
      const hash = (await walletRequest("eth_sendTransaction", [{ from, to: p.to, data: p.data, value: p.value }])) as string;
      setStep("wait");
      let chainId: number | null = null;
      for (let i = 0; i < 40 && chainId === null; i++) {
        await new Promise((res) => setTimeout(res, i === 0 ? 1500 : 3000));
        const reg = await fetch("/api/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ txHash: hash }) });
        const d = await reg.json();
        if (reg.ok) chainId = d.chainId;
        else if (reg.status !== 404) throw new Error(d.error ?? "Could not give it a chain.");
      }
      if (chainId === null) throw new Error("The launch went through, but Pons has not confirmed it yet. Check the chains page in a minute: it will appear there.");
      setStep("chain");
      toast("Launched. Your chain is spawning.");
      window.location.href = `/chain/${chainId}`;
    } catch (err) {
      setStep("idle");
      toast(((err as { shortMessage?: string }).shortMessage ?? (err as Error).message) || "That did not work.");
    }
  }

  const logoOk = /^https:\/\//.test(f.logo.trim());
  return (
    <form
      className="lf"
      onSubmit={(e) => {
        e.preventDefault();
        void go();
      }}
      noValidate
    >
      <section className="lf__sec">
        <header>
          <span className="n">1</span>
          <div>
            <h2>The token</h2>
            <p className="muted">What people will see on Pons.</p>
          </div>
        </header>
        <div className="fld-row">
          <Field name="Name" hint="required">
            <input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={40} placeholder="Example Coin" autoComplete="off" />
          </Field>
          <Field name="Symbol" hint="required">
            <input value={f.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={12} placeholder="EXMPL" autoComplete="off" spellCheck={false} />
          </Field>
        </div>
        <Field name="Description" hint={`${f.description.length}/600`}>
          <textarea value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={600} rows={3} placeholder="One or two lines about the token." />
        </Field>
        <Field name="Image link" hint="optional, a square image">
          <span className="fld__img">
            <input value={f.logo} onChange={(e) => set("logo", e.target.value)} placeholder="https:// or ipfs://" spellCheck={false} autoComplete="off" />
            {logoOk && <img src={f.logo.trim()} alt="" width={52} height={52} />}
          </span>
        </Field>
      </section>

      <section className="lf__sec">
        <header>
          <span className="n">2</span>
          <div>
            <h2>Your first buy</h2>
            <p className="muted">Optional. You buy at the launch price, in the same transaction.</p>
          </div>
        </header>
        <div className="opts" role="group" aria-label="First buy amount">
          {BUYS.map((v) => (
            <button key={v || "none"} type="button" className="opt" aria-pressed={f.buyEth === v} onClick={() => set("buyEth", v)}>
              {v ? `${v} ETH` : "None"}
            </button>
          ))}
          <label className="opt opt--input">
            <span className="sr-only">Custom amount in ETH</span>
            <input
              value={BUYS.includes(f.buyEth) ? "" : f.buyEth}
              onChange={(e) => set("buyEth", e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="Custom"
              aria-label="Custom amount in ETH"
            />
            <span aria-hidden="true">ETH</span>
          </label>
        </div>
        <label className="switch">
          <input type="checkbox" role="switch" checked={f.buyback} onChange={(e) => set("buyback", e.target.checked)} />
          <span className="switch__track" aria-hidden="true" />
          <span>
            <b>Buy the token back with trading fees</b>
            <span className="muted">A Pons feature: part of the fees from trading go to buying the token.</span>
          </span>
        </label>
      </section>

      <section className="lf__sec">
        <header>
          <span className="n">3</span>
          <div>
            <h2>Links</h2>
            <p className="muted">Optional. Shown on the token&apos;s Pons page.</p>
          </div>
        </header>
        <div className="fld-row fld-row--3">
          <Field name="X">
            <input value={f.twitter} onChange={(e) => set("twitter", e.target.value)} placeholder="https://x.com/…" spellCheck={false} />
          </Field>
          <Field name="Telegram">
            <input value={f.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="https://t.me/…" spellCheck={false} />
          </Field>
          <Field name="Website">
            <input value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" spellCheck={false} />
          </Field>
        </div>
      </section>

      <div className="lf__go">
        <BtnButton type="submit" disabled={w.connecting || busy || (!!blocked && !wrong && !!w.account)}>
          {label}
        </BtnButton>
        <p className="muted small">
          {w.account && wd.d ? (
            <>
              Total <b className="data">{eth(cost.total)} ETH</b> plus network gas.{" "}
            </>
          ) : null}
          Pons charges its own launch fee. Spawn takes nothing and never holds your funds.
        </p>
      </div>
    </form>
  );
}
