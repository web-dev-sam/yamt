# Slice MrWindowState — merge-request sources, domain, the page's state slice and its seam, both stores

Board "Merge requests" row 5 (R2 · B4). Rules: `docs/slices/request-merge-requests.md` (rules 2, 3, 6, 7, 8),
`docs/plan.md` §2 #128–#135. Design (option A, chosen): `.omp/run/notes/MrOverviewDesign.md` — §2.1 window types and
brands, §2.3 "One slice per window", "The shared seam", "Sources", "Problems", "Words", §5 "R2 · B4", §6 "B3 → B4 and
B5 (generated bindings)" and "B4 → B5" (with the slice's rules, wiring, words, fixture scripts), §7 frontend rows for
domain/fixture/slice/words. Those sections are given; build them as written. Round 1 (`MrWindowCore`, notes
`.omp/run/notes/MrWindowCore.md`) built `frontend/src/mergeRequests/`, `ui/glab.ts`, `ui/mergeRequestFilters.ts`;
build on what is committed.

## Target

Owned: `frontend/src/ipc/{MergeRequestSource.ts,mergeRequestDomain.ts,mergeRequestDomain.test.ts,tauriMergeRequests.ts,tauriMergeRequests.test.ts,fixtureMergeRequests.ts,fixtureMergeRequests.test.ts,fixtureMergeRequestData.ts}`,
`frontend/src/ipc/{domain,index,fixture,CompareSource,RangeSource,tauriCompare,tauriRange,fixtureCompare,fixtureRange}.ts`
and their existing `*.test.ts`,
`frontend/src/ui/{screen.ts,mergeRequests.ts,mergeRequests.test.ts,mergeRequestsStore.ts,mergeRequestsText.ts,mergeRequestsText.test.ts}`,
`frontend/src/ui/{problem,problemText,compareStore,rangeStore}.ts` and their existing `*.test.ts`.

Read-only: everything else. `frontend/src/ipc/bindings.ts` is generated from the Rust build running beside you
(`MrOpenCommands`, brief `docs/slices/briefs/mr-open-commands.md`); its TS shapes are design §6 "B3 → B4 and B5",
fixed. The project map and `docs/architecture.md` are not yours; put their lines in `deviations_from_brief`.

Non-goals: every `.vue` file, the button, the page and its components, fence PM10, app-session tooling (B5).

## Contract

Fixed: design §6 "B4 → B5" exactly (`MergeRequestSource`, `Listing`, `Opening`, `MergeRequests`,
`createMergeRequests`, `registerMergeRequests`/`useMergeRequests`), the brands `MergeRequestIid` and `JobPage`,
`createdAt` as ms in the domain, the `problem.ts` action `mergeRequests` with steps `find|list|open|job`, the fixture
scripts `?mr=list|slow|many|empty|noGlab|loggedOut|timeout|refused|pageFails` with per-iid open replies, and: without
`?mr` the project is `none`, so every existing fixture page is unchanged.

## Change

1. ipc: the source interface, domain conversion, Tauri source (one `Channel` per load), fixture source + data; the
   compare and range sources extend `MergeRequestSource`.
2. ui: `screen.ts` gains `mergeRequests`; the slice (`show`/`close`/`refresh`, first load streams pages, a reload swaps
   at its end and keeps old rows on failure, a load id drops stale pages, one load at a time, reload on show only after
   `RECHECK_PAUSE_MS` from `ui/glab.ts`), the seam as `settingsStore.ts` is for Settings, the words (glab sentences from
   `ui/glab.ts` plus the "then Refresh" tails; one sentence per `OpenReply` kind); both stores create, register and
   `findProject()` in start-up beside the existing calls.

## Acceptance

- Vitest node tests of design §7: `mergeRequestDomain.test` (brands, ms times, an unreadable time refused),
  `fixtureMergeRequests.test` (every script answers as named), `mergeRequests.test` (no reload before 30 s, a reload
  at 30 s; a reload keeps rows until its end and on failure; stale pages dropped; open states fetching → opened /
  refused; an IPC failure reported as a problem; filters remembered through `createRememberedFilters`),
  `mergeRequestsText.test` (every `ListEnd`/`OpenReply`/`JobOpened` kind has a sentence; glab words equal the Send
  button's); existing store and source tests green.
- `pnpm -C frontend lint`, `test`, `fmt:check`, `unused`, `sfc-order` pass. `typecheck` needs the new bindings: run it
  and list in `acceptance_not_run` only errors that name a binding type of design §6 (each with file:line); every
  other type error is yours to fix.
- `just mutants HEAD` run in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://vue-conventions`, `skill://ipc-contract`, `skill://verification`.
