// Shared by the worker and the web app. Chain n gets chain id CHAIN_ID_BASE + n and a local port PORT_BASE + n.
export const CHAIN_ID_BASE = 7_770_000; // far above real chain ids, so a wallet never mistakes one of ours for another network
export const PORT_BASE = Number(process.env.SPAWN_PORT_BASE ?? 9_000); // tests use another range, so they never meet a running worker
export const chainIdOf = (n: number) => CHAIN_ID_BASE + n;
export const nOf = (chainId: number) => chainId - CHAIN_ID_BASE;
export const localRpc = (n: number) => `http://127.0.0.1:${PORT_BASE + n}`;
