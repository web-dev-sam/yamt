# Slice SearchTidyR1 — fix round 1 of SearchTidy: a choice view mounted under a waiting go-to

Board "Search" row 6b. Round 1 (`da75f8b`, brief `docs/slices/briefs/search-tidy.md`, notes
`.omp/run/notes/SearchTidy.md`) passed the boundary review; the correctness review has one block.

**#1734 (block)** `frontend/src/ui/ChoiceView.vue:42`. A keyboard-only request (match `null`) can already be waiting for
this path when a ChoiceView mounts. `useSearchGoTo` then runs the callback during setup: its `immediate` watch runs the
first check synchronously and ignores `flush: "post"` (vue 3.5 `reactivity` `watch`: `if (cb) { if (immediate) job(true) … }`).
`section.value` is still null, so `focusFirstButton` does nothing, `took` still clears the request, and focus stays on
`<body>` — the round-1 bug again. Reachable: Reset on a choice file (`saving.ts` ~191–193 drops the view and mounts a new
one after the `describeFile` round trip) while the open search is hidden from the body during that round trip
(`SearchPanel.vue` → `focusShownFile`). MergeView and RangeView are safe: their controllers keep the request until the
editor or sentence exists.

Fix: in the callback, focus after the render (`void nextTick(focusFirstButton)`); later runs already flush after the
render and behave as before. Change nothing else.

## Target

Owned: `frontend/src/ui/ChoiceView.vue`. Read-only: everything else.

## Acceptance

- `pnpm -C frontend sfc-order`, `typecheck`, `lint`, `test`, `fmt:check`, `unused` pass.
- WebKit real app (`just app-session start-app --fresh-repo`, `assets/logo.bin` shown; your own session name), dark and
  light: reproduce the mount case **before** the fix and show it passes after. One way: with the search open and focus
  on the page, run one script that clicks Reset and, in the same task, dispatches the hide key (Ctrl+Shift+S), so the
  hide lands during Reset's round trip; then read `document.activeElement` once the view is back. Before: `BODY`;
  after: the first enabled choice button. Also re-run round 1's plain case (choice file shown, focus on body,
  Ctrl+Shift+S twice → "Take left"). Paste values and screenshot paths. If your script cannot hit the window, say how
  you tried and what you saw.

## Skills

`skill://vue-conventions`, `skill://verification` (plus your autoloaded ones).
