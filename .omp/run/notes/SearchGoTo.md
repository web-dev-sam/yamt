# SearchGoTo — notes (session 35)

Slice brief `docs/slices/briefs/search-goto.md`; web-impl `SearchGoToB` (the first run, `SearchGoTo`, was interrupted
and left nothing), isolated, 21m56s. Patch `4c42cc6` (base `ec191ff`), `.omp/run/patches/SearchGoTo.patch`; 9 files,
+545 −32.

## Summary (implementer)

- `editor/internal/goTo.ts`: `matchRange` (clamps a stale match), `goTo` (find's `selectMatch`, then focus; `null`
  only focuses), `changeLines`, `resultLineUp`; `PaneMatch`, `MergeGoTo`, `ResultLineUp` defined there and re-exported.
- `MergeController.goTo`/`lineUp`/`onResultChange`; `RangeController.goTo`, `RangeGoTo`.
- `MergeHandle.resultVersion`/`lineUp()`/`goTo()` (a go-to before a build waits, the latest wins, applied once after
  the next build, never on a rebuild); `RangeHandle.goTo` the same in `Live`; `ShownRange` picks `goTo`.

## Tests

`goTo.test.ts` (10: clamps; `changeLines` whole lines, insertion points, end-of-document mid-line, CRLF; selection as
find's `select.search` before focus; `null` focuses only; stale match; a collapsed Result reveals; a side pane's
`sideReveal`; `resultLineUp` grows only the Result's lines); `useMergeController.test.ts` (pending go-to once;
`resultVersion` bumps; `lineUp` null without an editor); `useRangeController.test.ts` (go-to waits for load, hosts and
the thread list; none after unmount).

## Evidence (implementer)

typecheck, lint, fmt clean; node 205 files / 2819 tests (one of five runs under load had `1 failed`, name not
captured — flaky per VF2). `unused` fails on 7 new types until the window build imports them (expected by the brief).
Stryker on the two `ui/` files 90.61 %, no survivor on changed lines. WebKit probe (handles on `globalThis`, removed):
merge Result line 240 selected "isTsLang", scrollTop 0 → 2560, centred, focused, waves 4 → 0; right pane the same;
range right line 301 and left 295 selected and centred, focused. Screenshots `/tmp/goto-probe/`.

## Deviations (accepted)

1. `editor/index.ts` kept at 300 lines by merging the Result's three listeners into one `#centerSync` (order kept,
   also fires `onResultChange`), inlining `#statusesChanged`/`#press`, merging two imports.
2. Several go-tos before a build: the latest wins; with an editor it goes at once.

## Open risks (implementer)

- **Selection shrinks to a cursor in WebKit** 1–4 frames after the go-to in most probes (all but the first after a
  fresh session): CodeMirror adopts the browser's selection (`DOMObserver.onSelectionChange` → `applyDOMChange`); a
  plain contenteditable on the app page also lost its range within a frame, a `data:` page kept it. Not the go-to code
  [INFERENCE]; the window/connect smoke must check the selection stays (focused window).
- One flaky node run (name not captured).
