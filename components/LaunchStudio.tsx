"use client";
// The launch page body: the form on the left, a receipt on the right. They share the form's state and the wallet's numbers.
import { useEffect, useState } from "react";
import { EMPTY_FORM, type Form, useWalletData } from "@/lib/walletData";
import { initWallet, useWallet } from "@/lib/wallet";
import { LaunchForm } from "./LaunchForm.tsx";
import { LaunchSummary } from "./LaunchSummary.tsx";

export function LaunchStudio() {
  const [f, setF] = useState<Form>(EMPTY_FORM);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const w = useWallet();
  useEffect(() => { initWallet(); }, []);
  const wd = useWalletData(w.account);
  return (
    <div className="lgrid">
      <LaunchForm f={f} set={set} wd={wd} />
      <LaunchSummary f={f} wd={wd} />
    </div>
  );
}
