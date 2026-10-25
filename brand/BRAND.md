# Spawn brand

Made by `scripts/brand.ts`. Fonts in `brand/fonts` (Archivo variable, DM Mono 400 and 500).

## Idea

A chain is blocks in a row, and Spawn is where a new one appears. Every token's chain is drawn as an 8 by 8 grid of blocks computed from its running hash, mirrored across a dashed seam: the right half mirrors the left, as the chain mirrors Pons.

## Mark

Three blocks in a row, linked by thin bars, the last one lit signal pink. Light on graphite is the default (`mark-light.svg`); `mark-dark.svg` is for light grounds. Never recolour the lit block, never add a fourth.

## Wordmark

`spawn`, lowercase, Archivo ExtraBold at width 125, tracking -0.045em.

## Colour

| Role | Hex |
|---|---|
| ground | `#0d0f12` |
| card | `#14181d` |
| ink | `#e9ecef` |
| muted | `#8b95a1` |
| signal | `#ff4d8d` (text on it is `#0d0f12`) |

## Type

Archivo for headings and reading. DM Mono for interface chrome, hashes, numbers and addresses.

## Files

| Path | Use |
|---|---|
| `mark/mark-light.svg`, `mark/mark-dark.svg` | the mark |
| `../app/icon.svg` | favicon |
| `../public/og.png` | link preview (1200x630) |
| `social/x-avatar-400.png` | X profile picture |
| `social/x-banner-1500x500.png` | X header |

## Voice

Short and literal. Say chain, trade, hash, block. No promises about returns, ever. The honest line stays on the page: the chains mirror trades, they don't settle them.
