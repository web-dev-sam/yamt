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

## Reviews (round 1)

Boundary fail: #1700 block (the merged `#centerSync` listener loses CodeMirror's per-listener error isolation, so a
throw skips the saved point the close guard reads), #1701/#1702 promoted, #1703 dropped. Correctness fail: #1712
block (`resultVersion` on edits proven only through a mock), #1713 promoted (touching mid-line spans overlap), #1714
dropped. Mutation run `just mutants ec191ff`: survivors on older lines and the untested handle pass-throughs.

## Fix round 1 (`SearchGoToR1`, 7m29s, patch `fe204ab`, `.omp/run/patches/SearchGoToR1.patch`)

`editor/merge.ts` (new, 299 lines) holds `MergeController`, `MergeHosts`, `MergeOptions`; `editor/index.ts` 18 lines
of re-exports. The Result's jobs are separate listeners again (`#statusSync`, `#serverSync`, `#savedSync`, a new
`#resultSync` firing only on `docChanged`). `editor/internal/lineUp.ts` (new): `ResultLineUp`, `changeLines`,
`resultLineUp` (each Result range starts at or after the previous end; test fails before: `{10,1}` vs `{11,0}`).
`useMergeController` waits for a go-to like the range hook (`Live { controller, goTo }`, `askGoTo`). WebKit probe on the
merge fixture: `resultVersion` 1 after build, +0 cursor click, +1 typing, +0 ArrowDown, +1 apply, +1 undo, +0 a
status-only ignore. A new test kills the handle pass-through survivors. 212 files / 2892 tests; typecheck, lint, fmt
clean (`unused` still flags the handle types until the window build). New files for docs: `editor/merge.ts`,
`editor/internal/lineUp.ts`.

## Re-check after fix round 1

Boundary pass (#1700–#1702), correctness pass (#1712, #1713; merge listener order unchanged with `#resultSync` last).
Mutation run `just mutants f7e2498`: survivors only on older host-null lines (88–92, 98, 119) and `flush` (232).
Accepted.

## Fix round 2 (session 36, after final run pass 2; `SearchGoToR2`, 9m11s, patch `fb11db9`, `.omp/run/patches/SearchGoToR2.patch`)

#1745: a side-pane icon on an open merge file left the match out of view. Cause (WebKit scroll log): the side's
`scrollIntoView` wrote first, the reveal then made CodeMirror height-keep the Result and the other side, their scroll
events came last in the next frame and led the sync, dragging the side back. Fix: `goTo` calls
`this.#frame.realign(pane)`; `Frame.realign(source)` (was `follow("center")`), `setCollapsed` passes `"center"`.
Before/after dark/light, Local and Remote: `inView` false → true at +0/+500/+1000 ms, stretch shown; Result row,
unopened file, range side still in view. 2988 tests. `just mutants fcb17df`: nothing mutated (editor/). Reviews: both
fail on #1748 (the realign also runs for `match: null`: the hide's keyboard-only go-to makes the Result lead and a side
inside a zero-height Result span jumps); #1750 (editor guide, promoted); #1749 (browser test, dropped: cannot run here);
#1751 applied in architecture. Round 3 under the standing Gate B answer (#1744, #1752).

## Fix round 3 (`SearchGoToR3`, 6m51s, patch `6c5c96e`, `.omp/run/patches/SearchGoToR3.patch`)

`goTo` realigns only when `match !== null` (#1748); `editor/AGENTS.md` lines 21/23 (#1750). To stay under the 300-line
lint limit, `#serverSync` and `#savedSync` merged into `#serverAndSavedSync` (same order; accepted by both lenses).
WebKit dark, `vueuse-use-magic-keys.ts` (a pending RemoteOnly insertion, zero lines in the Result): Remote scrollTop
481 → 411 on the hide before, unchanged after, Result focused; #1745 still in view (Local, Remote, Result). 2988
tests. Re-checks: correctness pass, boundary pass. Accepted. Left a private `dbus-daemon` running (killed by the
orchestrator with R2's).
