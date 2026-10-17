# AltMarksEditor fix round 2 re-check (correctness)

**Verdict: pass.** #1215 is fixed, and #1210's earlier cases still work. I judged this by reading the code and tracing the cases by hand. I ran no tests: there is no block, so RV6 gives no reason to.

```json
{
  "verdict": "pass",
  "findings": [],
  "findings_status": {
    "#1215": "fixed: frontend/src/editor/internal/markJump.ts:53-65. Step 1 selects the innermost still-hidden middle range that holds `start`, both ends counted. Hidden ranges are whole lines and hold at least 2 lines (`MIN_HIDDEN_LINES`, foldRuns.ts:32-38; mapHidden, folds.ts:36-48), so the selection is never empty, even when the place is on an empty line at an edge. holds' third clause (foldSelection.ts:10) is then true."
  },
  "new_tests_fail_for_old_rule": {
    "end of file (folds.test.ts, 'a problem tick's jump to the end of a file ending with a line break…')": "yes. On 3615586's rule, `lineAt(doc.length)` is the empty line 101, so step 1 is an empty selection at hidden.to. holds is false for all three levels, and 76-101, 80-101 and 88-101 stay hidden. The report pastes `expected [ '76-101', '80-101', '88-101' ] to deeply equal []`.",
    "empty first hidden line (folds.test.ts, 'a problem tick's jump to an empty first hidden line…')": "yes. Step 1 is an empty selection at level 0's `from`, so 37-66 stays hidden. The report pastes `expected [ '37-66', '41-62', '49-54' ] to deeply equal [ '41-62', '49-54' ]`.",
    "boundary strength": "The empty-first-line test pins `from <= start` (with `<`, nothing holds and only the cursor moves). The tail test pins `start <= to` and also pins `findLast` over `find`. With `find`, the outer 76-101 is selected, and 80-101 and 88-101 stay hidden because the cursor sits on their `to`, not strictly inside them."
  },
  "regressions": "none found",
  "checked": [
    "#1215, tail case, traced by hand: twoChanges' run 2 is the tail. Its `runEdge.end` is Infinity, so every level ends at `doc.line(doc.lines).to`, which is `doc.length` (foldRuns.ts:33-38). `findLast` picks 88-101, and the selection [88.from, doc.length] satisfies holds' third clause for all three levels. revealKeep (findLastIndex) returns keep 0, so the whole tail shows. Step 2 is a cursor at `doc.length`, inside no level still hidden, so foldField (folds.ts:166-170) reveals nothing more and leaves no selection behind.",
    "#1215, empty-first-line case, traced by hand: deleting line 37's text maps level 0's `from` to the same position (mapPos assoc 1, folds.ts:37). The test's `lineAt(from).length === 0` precondition also guards that level 0 is still hiding, because `levelOf` reads only the levels still hiding (paneFolds → hiddenLevels). Only 37-66 holds `from`. In revealKeep the selection [37.from, 66.to] holds level 0 only (its anchor and head are outside 41-62 and 49-54), so keep is 2 and 41-62 and 49-54 stay hidden, as the test asserts.",
    "#1210, lines with text (the round-1 test, now through `jumpAt`): at `from` or `to` of run 1's level 0, the new rule selects 37-66 and the old rule selected the line. Both are non-empty and held by the same levels, so the result is the same. A cursor-only rule still fails this test.",
    "#1210, nested levels: a place strictly inside an inner level (e.g. 49-54) makes findLast pick that level. The selection lies inside every outer level, so revealKeep's findLastIndex is that level and every level shows. Ranges of different runs are disjoint (2×shift lines apart around each chunk), so `flatMap` across runs cannot pick another run's range.",
    "#1210, a place not hidden at all: no hiding range holds `start` (the whole-line ranges make an inclusive hold the same as 'on a hidden line'; `hidden.to + 1` is the next line's start). The result is `[cursor]`: one dispatch, no selection step. Before, the rule dispatched a line selection and then replaced it with the cursor, so the visible result is the same. With collapsing off, paneFolds is empty and the result is also `[cursor]`. A level the user already opened is not in paneFolds, so it is not selected again.",
    "Equal center ranges on two levels (`differs` in runLevels looks at any pane): findLast picks the inner one, and revealKeep agrees, so both show.",
    "Wiring: index.ts:98 passes `this.#folds.fields`, which is the same `FoldFields` whose `center` field the center pane holds (foldView.ts:186-188) and which Frame already gets (index.ts:94). So `state.field(fields.center)` in paneFolds cannot throw.",
    "jumpInResult is unchanged except for the new argument: each step is its own dispatch, then focus, then `lineBlockAt(start)` read after the reveal (CM9).",
    "index.ts is 300 lines, the oxlint `max-lines` cap of 300, so it is not a lint failure. It now has no room to grow, but this round adds no second job, so I don't raise it under RV8.",
    "Docs: docs/architecture.md:626-630 and editor/AGENTS.md:9 already describe the new rule (innermost hidden range, both ends counted, nothing hidden → only the cursor), so the report's doc deviation is already applied.",
    "Report deviations accepted: the same rule for every place (no empty-line special case, still pure and in one place, as the brief allows); the `revealSteps(state, folds, start)` signature; `JumpParts.folds`.",
    "Open risks judged: the missing tooltip at the very end of the file and the `tickAt` tie between equal tops are outside this patch, which leaves marks.ts and @codemirror/lint's hover alone.",
    "Mutation survivors: none to triage, because editor/ is not mutated (Contract).",
    "No `bash` test run: no block depends on one. The failing lines for the old rule are taken from the round report and agree with my trace."
  ]
}
```