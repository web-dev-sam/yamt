# Slice MrConflictsWindowR1 — fix round 1 of the merge window's Abort, leftovers and push

Board "Merge-request conflicts" row 6. Round 1: `MrConflictsWindow` (commit `3045b99`, brief
`docs/slices/briefs/mr-conflicts-window.md`, notes `.omp/run/notes/MrConflictsWindow.md`). Fix exactly these
(`just findings 2015 2023 2024 2025 2026`):

1. **#2015** (the app build's finding; it reaches your imports): the six merge-window aliases (`MergeView`, `ReturnTo`,
   `BranchBefore`, `Leftover`, `AbortReply`, `PushReply`) move from `ipc/mergeRequestDomain.ts` to new
   `ipc/localMergeDomain.ts`, which imports only `bindings`; `domain.ts`'s `Listing.mergeRequest` uses its `MergeView`
   (one spelling); `index.ts` exports them from there; `ChunkSource.ts` and `fixtureOperations.ts` import from it.
   Clean cutover, no re-export left behind. `Started`, `Refusal`, `LocalMerge` stay in `mergeRequestDomain.ts` (the
   page's resolve replies; the page build runs beside you and imports them from there).
2. **#2023** `fixtureOperations.ts`'s `step`/`ended`/`committed` become one sum `phase` (`at { step }` | `committed` |
   `ended { reply }`), the comment explaining their combinations deleted.
3. **#2024** One `mergeOfText({ target, branch })` builds "the merge of <target> into <branch>", used by both
   `questionText.ts` and `operationText.ts`.
4. **#2025** A failed push or close IPC call is its own problem: a `push` action in `problem.ts`/`problemText.ts`
   ("Could not push <branch>: …"; a failed close after Keep Local or after the leftovers notice gets the words of the
   step it closes, never "Could not commit the merge"). `pushing.test.ts` asserts the words.
5. **#2026** After `ReadyToPush` the window is ended for every reader: `endsApp: () => true` for the Continue that
   answers `ReadyToPush`, for the push run and for an Abort that answers leftovers, so `running` stays true and
   `continueState`/`abortState` are not `ready` behind the push, pushFailed and leftovers questions;
   `continuing.test.ts` expects `running` there. Check in WebKit (`…&mergeRequest=created&clean&push=rejected` → Commit
   merge → the push question: both operation buttons disabled; `shot`).

## Target

Owned: round 1's files (brief `Target`, plus `ui/questionText.ts`, `ui/questionText.test.ts`);
`frontend/src/ipc/{domain.ts,mergeRequestDomain.ts,index.ts}`, new `frontend/src/ipc/localMergeDomain.ts`;
`frontend/src/ui/{problem.ts,problem.test.ts,problemText.ts,problemText.test.ts}`. Read-only: everything else; the page
build owns `ipc/AGENTS.md` and `ui/AGENTS.md` — put the sentences in `deviations_from_brief`.

## Acceptance

- Each item's test fails on round 1's code (say how you checked); item 1: `pnpm -C frontend typecheck` and
  `grep -rn 'Generated.MergeView' frontend/src --include=*.ts` shows only `localMergeDomain.ts`.
- `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `sfc-order`, `test`: summary lines; the item-5 WebKit `read` and
  shot.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://vue-conventions`, `skill://ipc-contract`, `skill://verification`.
