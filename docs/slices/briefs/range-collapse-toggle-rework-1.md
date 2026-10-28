# Slice RangeCollapseToggleR1 — fix round 1: the disabled toggle looks like the merge window's

Board "Range collapse" row 3, fix round 1 (session 35). Round 1: `RangeCollapseToggle`, commit `fce7a2a`, brief
`docs/slices/briefs/range-collapse-toggle.md` (read it). Both reviews passed with one shared finding, promoted to a
block (#1667, #1671):

> `RangeView.vue:85` — when the toggle is disabled and pressed (a binary file such as `public/logo.png`), hovering it
> still changes its look: `aria-pressed:hover:brightness-110` has no disabled guard, and `disabled:hover:bg-transparent`
> outranks `aria-pressed:bg-row-selected`. The merge window's toggle (`MergeToolbar.vue:198`) avoids both with
> `disabled:pointer-events-none`; the brief's class list (the orchestrator's) left it out, so the one pressed look now
> lives in two class strings that differ.

## Target

Owned: `frontend/src/ui/RangeView.vue`. Read-only: everything else. Non-goals: Previous/Next's classes; any other
change.

## Change

1. The toggle's `class` becomes exactly the merge toggle's string (`MergeToolbar.vue:198`):
   `rounded p-1.5 hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted disabled:hover:bg-transparent
   aria-pressed:bg-row-selected aria-pressed:hover:brightness-110`.

## Acceptance

- WebKit, fixture page (`just app-session start-fixture --range-case review`, MiniBrowser 1600×1000), dark **and**
  light: on `public/logo.png` the disabled, pressed toggle's computed `background-color` and `filter` are the same with
  the pointer away and over it, and equal to the merge fixture page's toggle when it is disabled and pressed (or, if
  the merge page cannot show it disabled, its computed values with `pointer-events: none` in effect); on
  `src/board/board.ts` the enabled toggle still brightens on hover and toggles as before.

Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend fmt:check`.

## Skills

`skill://vue-conventions`, `skill://verification` (plus your autoloaded ones).
