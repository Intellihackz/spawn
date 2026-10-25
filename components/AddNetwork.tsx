"use client";
import { useState } from "react";
import { useEffect } from "react";
import { connectWallet, initWallet, walletRequest, walletState } from "@/lib/wallet";

export function AddNetwork({ chainId, symbol }: { chainId: number; symbol: string }) {
  const [msg, setMsg] = useState("");
  useEffect(() => { initWallet(); }, []);
  async function add() {
    try {
      // this button is reachable without the header wallet, so it connects on demand
      if (!walletState().account) {
        const first = walletState().providers[0];
        if (!first) return setMsg("No wallet found in this browser.");
        if (!(await connectWallet(first))) return setMsg("The wallet did not connect.");
      }
      await walletRequest("wallet_addEthereumChain", [
          {
            chainId: "0x" + chainId.toString(16),
            chainName: `Spawn ${symbol} (${chainId})`,
            nativeCurrency: { name: "Spawn", symbol: "SPWN", decimals: 18 },
            rpcUrls: [`${location.origin}/rpc/${chainId}`],
            blockExplorerUrls: [`${location.origin}/chain/${chainId}`],
          },
      ]);
      setMsg("Added. It holds a record, not funds.");
    } catch (e) {
      setMsg((e as { message?: string }).message ?? "The wallet said no.");
    }
  }
  return (
    <span className="addnet">
      <button type="button" className="mini" onClick={add}>
        Add network to wallet
      </button>
      {msg && <span className="muted"> {msg}</span>}
    </span>
  );
}
