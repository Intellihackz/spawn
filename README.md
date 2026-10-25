# Spawn

A launchpad front door on Pons (Robinhood Chain). A token launched through the page gets its own chain, with its own chain id, and every Pons trade of that token is mirrored onto it with a running hash. Each chain has its own explorer, and a picture: its hash drawn as a mirrored grid of blocks. A verify page rebuilds the hash from the Pons logs, so anyone can check the mirror is honest.

**The chains mirror trades. They don't settle them.** Trading happens on Pons. A chain holds a record and no funds.

## How it works

1. The visitor launches a token from the page. Their wallet calls Pons directly (`launchToken`, or `launchAndBuy` on the router when they add a first buy). The salt of the call starts with the tag `spawn`, which is how the server knows the launch came through the site. Spawn never holds funds.
2. The page sends the launch transaction hash to `/api/register`. The server reads the receipt, finds the `TokenLaunched` event and queues the token. The register route can also claim a token launched elsewhere on Pons from a signed message (the signer must be the wallet that launched it), but the site has no page for that now.
3. The worker starts an anvil with a unique chain id (`7,770,000 + n`) and a port (`9000 + n`), deploys `Ledger.sol`, and copies in every `CurveBuy` and `CurveSell` of that token since its launch. It then follows the Pons chain every few seconds and mirrors new trades.
4. Every mirrored trade extends a hash: `keccak256(abi.encode(previousHash, txHash, logIndex, side, wallet, quote, tokens))`, starting from `keccak256(abi.encode("spawn", token, curve))`. The same function is in `Ledger.sol` and `lib/hash.ts`.
5. `/verify/<chain id>` rebuilds the hash straight from the Pons logs and compares it with the stored hashes and with the head the ledger reports.

## Wallets

A **Connect wallet** button takes the place of the header's launch button on the launch page (and nowhere else). It finds wallets through EIP-6963 (MetaMask, Rabby, Coinbase Wallet and others, with `window.ethereum` as a fallback) and shows a picker when several are installed. After connecting it shows the address, warns when the wallet is on the wrong network, and offers to switch to Robinhood Chain (adding it if the wallet does not know it). The launch form and the add-network button use the same connection, and the wallet reconnects quietly after a reload. Wallet code is in `lib/wallet.ts` and `components/WalletButton.tsx`. The launch page is a three-step form (`components/LaunchForm.tsx`: the token, your first buy, links) beside a receipt (`components/LaunchSummary.tsx`, fed by `/api/wallet` through `lib/walletData.ts`): a live preview of the token, the wallet and its balance on Robinhood Chain, the live Pons launch fee, the total cost (it updates as the first buy is chosen), whether Pons lets the wallet launch, and the chains this wallet has already spawned. The launch button says what is blocking a launch (no wallet, wrong network, not enough ETH, Pons says no) instead of failing at the end. Injected wallets only: mobile wallets through WalletConnect would need a Reown project id and are not built.

## Run it

Needs Node 24 and Foundry's `anvil` on your PATH. The compiled ledger is committed (`contracts/Ledger.json`); after changing `contracts/src/Ledger.sol`, run `npm run contracts` (needs `forge`) to rebuild it.

```bash
npm install
npm run seed 4         # optional: queue four recent Pons tokens so there is something to see
npm run dev            # the web app on :3000 and the worker, together
```

Open http://localhost:3000. Copy `.env.example` to `.env.local` to change settings.

## Pieces

| Path | What it is |
|---|---|
| `contracts/src/Ledger.sol` | the per-token ledger: an append-only record with a running hash, no balances |
| `lib/pons.ts` | reads Pons launches and trades (this RPC's limits are handled) |
| `lib/hash.ts` | the running hash |
| `lib/chains.ts` | starts and stops one anvil per token, deploys the ledger, mirrors trades (worker only) |
| `lib/launch.ts` | builds and checks a Pons launch for the visitor's wallet to send |
| `lib/verify.ts` | the independent check against Pons |
| `worker/index.ts` | gives new tokens a chain and keeps mirroring |
| `app/` | the pages and API: home, chains, explorer, trade and block pages, verify, launch |
| `app/rpc/[chainId]` | a read-only RPC for each chain, so a wallet can add it as a network. Writes are refused |

## Tests

These use an anvil fork of the real chain, so no money is involved.

```bash
npm run e2e                          # one real token replayed onto a chain, hashes compared
npx tsx scripts/launch-test.ts       # launching, with and without a first buy
npx tsx scripts/flow-test.ts         # launch, register, worker, live trades, verify, and what must be refused
```

## Deploy

See `DEPLOY.md` (Railway: one container, one replica, a volume at `/data`, health check at `/api/health`).

## Notes and limits

- One instance only. The worker owns the anvil processes and the SQLite file.
- The worker reads the latest Pons block, so a chain reorganisation would leave the mirror ahead of Pons. The verify page would show the mismatch, but nothing repairs it automatically yet (a restart only rebuilds a chain whose ledger disagrees with the database, not one that disagrees with Pons).
- The anvil chains are dev nodes. They are a record kept by this server, not an independent network, which is why the verify page checks against Pons and not against the chain.
- The token image is a link (`ipfs://` or `https://`). There is no upload yet.
- `Dockerfile` has not been built on a real Docker host yet: build it once before trusting it.
- Capacity is capped (`SPAWN_MAX_CHAINS`, `SPAWN_MAX_PER_WALLET`) because every chain is a running process.
