# Deploying Spawn on Railway

Spawn is one container: the web app and the worker run together (`scripts/start.mjs`), and the worker starts one anvil process per chain. It needs **one replica** and a **persistent volume**. Serverless hosts will not work.

## 1. Before you start

- A domain you control, and the X account.
- A paid RPC endpoint for Robinhood Chain (chain id 4663). The public one is rate limited and the worker polls it every few seconds.
- A private GitHub repo with this code. Give Railway's GitHub app access to it.

## 2. Create the service

1. New project, Deploy from GitHub repo, pick the repo. Railway reads `railway.json` and builds the `Dockerfile`.
2. Add a **volume** to the service and mount it at `/data` (Railway Volumes: the Dockerfile has no `VOLUME` line on purpose, because Railway rejects one). Do this before the first deploy.
3. Set these variables (Variables tab). Do not set `PORT`: Railway sets it.

| Variable | Value |
|---|---|
| `SPAWN_DATA` | `/data` (the Dockerfile sets this too; keep it) |
| `PONS_RPC` | your paid RPC URL |
| `NEXT_PUBLIC_SITE_URL` | your final address, like `https://spawn.example` (**build time**, see below) |
| `SPAWN_TRUSTED_HOPS` | `1` for Railway alone, `2` if Cloudflare sits in front |
| `SPAWN_MAX_CHAINS` | `100` to start |
| `SPAWN_MAX_PER_WALLET` | `5` to start |
| `NEXT_PUBLIC_PONS_EXPLORER` | optional, a Pons transaction explorer address (**build time**) |

`NEXT_PUBLIC_*` values are written into the pages when the image is built. Changing one means a redeploy, and it must be set before the build that should use it.

4. Settings, Networking: add your domain (a CNAME to the target Railway shows), then redeploy so the new `NEXT_PUBLIC_SITE_URL` is built in.

## 3. Check it

- `/api/health` returns `{"ok":true,...}`. `worker` should read `ok` within a minute of the first start.
- The home page loads, `/chains` is empty until the first launch, `/og.png` loads.
- `/sitemap.xml` and `/robots.txt` use your domain.

## 4. The first real launch (do this before telling anyone)

The launch flow has only been tested with fake wallets and a fork of the chain. With your own wallet on Robinhood Chain:

1. Open `/launch`, connect the wallet, fill in a token, leave the first buy at None.
2. Confirm the launch (Pons's launch fee, about 0.0005 ETH, plus gas).
3. The page should send you to the new chain's page within a minute, with the trades filling in.
4. Open `/verify/<chain id>` and confirm it says the mirror matches Pons.
5. Add the network to your wallet from the chain page.

## Things to know

- **Backups.** Take backups of the volume. Chains can be rebuilt from Pons, but the list of which tokens were registered lives only in the database.
- **Capacity.** About 100 chains per server: each is an anvil process using memory. The cap and the per-wallet limit are settings. Raise them only after watching memory.
- **Restarts.** The container stops the worker cleanly so chain state is saved. If it is killed hard, a chain whose saved state disagrees with the database is rebuilt from Pons on the next start.
- **Reorgs.** If Pons reorganises, a chain can end up ahead of Pons. The verify page shows the mismatch, but nothing repairs it automatically yet.
- **What is not built.** Mobile wallets through WalletConnect, token image upload, and automatic repair after a reorg.
