# Slice MrConflictsWindowR2 — fix round 2 of the merge window: a failed close is not a failed push

Board "Merge-request conflicts" row 6. Round 1 `3045b99`, round 2 of fixes after `ddc7ffd` (brief
`docs/slices/briefs/mr-conflicts-window-rework-1.md`, notes `.omp/run/notes/MrConflictsWindowR1.md`). Fix exactly this
(`just findings 2028`):

1. **#2028** When `closeEndedMerge` fails after Keep Local (or after a failed push's Keep Local), the problem says the
   close failed, never that a push failed: "Could not close the merge of <target> into <branch>: …" (built with
   `mergeOfText`), its own log event. A failed push IPC call keeps "Could not push <branch>: …". Do it with one problem
   carrying a step (`push` | `close`) or a separate action — whichever keeps `problem.ts` one rule per action.
   `pushing.test.ts` asserts both words.

## Target

Owned: `frontend/src/ui/{pushing.ts,pushing.test.ts,problem.ts,problem.test.ts,problemText.ts,problemText.test.ts}`.
Read-only: everything else (the page build runs beside you in `ui/MergeRequest*`, `ui/mergeRequests*`,
`ui/mergeRequestActions*`, `mergeRequests/**`, the merge-request ipc files and the AGENTS.md files: put your
`ui/AGENTS.md` sentence in `deviations_from_brief`).

## Acceptance

- The close test fails on round 1's code (say how you checked).
- `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`: summary lines.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://verification`.
