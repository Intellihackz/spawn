# Contracts

`src/Ledger.sol` is the per-chain ledger: an append-only record of a token's Pons trades with a running hash. It holds no balances and moves no value.

The compiled ledger (ABI and bytecode) is committed as `Ledger.json`, and that is what the app reads. After changing `Ledger.sol`, run `npm run contracts` from the project root (needs Foundry's `forge`) to rebuild it.
