// Copies the compiled ledger (ABI and bytecode only) from Foundry's output to contracts/Ledger.json, which is committed.
// The app reads that file, so a build or a deploy never needs Foundry's compiler. Run `npm run contracts` after changing Ledger.sol.
import fs from "node:fs";
const out = JSON.parse(fs.readFileSync("contracts/out/Ledger.sol/Ledger.json", "utf8"));
fs.writeFileSync("contracts/Ledger.json", JSON.stringify({ abi: out.abi, bytecode: { object: out.bytecode.object } }, null, 1) + "\n");
console.log("wrote contracts/Ledger.json");
