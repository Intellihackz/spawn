// The visitor's wallet, shared by the whole app: one connection, shown in the header and used by the launch and claim forms.
// Wallets announce themselves with EIP-6963 (MetaMask, Rabby, Coinbase Wallet and others), with window.ethereum as a fallback.
// Injected wallets only: nothing here holds a key, and Spawn never sees one.
import { useSyncExternalStore } from "react";

export type Eip1193 = {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, fn: (...args: unknown[]) => void) => void;
};
export type Found = { uuid: string; name: string; icon: string; rdns: string; provider: Eip1193 };
export type WalletState = { providers: Found[]; active: Found | null; account: string | null; chainId: number | null; connecting: boolean; ready: boolean };

export const ROBINHOOD_ID = 4663;
const ROBINHOOD = { chainId: "0x" + ROBINHOOD_ID.toString(16), chainName: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"] };
const KEY = "spawn:wallet";

const SERVER: WalletState = { providers: [], active: null, account: null, chainId: null, connecting: false, ready: false };
let state: WalletState = SERVER;
const listeners = new Set<() => void>();
const set = (patch: Partial<WalletState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const useWallet = (): WalletState => useSyncExternalStore(subscribe, () => state, () => SERVER);
export const walletState = () => state;

const hexToNum = (h: unknown) => parseInt(String(h), 16);
const remembered = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const remember = (v: string | null) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} };
const wired = new WeakSet<object>();

function wire(f: Found) {
  if (wired.has(f.provider) || !f.provider.on) return;
  wired.add(f.provider);
  f.provider.on("accountsChanged", (a) => {
    if (state.active !== f) return;
    const next = (a as string[])[0] ?? null;
    if (!next) { set({ account: null, active: null }); remember(null); } else set({ account: next });
  });
  f.provider.on("chainChanged", (c) => { if (state.active === f) set({ chainId: hexToNum(c) }); });
}

function add(f: Found) {
  if (state.providers.some((p) => p.uuid === f.uuid)) return;
  set({ providers: [...state.providers, f] });
}

let started = false;
/** Looks for wallets and quietly reconnects the one used last time (no prompt: eth_accounts only lists already-approved accounts). */
export function initWallet() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("eip6963:announceProvider", (e) => {
    const d = (e as CustomEvent<{ info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eip1193 }>).detail;
    add({ ...d.info, provider: d.provider });
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  setTimeout(async () => {
    const legacy = (window as unknown as { ethereum?: Eip1193 }).ethereum;
    if (!state.providers.length && legacy) add({ uuid: "legacy", name: "Browser wallet", icon: "", rdns: "legacy", provider: legacy });
    const last = remembered();
    const f = state.providers.find((p) => p.rdns === last);
    if (f) {
      try {
        const [a] = (await f.provider.request({ method: "eth_accounts" })) as string[];
        if (a) {
          wire(f);
          set({ active: f, account: a, chainId: hexToNum(await f.provider.request({ method: "eth_chainId" })) });
        }
      } catch {}
    }
    set({ ready: true });
  }, 300);
}

/** Connects the given wallet, or the only one found. With several wallets and none chosen, it asks the header menu to open. */
export async function connectWallet(pick?: Found): Promise<boolean> {
  const f = pick ?? (state.providers.length === 1 ? state.providers[0] : null);
  if (!f) {
    if (state.providers.length > 1) window.dispatchEvent(new CustomEvent("spawn:wallet-menu"));
    return false;
  }
  set({ connecting: true });
  try {
    const [a] = (await f.provider.request({ method: "eth_requestAccounts" })) as string[];
    wire(f);
    set({ active: f, account: a, chainId: hexToNum(await f.provider.request({ method: "eth_chainId" })), connecting: false });
    remember(f.rdns);
    return true;
  } catch {
    set({ connecting: false });
    return false;
  }
}

/** Forgets the connection here. (A wallet can only be disconnected from inside the wallet itself.) */
export function disconnectWallet() {
  set({ active: null, account: null, chainId: null });
  remember(null);
}

export async function switchToRobinhood(): Promise<boolean> {
  const p = state.active?.provider;
  if (!p) return false;
  try {
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ROBINHOOD.chainId }] });
  } catch {
    try {
      await p.request({ method: "wallet_addEthereumChain", params: [ROBINHOOD] });
    } catch {
      return false;
    }
  }
  set({ chainId: hexToNum(await p.request({ method: "eth_chainId" })) });
  return state.chainId === ROBINHOOD_ID;
}

/** Calls the connected wallet. Throws if none is connected. */
export async function walletRequest(method: string, params?: unknown[]): Promise<unknown> {
  const p = state.active?.provider;
  if (!p) throw new Error("Connect a wallet first.");
  return p.request({ method, params });
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
