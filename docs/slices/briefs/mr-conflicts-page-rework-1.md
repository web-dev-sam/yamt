# Slice MrConflictsPageR1 — fix round 1 of the merge-request page (and the merge window's last close wording)

Board "Merge-request conflicts" row 7. Round 1: `MrConflictsPage` (commit `b8aeae1`, brief
`docs/slices/briefs/mr-conflicts-page.md`, notes `.omp/run/notes/MrConflictsPage.md`). Fix exactly these
(`just findings 2029 2030 2031 2034`):

1. **#2029** `pnpm -C frontend unused` clean: `BranchBefore`, `BlockedReason`, `ChangeSize` are exported and imported
   nowhere. Import them by name where a signature already spells them another way (e.g. `sizeText(size: ChangeSize)`
   per the brief's contract), else drop the alias and its `ipc/index.ts` export.
2. **#2030** One keyed per-row map write and running guard shared by the open-changes button (`setOpening`,
   `openChanges` in `ui/mergeRequests.ts`) and the row actions (`setActing`, `act` in `ui/mergeRequestActions.ts`).
3. **#2031** `ui/AGENTS.md`: the merge window's sentences in their own paragraph, `mergeRequest` added to what
   `listing.ts` writes, and the push/close problems as they now are (`push` "Could not push <branch>", `closeMerge`
   "Could not close the merge of <target> into <branch>").
4. **#2034** (the merge window's, after its two rounds; orchestrator's call): a failed `closeEndedMerge` after an Abort
   with leftovers reports `{ action: "closeMerge", merge: <the pressed merge request>, cause }`, never "Could not abort
   the merge"; `aborting.test.ts` expects those words.

## Target

Owned: round 1's files (brief `Target`, plus `ui/mergeRequestActions.ts` and its test);
`frontend/src/ipc/{index.ts,mergeRequestDomain.ts,localMergeDomain.ts}`; `frontend/src/ui/{aborting.ts,
aborting.test.ts}`. Read-only: everything else.

## Acceptance

- Items 2 and 4: a test fails on round 1's code (say how you checked). Item 1: `pnpm -C frontend unused` output.
- `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `sfc-order`, `test`, `unused`: summary lines.
- `just mutants HEAD` in your workspace (SP11); list every survivor on a changed line as `file:line mutation` with its
  VF7 letter — a constant a test asserts is (b) #732, not (a) or (c).

## Skills

`skill://ts-conventions`, `skill://vue-conventions`, `skill://verification`.
