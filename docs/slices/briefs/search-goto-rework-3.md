# Slice SearchGoToR3 — fix round 3 (standing Gate B answer #1744, #1752): a keyboard-only go-to only focuses

Board "Search" row 3, fix round 3 (session 36). Round 2 `fb11db9` (brief `docs/slices/briefs/search-goto-rework-2.md`,
report `agent://SearchGoToR2`) fixed #1745 (a side-pane go-to on an open file pulled back by the other panes'
height-keeping scrolls) by making the go-to's pane lead the scroll sync. Both reviews (`agent://SearchGoToR2Correct`,
`agent://SearchGoToR2Boundary`) found:

1. **#1748 (block)** `editor/merge.ts:210`. `goTo` now calls `this.#frame.realign(pane)` when `match` is null too. In
   the merge window that request is always `goTo({ pane: "center", match: null })`, sent by `focusShownFile`
   (`ui/searching.ts` ~196) from the search panel's hide; it only hands the Result the keyboard. Now it makes the
   Result lead a sync that rewrites both sides from the Result's middle, which is not reversible inside a span that is
   zero lines tall in the Result (a pending one-side insertion) or at a clamped end, so a side the user scrolled last
   jumps. Repro (merge fixture or real app): click a file in the file list (keyboard on the row), wheel the Remote pane
   so its middle sits inside a long pending Remote-only insertion, Ctrl+Shift+S twice → Remote jumps to the
   insertion's top. Before `fb11db9` it did not move. Fix: realign only when a match was selected
   (`if (match !== null) { this.#frame.realign(pane); }` after the selection); a keyboard-only go-to is focus only, as
   before.
2. **#1750 (should, promoted)** `frontend/src/editor/AGENTS.md`. Line 23 says the go-tos are find's selection only;
   line 21 names realigning only after a fold change. Line 23: add that `MergeController.goTo` with a match then makes
   the go-to's pane lead the scroll sync (`Frame.realign(pane)` → `ScrollSync.follow`, #1745), `match: null` only
   focuses, and `RangeController.goTo` does not realign; line 21: realign after a fold change (both windows) or a merge
   go-to that selected a match.

## Target

Owned: `frontend/src/editor/merge.ts`, `frontend/src/editor/AGENTS.md`. Read-only: everything else.

## Acceptance

- `pnpm -C frontend sfc-order`, `typecheck`, `lint`, `test`, `fmt:check`, `unused` pass.
- WebKit on a private display with `document.hasFocus()` true beside every read (`dbus-daemon --session --fork
  --print-address 1`, then `DBUS_SESSION_BUS_ADDRESS=<bus> just app-session start-fixture`), dark: item 1's repro
  **before** (at `fb11db9`: the Remote `scrollTop` moves on the hide) and **after** (unchanged ±1 px, the Result has
  the keyboard); find a file in the merge fixture with a long Remote-only (or Local-only) pending insertion and name
  it. Then #1745's repro (search `ret = augmentor(ret)`, click its row; search `let rawName = arg.content`, click
  `Local (yours), line 45`) still lands in view at +500 ms, and a Result row still does. Paste values.

## Skills

`skill://cm6-rules`, `skill://verification` (plus your autoloaded ones).
