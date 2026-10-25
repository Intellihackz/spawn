// Runs the web app and the worker together, and stops both on Ctrl+C.
import { spawn } from "node:child_process";
const run = (cmd, args) => spawn(cmd, args, { stdio: "inherit" });
const kids = [run("npx", ["next", "dev", "-p", "3000"]), run("npx", ["tsx", "worker/index.ts"])];
const stop = () => kids.forEach((k) => k.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
kids.forEach((k) => k.on("exit", stop));
