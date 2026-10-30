# Slice MrConflictsPageR2 — fix round 2: one close of an ended recorded merge

Board "Merge-request conflicts" row 7. Rounds before: `b8aeae1`, `1bd8483` (brief
`docs/slices/briefs/mr-conflicts-page-rework-1.md`, notes `.omp/run/notes/MrConflictsPageR1.md`). Fix exactly this
(`just findings 2035`):

1. **#2035** `aborting.ts`'s `closeAborted` and `pushing.ts`'s `closed` are one function: the close of an ended
   recorded merge (`closeEndedMerge` through `gitRun` with `endsApp: () => true`, a failure reported as `closeMerge`
   of the merge read before the action). It lives in `pushing.ts` (or a small new `ui/closingMerge.ts` if that keeps
   each file one job), typed on what it uses; both callers use it. Behaviour and words unchanged: the existing
   `aborting.test.ts` and `pushing.test.ts` close tests stay green unchanged.

## Target

Owned: `frontend/src/ui/{aborting.ts,aborting.test.ts,pushing.ts,pushing.test.ts}`, new
`frontend/src/ui/closingMerge.ts` (+ test) if used. Read-only: everything else; a `ui/AGENTS.md` or tree.md line goes in
`deviations_from_brief`.

## Acceptance

- No copy left: `grep -n closeEndedMerge frontend/src/ui/*.ts` shows one call site outside tests.
- `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`: summary lines.
- `just mutants HEAD` in your workspace (SP11); survivors on changed lines listed with their VF7 letter.

## Skills

`skill://ts-conventions`, `skill://verification`.
