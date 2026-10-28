# Slice RangeCollapseToggle — the range header's "Collapse unchanged fragments" toggle and the one stored choice

Board "Range collapse" row 3 (session 35). Request `docs/slices/request-range-collapse.md` (read it whole: rules 1–8,
acceptance, non-goals; yours are rules 1 and 7); decision `docs/plan.md` §2 **#126** (read it whole) and #68 (the
merge window's toggle). Design: `.omp/run/notes/RangeCollapseDesign.md` option A, "Window side". An editor slice
(`RangeFoldCore`) runs beside you; a later slice (`RangeFoldColumns`) makes the columns follow the store's
`collapsing` (it reads `useRangeStore().collapsing` in `useRangeController.ts`). Until then the button changes the
stored choice and its own look only — that is your whole scope, not a stub.

Facts (given, at `a6fe62a`):

- `ui/collapsing.ts`: `Collapsing = { collapsing: Readonly<Ref<boolean>>; toggleCollapsing(): void }`;
  `createCollapsing(storage?)` over `storedValue` with key `yamt.collapse.unchanged`, read `raw !== "false"`, write
  `String(on)`, default on. Tested by `ui/collapsing.test.ts`.
- `ui/toolbarButtons.ts:47-50` `LABELS` holds `collapse: "Collapse unchanged fragments"` (the merge toolbar and its
  right-click menu read it).
- The merge store spreads `...createCollapsing()` (`ui/store.ts:181`); `MergeToolbar.vue:83-89,190-203` is the merge
  button: `ChevronsDownUp`, `keepsKeyboard: true`, `:aria-pressed`, classes
  `rounded p-1.5 hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted disabled:hover:bg-transparent
  aria-pressed:bg-row-selected aria-pressed:hover:brightness-110`.
- `ui/rangeStore.ts:38-50` `RangeStore = SettingsStore & { … }`; `:162-177` `createRangeStore` builds it. Fence PM9
  bars range files from importing `ui/store` or `App` (`frontend/scripts/fences.ts:55-66`); `collapsing.ts` is not a
  root file, so `rangeStore.ts` may import it.
- `ui/RangeView.vue:55-76` Previous and Next: `:title`/`:aria-label`, `:disabled="!columns"`, classes
  `rounded p-1.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent`, `@mousedown.prevent` (keeps
  the keyboard), then `<RangeSendButton class="ml-auto" />`. `:32` `const { preferences, question } = useRangeStore()`.
- Fixture `?range` (`review`) has a binary entry `public/logo.png` (no columns) and the text file `src/board/board.ts`.

## Target

Owned: `frontend/src/ui/collapsing.ts`, `frontend/src/ui/toolbarButtons.ts`, `frontend/src/ui/rangeStore.ts`,
`frontend/src/ui/rangeStore.test.ts`, `frontend/src/ui/RangeView.vue`, `frontend/src/ui/AGENTS.md`.

Read-only: everything else (`useRangeController.ts`, `rangeThreads.ts`, `store.ts`, `MergeToolbar.vue`, `editor/**`
included). Docs are the orchestrator's.

Non-goals: the columns collapsing (later slice); a right-click menu in the range header; a key for the toggle; a
setting in the settings view; any change to the merge window's toolbar, menu or stored choice.

## Contract (fixed; you may add, never change)

```ts
// ui/collapsing.ts — the button's words, one source for both windows
export const COLLAPSE_LABEL = "Collapse unchanged fragments";
// ui/toolbarButtons.ts — LABELS.collapse is COLLAPSE_LABEL
// ui/rangeStore.ts
export type RangeStore = SettingsStore & Collapsing & {/* as today */};
// createRangeStore spreads ...createCollapsing() — the same key and read rule as the merge window
```

## Change

1. `collapsing.ts`: export `COLLAPSE_LABEL`; `toolbarButtons.ts` `LABELS.collapse` uses it.
2. `rangeStore.ts`: `Collapsing` in `RangeStore`; `createRangeStore` spreads `...createCollapsing()`.
3. `RangeView.vue`: a button right after Next: `ChevronsDownUp` (`~icons/lucide/chevrons-down-up`), `:title` and
   `:aria-label` `COLLAPSE_LABEL`, `:aria-pressed="collapsing"`, `:disabled="!columns"`, Previous/Next's classes plus
   `aria-pressed:bg-row-selected aria-pressed:hover:brightness-110` (the merge button's pressed look),
   `@mousedown.prevent`, `@click="toggleCollapsing"`.
4. `rangeStore.test.ts`: the range store's choice is the merge window's stored one — a stored `"false"` starts it
   off, anything else (missing, `"true"`, garbage) on, and a toggle writes `"false"` under `yamt.collapse.unchanged`
   (the bug caught: a second key or a second read rule, rule 7).
5. `ui/AGENTS.md`: one short line under the range window: the collapse toggle (plan §2 #126) reads and writes the
   merge window's stored choice through `createCollapsing` in the range store.

## Acceptance

- Node: the `rangeStore.test.ts` test above passes and fails when the store creates its own key (paste the failing
  output after a one-line sabotage, then revert). Your tests kill the mutants on your `.ts` lines (Stryker, SP5).
- WebKit, fixture page (`just app-session start-fixture --range-case review`, MiniBrowser 1600×1000), dark **and**
  light: on `src/board/board.ts` the header reads file icon, name, Previous, Next, the toggle, then (right) send and
  settings; the toggle's title is "Collapse unchanged fragments", `aria-pressed="true"` at first and its pressed
  background shows; a click → `aria-pressed="false"` and the keyboard focus stays where it was (`document.activeElement`
  before and after the click equal, with a column focused); a second click → `"true"`. On `public/logo.png` the toggle
  is disabled, as the arrows are. Screenshots of the header (pressed and not) pasted.
- WebKit, same browser profile: toggle off in the range fixture page, then open the merge fixture page
  (`just app-session start-fixture`): its collapse button shows `aria-pressed="false"`; toggle it back on there, reload
  the range page: pressed. (One stored choice, rule 7.)
- The merge toolbar's button title and its right-click menu entry still read "Collapse unchanged fragments".

Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test`, `pnpm -C frontend fmt:check`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
