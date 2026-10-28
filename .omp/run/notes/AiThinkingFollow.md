# AiThinkingFollow — the thinking list capped at 20rem, following its end (board "AI thread" row 1)

Brief `docs/slices/briefs/ai-thread-follow.md`; web-impl, isolated, 10 min. Fields read from `agent://AiThinkingFollow`.

## Summary

- `frontend/src/ui/useFollowEnd.ts` (new): the server log's follow rule as one composable (the brief's contract,
  unchanged); users `ServerLogView.vue` (keeps only its anchor code for lines dropped above) and `AiTurn.vue`.
- `AiTurn.vue`: the open list `max-h-80 overflow-y-auto opaque-scroller`, follows its end; an opened list (live or
  recorded) starts at its end; the answer below is not capped. `EditDiff.vue`: `max-h-96` → `max-h-64`.

## Tests

`useFollowEnd.test.ts` (node, effectScope, a fake scroller clamping `scrollTop` like a browser): post-flush scroll to
the grown end; the 1 px slack (499 follows, 498 does not); back at the end follows again; an appearing scroller starts
at its end and following; no scroller → nothing. Stryker on `useFollowEnd.ts`: 31 killed, 0 survived.

## Evidence (the builder's)

- `pnpm -C frontend typecheck|lint|test|fmt:check` pass (199 files, 2716 tests).
- WebKit fixture `--range-case review --threads seeded --ai`, 1600×1000, dark and light: live list max-height 320px,
  gap 0 after each update; scrolled up 120 px at 560 ms → `scrollTop` 348 held while scrollHeight 788 → 808; back at
  the end → 508/828, 528/848 gap 0. Recorded list 320px, opens at its end; answer not capped (287 px); an opened edit
  diff 256px max, shown whole at 28–130 px. Bands equal in every sample (dark); light run a constant 2 px offset from
  before the list opened (from a manual pane scroll). Shots `/tmp/follow-{live-dark,live-light,recorded,recorded-light,diff}.png`.
- Server log (`?servers`, oxlint restarts): opens at its end 364/908/1272; follows 754/908/1662; held at 200 with row
  9 at −12.5 after 20 more lines; follows again 1534/908/2442.

## Deviations (accepted)

- ServerLogView's mount no longer scrolls itself; the composable's watch on the scroller element does it (post flush).
  New: a log scroller that appears again (0 lines → some) resets `following` to true — the contract's rule.
- Tests call `follows.scrolled()` (the linter's unbound-method rule in `.ts`); components destructure it.
- `ui/AGENTS.md` paragraph sent to `AiAskBottom` (owner of that file); project-map line applied by the orchestrator
  in the doc update.

## Open risks (the builder's)

- `AiTurn.vue:47` `opaque-scroller` paints the list `--color-panel` inside the box's `bg-panel-inline`: a slightly
  different shade in both themes, as `EditDiff`'s box already is (request rule 1 named `opaque-scroller`).
- A height change not through `content` (an edit diff loading inside the list) does not scroll the list.
- Bands: a measure far below the viewport once read 20 px apart; on screen equal. Not compared with a run before.
