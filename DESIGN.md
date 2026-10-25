# Spawn design

Second design pass with /awwwards. The first pass was a mineral "shard" brand; the owner asked for something with a blockchain feeling and chose the name Spawn. Every route, API and behaviour of the app is unchanged. The name, the art, the type use, the colour and the motion changed.

## Brief

- **Subject:** Spawn, a launchpad front door on Pons (Robinhood Chain). A token launched through it gets its own chain; the chain mirrors every Pons trade with a running hash; anyone can rebuild the hash from Pons.
- **Audience:** people launching or following Pons tokens, and the curious who want to check the claim.
- **Job:** get a launch started, and make the "mirror, not settlement" claim checkable.
- **Honest limit (kept in the copy):** the chains mirror trades, they do not settle them, and hold no funds.

## Concept Card

```
Idea:        Every token's chain is drawn as an 8 by 8 grid of blocks computed from its running hash, mirrored across a dashed seam. The picture is the chain itself, and the verify page redraws it from Pons to show the two are the same.
Metaphor:    A chain is blocks in a row. Spawn is the point where a new one appears. The right half of the grid mirrors the left, as the chain mirrors Pons.
Signature:   Rewind. The hero grid is the real running hash of the chain that traded last. Scrolling the hero rewinds that chain trade by trade and the blocks re-colour into the picture of each earlier hash; on the explorer the grid follows the trade row you are reading; a new trade changes it live. (Sticky stage + one driver variable.)
Emotion:     Calm, exact, a little electric: a terminal with one live pixel.
Motion verb: Stack and lock. Blocks appear in order and lock into place (expo.out, no bounce). The page transition is twelve blocks stacking up over the screen.
Screenshot:  The big mirrored grid with its pink cells, the dashed seam, and the chain card beside it: Chain 7770001, BUTT, trade #18, head 0x0f0e1a26…50b0.
```

**Anchor (swap test):** the picture depends on a running hash that changes with every trade and can be recomputed by anyone, and its left-right symmetry is the mirror. Put another subject in the sentence and it stops working.

## Concepts considered (round two)

| | Idea | Why not |
|---|---|---|
| Tally stick (Counterfoil, Tallyhalf, Notch) | A split stick whose two halves must match | True to the verify step, but reads as history, not crypto |
| Seal (Sigil, Signet) | A wax impression drawn from the hash | Names crowded in crypto, weaker on "two halves" |
| Echo | Ripple rings from the hash | Generic names, weakest originality |
| **Spawn blocks (picked)** | An identicon-style block grid, mirrored | Crypto-native (identicons and blocks), carries the mirror idea literally |

Name: **Spawn**, chosen by the owner. "Spawn" is used by other crypto projects (for example Sonic Labs' AI app builder), so the owner should check the domain and the X handle before launching.

## Palette (graphite and signal)

| Role | Hex | Use |
|---|---|---|
| ground | `#0d0f12` | the page |
| card | `#14181d` | surfaces, rows, panels |
| ink | `#e9ecef` | text, and the light footer band |
| muted | `#8b95a1` | secondary text (6.1:1 on ground) |
| line | `rgb(233 236 239 / .12)` | the few hairlines |
| signal | `#ff4d8d` | the spawn point: cells, the seam, buttons, focus. Text on it is graphite, never white (6.3:1) |
| ok / bad | `#3ddc97` / `#ff6b5e` | verify result and trade side only |

Block ramp: `#171b21` to `#a3b0bf` by brightness; any byte at or above 230 draws in signal. The footer is a light band (`.is-light`): the same system turned over.

## Type

- **Archivo** (variable, width 62 to 125): expanded 800 for poster type, normal width for reading.
- **DM Mono**: all UI chrome (nav, buttons, labels, table heads), hashes, numbers, addresses. It carries the blockchain feeling.

## Shape and grid

Square blocks only: no radius, no chamfer, tonal cards with a 1 px inset line. 12 columns, hang from columns 1, 5 and 9. The header steps aside on scroll down and returns on scroll up.

## Motion language

- One ease family: `expo.out` for entrances, `expo.inOut` for the curtain.
- **Hover, one treatment per role:** buttons and chain rows get a **fill** that sweeps in from the side the pointer entered. Nav and inline links draw an underline and turn signal. Table rows get a tonal change.
- **Page transition:** twelve columns stack up, pink leading and graphite following, and drop away on the next page (0.9 s each way).
- **Idle:** the scan. A slow wave of brightness crosses every visible grid and leans toward the pointer; paused off screen, still under reduced motion.
- **No loader.** It is a live data app; waiting before the data is a usability cost with no payoff. The hero plays its intro at once: blocks spawn outward from the seam, the headline rises by line.
- Reduced motion: native scroll, static grids, all content visible, no curtain.

## Composition plan (a different layout family per section)

```
HOME
1  Hero (poster + sticky stage)   h1 left 7 cols, mirrored grid right, chain card under it, ruler of the last trades.
2  Chains (index list)            rows: mini grid, symbol, trades, last trade. Pointer preview: a big grid follows the cursor. Latest-trades tape (light panel) beside it.
3  Statement                      one paragraph set large: Pons settles, a chain copies. Live verify chip beside it.
4  How a chain is spawned         sticky narrative: the grid changes state per chapter (empty, genesis, grown, proof).
5  Footer finale                  light band, giant "spawn", the honest line, Launch CTA.

CHAINS    index list with search and pager.
CHAIN     left sticky picture and facts; right trades / blocks tables. The grid follows the trade row nearest the reading line.
TRADE     the grid before and after this trade, the data.
BLOCK     the trades of one mirror block.
VERIFY    the shell streams at once; the verdict and three grids (rebuilt, stored, on the chain) fill in when Pons has been read.
LAUNCH    statement; a three-step form (token, first buy, links) with a receipt beside it (token preview, wallet, cost).
404       an empty frame: "Nothing spawned here."
```

## Decisions and assumptions

- The grid is a fingerprint of the hash (like an identicon). It is not a security feature by itself; the hashes are the proof, the grid makes a match or a mismatch visible. The copy says so.
- No chains yet: the hero draws a sample hash and says "Sample".
- `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_PONS_EXPLORER` are settings the owner fills in.
- The wallet button appears only on the launch page, where it replaces the header's launch button; the landing page and the other pages have no wallet control. The old "Launched on Pons already?" claim panel was removed at the owner's request and its space became a receipt: token preview, wallet and balance, launch fee, total cost, Pons permission and the wallet's own chains.
- The genesis string in the hash and the launch salt tag are both `spawn` (5 bytes). Changing the name later means changing both and re-seeding.
