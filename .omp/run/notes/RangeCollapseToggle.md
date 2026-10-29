# RangeCollapseToggle — notes (session 35)

Slice brief `docs/slices/briefs/range-collapse-toggle.md`; web-impl, isolated, 4m34s. Patch `fce7a2a` (base `d7e6f5b`),
`.omp/run/patches/RangeCollapseToggle.patch`; 6 files, +109 −27 (the `RangeStore` type re-indented by the formatter).

## Summary (implementer)

- `ui/collapsing.ts` exports `COLLAPSE_LABEL`; `toolbarButtons.ts` `LABELS.collapse` uses it.
- `RangeStore = SettingsStore & Collapsing & {…}`; `createRangeStore` spreads `...createCollapsing()` (same key
  `yamt.collapse.unchanged`, same read rule).
- `RangeView.vue`: `ChevronsDownUp` toggle after Next — `aria-pressed`, the merge button's pressed classes,
  `@mousedown.prevent`, disabled without columns. The columns do not follow it yet (row 4).
- `ui/AGENTS.md`: one line (plan §2 #126).

## Tests (`rangeStore.test.ts`)

Stored choice missing/"true"/"no" → on, "false" → off (×4, real default storage via `setSSRHandler`); a toggle leaves
exactly `[["yamt.collapse.unchanged","false"]]` and a second writes "true"; `COLLAPSE_LABEL` equals the merge
toolbar's collapse entry.

## Evidence (implementer)

- typecheck, lint, fmt:check, test (201 files, 2749 tests) clean. Sabotage (own `useStorage` key) fails both storage
  tests; reverted.
- WebKit `?range=review` 1600×1000: header order icon, name, ↑, ↓, toggle (`aria-pressed=true`), send, settings;
  dark pressed bg `rgba(119,76,213,0.35)`, light `rgb(208,223,254)`; click keeps `activeElement` (cm-content) and
  stores "false"; second click "true"; `public/logo.png` all three disabled. Same profile: range off → merge fixture
  button `aria-pressed=false`; on there → range pressed after reload. Merge title and menu entry unchanged.
  Screenshots `/tmp/rct/*.png`.

## Deviations (accepted)

1. Cross-window check navigated one fixture session to `/` (same origin and profile = same storage).
2. A third test (label) in `rangeStore.test.ts` to kill the `COLLAPSE_LABEL` string mutant.

## Open risks (implementer)

- A disabled toggle keeps its pressed background (as the merge button does; the brief's classes).
- `rangeStore.test.ts:580` expects no other key written at store creation.

## Fix round 1 (`RangeCollapseToggleR1`, 3m29s, patch `72bba1b`, `.omp/run/patches/RangeCollapseToggleR1.patch`)

Blocks #1667/#1671: the toggle's class is now exactly `MergeToolbar.vue:198`'s (adds `disabled:pointer-events-none`).
Evidence: `public/logo.png` disabled+pressed, dark and light, computed background/filter equal away and over
(`rgba(119,76,213,0.35)`/`none`, light `rgb(208,223,254)`/`none`), equal to the merge fixture toggle disabled through
the DOM; `board.ts` enabled toggle still brightens (`brightness(1.1)`) and flips on click. typecheck, lint, fmt:check
clean. Deviations: ran `pnpm install --frozen-lockfile --offline` in the worktree; merge toggle disabled via the DOM
(brief allowed).

## Re-check after fix round 1

Boundary pass (#1667 resolved), correctness pass (#1671 resolved); accepted. Side effect accepted by both: a disabled
toggle shows no title on hover, as the merge toggle.
