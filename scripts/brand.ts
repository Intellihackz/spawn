// Renders the brand assets: the share image (public/og.png), the X avatar and banner, and the mark files.
// Needs Playwright, so run it from a folder that has it:  cd <folder with playwright> && /path/to/spawn/node_modules/.bin/tsx /path/to/spawn/scripts/brand.ts
import fs from "node:fs";
import path from "node:path";
import { launch } from "/Users/zed/.claude/skills/awwwards/scripts/browser.mjs";
import { cellsOf, gridOf, SAMPLE_HEAD } from "../lib/blocks.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const C = { bg: "#0d0f12", card: "#14181d", fg: "#e9ecef", muted: "#8b95a1", signal: "#ff4d8d", lo: [23, 27, 33], hi: [163, 176, 191] };
const b64 = (p: string) => fs.readFileSync(path.join(ROOT, p)).toString("base64");
const FONTS = `
@font-face{font-family:"Archivo";font-weight:100 900;font-stretch:62% 125%;src:url(data:font/woff2;base64,${b64("brand/fonts/archivo-100_900-normal.woff2")}) format("woff2")}
@font-face{font-family:"DM Mono";font-weight:400;src:url(data:font/woff2;base64,${b64("brand/fonts/dm-mono-400-normal.woff2")}) format("woff2")}
@font-face{font-family:"DM Mono";font-weight:500;src:url(data:font/woff2;base64,${b64("brand/fonts/dm-mono-500-normal.woff2")}) format("woff2")}`;

const mix = (v: number) => `rgb(${C.lo.map((l, i) => Math.round(l + (C.hi[i] - l) * v)).join(",")})`;
/** The blocks of a hash as inline SVG (the same grid the site draws). */
function blocksSvg(hash: string, size: number, seam = true) {
  const rects = cellsOf(gridOf(hash)).map((c) => `<rect x="${c.x + 0.05}" y="${c.y + 0.05}" width="0.9" height="0.9" fill="${c.sig ? C.signal : mix(c.v)}"/>`).join("");
  return `<svg width="${size}" height="${size}" viewBox="-0.1 -0.1 8.2 8.2">${rects}${seam ? `<line x1="4" y1="-0.1" x2="4" y2="8.1" stroke="${C.signal}" stroke-width="0.035" stroke-dasharray="0.16 0.12" opacity="0.85"/>` : ""}</svg>`;
}
const markSvg = (fg: string, sig: string, h = 16) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${(h * 38) / 16}" height="${h}" viewBox="0 0 38 16"><rect x="0" y="3" width="10" height="10" fill="${fg}"/><rect x="10" y="7.2" width="4" height="1.6" fill="${fg}" opacity="0.5"/><rect x="14" y="3" width="10" height="10" fill="${fg}"/><rect x="24" y="7.2" width="4" height="1.6" fill="${fg}" opacity="0.5"/><rect x="28" y="3" width="10" height="10" fill="${sig}"/></svg>`;

// ---- svg files ----
fs.writeFileSync(path.join(ROOT, "brand/mark/mark-light.svg"), markSvg(C.fg, C.signal));
fs.writeFileSync(path.join(ROOT, "brand/mark/mark-dark.svg"), markSvg(C.bg, "#d6155f"));
fs.writeFileSync(
  path.join(ROOT, "app/icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 38"><rect width="38" height="38" fill="${C.bg}"/><g transform="translate(0 11)"><rect x="0" y="3" width="10" height="10" fill="${C.fg}"/><rect x="10" y="7.2" width="4" height="1.6" fill="${C.fg}" opacity="0.5"/><rect x="14" y="3" width="10" height="10" fill="${C.fg}"/><rect x="24" y="7.2" width="4" height="1.6" fill="${C.fg}" opacity="0.5"/><rect x="28" y="3" width="10" height="10" fill="${C.signal}"/></g></svg>`,
);

const page = (w: number, h: number, body: string, css = "") => `<!doctype html><meta charset="utf-8"><style>${FONTS}
*{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;background:${C.bg};color:${C.fg};overflow:hidden}
body{font-family:"Archivo",sans-serif;position:relative}
.h{font-weight:800;font-stretch:125%;font-variation-settings:"wdth" 125;letter-spacing:-0.045em;line-height:.92}
.m{font-family:"DM Mono",monospace}.sig{color:${C.signal}}
${css}</style>${body}`;

const lockup = (h: number) => `<div style="display:flex;align-items:center;gap:${h * 0.5}px">${markSvg(C.fg, C.signal, h * 0.9).replace('xmlns="http://www.w3.org/2000/svg"', "")}<span class="h" style="font-size:${h * 1.25}px">spawn</span></div>`;

const shots: { name: string; out: string; w: number; h: number; html: string }[] = [];

// share image 1200x630
shots.push({
  name: "og",
  out: "public/og.png",
  w: 1200,
  h: 630,
  html: page(
    1200,
    630,
    `<div style="position:absolute;left:64px;top:56px">${lockup(34)}</div>
     <h1 class="h" style="position:absolute;left:64px;top:170px;font-size:92px;width:640px">Every launch spawns its own chain.</h1>
     <p class="m" style="position:absolute;left:64px;bottom:56px;font-size:22px;color:${C.muted};width:600px">Mirrors every Pons trade. Settles nothing.</p>
     <div style="position:absolute;right:64px;top:64px">${blocksSvg(SAMPLE_HEAD, 500)}</div>`,
  ),
});
// X avatar 400x400: the mark on graphite, safe inside a circle crop
shots.push({ name: "avatar", out: "brand/social/x-avatar-400.png", w: 400, h: 400, html: page(400, 400, `<div style="position:absolute;inset:0;display:grid;place-items:center">${markSvg(C.fg, C.signal, 84).replace('xmlns="http://www.w3.org/2000/svg"', "")}</div>`) });
// X banner 1500x500: a row of chains, each its own picture
const row = ["0x1c4e8a52d97f03b6e1a8c25d4f70b93a6e2d815c07f4a9b3d68e12c5a7f0394d", "0x964a72a0b81d3c55e07f1a9d4b6c28e03f5a71c94d8b2e6a0f3c7d915e4b8a6", SAMPLE_HEAD, "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "0x4d1f7a93c20b58e6d4a19f03b7c85e2a60d9f1b4c37e8a52d06b9f14a3c7e580"];
shots.push({
  name: "banner",
  out: "brand/social/x-banner-1500x500.png",
  w: 1500,
  h: 500,
  html: page(
    1500,
    500,
    `<div style="position:absolute;left:72px;top:64px">${lockup(30)}</div>
     <h1 class="h" style="position:absolute;left:72px;top:150px;font-size:72px;width:620px">Every launch spawns its own chain.</h1>
     <div style="position:absolute;right:72px;top:60px;display:flex;gap:20px;align-items:center">${row.map((h, i) => `<div style="margin-top:${i % 2 ? 60 : 0}px">${blocksSvg(h, 132, false)}</div>`).join("")}</div>`,
  ),
});

const browser = await launch();
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(s.html);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(ROOT, s.out) });
  await ctx.close();
  console.log("wrote", s.out);
}
await browser.close();
