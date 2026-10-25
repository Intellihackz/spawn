// The running hash, exactly as Ledger.sol computes it. The verify page and the worker both use this one function.
import { encodeAbiParameters, keccak256, type Hex } from "viem";
import type { Trade } from "./pons.ts";

/** The hash a fresh ledger starts from. It binds the chain to one token and curve. */
export const genesis = (token: string, curve: string): Hex =>
  keccak256(encodeAbiParameters([{ type: "string" }, { type: "address" }, { type: "address" }], ["spawn", token as Hex, curve as Hex]));

/** The hash that follows `prev` once `t` is added. */
export const link = (prev: Hex, t: Trade): Hex =>
  keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint32" }, { type: "uint8" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }],
      [prev, t.ponsTx as Hex, t.ponsLogIndex, t.buy ? 1 : 0, t.wallet as Hex, t.quote, t.tokens],
    ),
  );

/** Folds a list of trades into the head, and returns every hash on the way (one per trade). */
export function chainOf(token: string, curve: string, trades: Trade[]): { head: Hex; hashes: Hex[] } {
  let h = genesis(token, curve);
  const hashes = trades.map((t) => (h = link(h, t)));
  return { head: h, hashes };
}
