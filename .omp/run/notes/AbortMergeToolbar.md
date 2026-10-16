# AbortMergeToolbar — 3.A-abort-toolbar (board "Abort merge" row 4, owner correction #1091)

Brief `docs/slices/briefs/3.A-abort-toolbar.md`. Commit `cac453b` on base `ce30d0f`.

## Summary
Toolbar id `abortMerge` first in `TOOLBAR_BUTTONS` (8 ids), right after Mark resolved; shown via
`shownButtons(abortState, hidden)`, menu entries via `listedButtons(abortState)` (no abortMerge while `noMerge`).
`AbortButton`/"hidden" renamed `AbortState = "noMerge" | "ready" | "running"`, store field `abortState`. Each IconButton
carries `disabled` (`abortRunning` for abort, `noSummary` for the others); abort keepsKeyboard true, run `void abortMerge()`.
Storage: same key `yamt.toolbar.hidden`, value now a JSON object id → hidden (true/false) for each decided button; an old
array reads as decisions for the seven ids (in → hidden, absent → shown), Abort merge takes its start state; unknown ids
and non-boolean values dropped; anything else = starting state; defaults never written. `HIDDEN_AT_FIRST` a full
`Record<ToolbarButtonId, boolean>`. FileList.vue byte-identical to pre-feature; App.vue FileList line as before.

## Tests
toolbarButtons.test.ts rewritten (start state, decisions stored and kept, old arrays `[]`, `["undo"]`, `["undo","redo"]`,
`["next","collapse"]` keep seven decisions and hide abort, old array rewritten at first toggle, unknown ids/values dropped,
order, listed/shown by abort state); store.test.ts renames. 1363 web tests.

## Smoke
Fixture page: no button at first; menu 8 entries, Abort merge first unchecked; choose → stored {"abortMerge":false},
toolbar Mark resolved, Abort merge, …; click → the question; old `["undo"]` + reload → Undo hidden, Redo shown, abort
hidden. Real app: same; Abort Merge → app ended, status empty, no MERGE_HEAD; cherry-pick stop → menu 7 entries; file
list header Files + view toggle. Right-click driven by a synthetic contextmenu event (app-session has no right-click).

## Deviations (accepted)
One key kept (old array parsed in the same place). Object written in decision order. `menuAt` moved (VU2). Throwaway dir
renamed to dodge the ownership hook's `cp` pattern. Docs (architecture, project map) → orchestrator.

## Open risks
toolbarButtons.ts: 10 survivors on module-level constants (evaluated once under vitest, #732 class), `catch` equivalent.
Exit status/stderr not re-observed (Rust unchanged) → final run 2.

## Reviews and fix round 1
Boundary fail: #1093 block (old array read against the live list), #1094 promoted (names), #1095 dropped. Correctness fail:
#1096 block (keyboard not back after Cancel/Escape). #1092 static survivors dropped (killed by toolbarButtons.test.ts:55/:60).
Fix round `62bd371` (`AbortMergeToolbarR1`): `OLD_FORMAT_IDS` fixed literal + strict test; `Decisions`/`readDecisions`;
`abortKeepingKeyboard` in MergeToolbar.vue gives focus back to the element focused before the press when the question
left it on <body> (reproduced on the fixture page before: BODY, no cm-focused; after: cm-content, cm-focused, Down/Up move
the outline). Both re-checks pass; mutants: only the #1092 constants.
