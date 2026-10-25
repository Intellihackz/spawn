"use client";
// The header's wallet control: connect (with a picker when several wallets are installed), then the address, the network, and a menu.
import { useEffect, useRef, useState } from "react";
import { connectWallet, disconnectWallet, initWallet, ROBINHOOD_ID, shortAddr, switchToRobinhood, useWallet } from "@/lib/wallet";
import { toast } from "./Toast.tsx";

export function WalletButton() {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { initWallet(); }, []);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("spawn:wallet-menu", show);
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("pointerdown", away);
    addEventListener("keydown", esc);
    return () => { window.removeEventListener("spawn:wallet-menu", show); removeEventListener("pointerdown", away); removeEventListener("keydown", esc); };
  }, []);

  const wrong = w.account && w.chainId !== ROBINHOOD_ID;

  async function primary() {
    if (w.account) return setOpen((o) => !o);
    if (!w.providers.length) return toast("No wallet found in this browser. Install a wallet such as Rabby or MetaMask, then reload.");
    if (w.providers.length > 1) return setOpen((o) => !o);
    if (!(await connectWallet())) toast("The wallet did not connect.");
  }

  return (
    <div className="wallet" ref={box}>
      <button type="button" className={`mini wallet__btn${w.account ? " is-on" : ""}${wrong ? " is-wrong" : ""}`} onClick={primary} aria-haspopup="menu" aria-expanded={open} disabled={w.connecting}>
        {w.connecting ? "Connecting…" : w.account ? <><span className="wallet__dot" aria-hidden="true" />{shortAddr(w.account)}{wrong && <span className="wlong"> wrong network</span>}</> : <>Connect<span className="wlong"> wallet</span></>}
      </button>
      {open && (
        <div className="wallet__menu" role="menu">
          {!w.account &&
            w.providers.map((p) => (
              <button key={p.uuid} type="button" role="menuitem" onClick={async () => { setOpen(false); if (!(await connectWallet(p))) toast("The wallet did not connect."); }}>
                {p.icon ? <img src={p.icon} alt="" width={20} height={20} /> : <span className="wallet__ph" aria-hidden="true" />}
                {p.name}
              </button>
            ))}
          {w.account && (
            <>
              <p className="muted small" style={{ padding: "8px 12px 4px" }}>
                {w.active?.name} on {w.chainId === ROBINHOOD_ID ? "Robinhood Chain" : `chain ${w.chainId}`}
              </p>
              {wrong && (
                <button type="button" role="menuitem" onClick={async () => { setOpen(false); if (!(await switchToRobinhood())) toast("Could not switch. Add Robinhood Chain in your wallet."); }}>
                  Switch to Robinhood Chain
                </button>
              )}
              <button type="button" role="menuitem" onClick={() => { navigator.clipboard?.writeText(w.account!); setOpen(false); toast("Address copied."); }}>
                Copy address
              </button>
              <button type="button" role="menuitem" onClick={() => { disconnectWallet(); setOpen(false); }}>
                Disconnect
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
