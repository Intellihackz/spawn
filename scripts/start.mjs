// Production entry: runs the web app and the worker side by side, and stops both if either one dies.
import { spawn } from "node:child_process";
const run = (cmd, args) => spawn(cmd, args, { stdio: "inherit" });
const kids = [run("npx", ["next", "start", "-p", process.env.PORT ?? "3000"]), run("npx", ["tsx", "worker/index.ts"])];
let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  kids.forEach((k) => k.kill("SIGTERM"));
  setTimeout(() => process.exit(code), 8000).unref(); // the worker needs a few seconds to save the chains
};
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
kids.forEach((k) => k.on("exit", (c) => stop(c ?? 1)));
