# Slice MrWindowCoreR1 — fix round 1 of the merge-request core

Board "Merge requests" row 3. Round 1: `MrWindowCore` (commit `31aec73`, brief `docs/slices/briefs/mr-window-core.md`,
notes `.omp/run/notes/MrWindowCore.md`). Fix the blocks `#1926`, `#1927`, `#1929` (`just findings 1926 1927 1929`),
nothing else.

1. **#1926** One per-key localStorage record rule: one helper in `ui/windowStorage.ts` (reading the record, writing one
   key while keeping the others as written, removing an emptied key), used by both `serverPins.ts` and
   `mergeRequestFilters.ts`; `readPins` and `readByRepository` deleted. Server pins behave exactly as before.
2. **#1927** A filter value's identity (`sameValue`, and so `toggled` and `checked`) compares kind and payload
   (username, label title), never the display words; `valueWord`/`filterLabel` stay for display only.
3. **#1929** `frontend/scripts/fences.test.ts`: the search module's PM3, PM2 and "importing itself is fine" cases,
   copied for `src/mergeRequests/`.

## Target

Owned: `frontend/src/ui/{windowStorage,serverPins,mergeRequestFilters}.ts` and their `*.test.ts`,
`frontend/src/mergeRequests/internal/{filters,choices}.ts` and their `*.test.ts`, `frontend/scripts/fences.test.ts`.
Read-only: everything else. Contract of round 1 (design §6 "B2 → B4 and B5") unchanged.

## Acceptance

- A test per block that fails on round 1's code: two people with the same name stay two values when toggled; the
  shared record helper keeps another key's entry and removes an emptied one (once, used by both stores); the three
  fence cases fail with `mergeRequests` removed from `FRAMEWORK_FREE_MODULES`.
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused`, `sfc-order` pass; existing server-pin tests
  unchanged in what they assert.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://verification`.
