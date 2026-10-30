# Slice MrWindowCore — the merge-request page's pure core, remembered filters, the shared glab words

Board "Merge requests" row 3 (R1 · B2). Rules: `docs/slices/request-merge-requests.md` (rules 3, 4, 5, 6, 8; Acceptance
"Filters, order, counts, relative time and the CI box's contents are tested as pure code"), `docs/plan.md` §2
#128–#135. Design (option A, chosen): `.omp/run/notes/MrOverviewDesign.md` — §2.1 the pure core types and the
remembered form, §2.3 "Pure core", "Remembered filters", "Words", §5 "R1 · B2", §6 "B2 → B4 and B5", §7 frontend core
rows, §9 "orchestrator defaults". Those sections are given; build them as written.

## Target

Owned: `frontend/src/mergeRequests/**`, `frontend/src/ui/{glab.ts,mergeRequestFilters.ts,mergeRequestFilters.test.ts}`,
`frontend/src/ui/{rangeThreadText.ts,rangeThreadText.test.ts,rangeGitLab.ts,rangeGitLab.test.ts}`,
`frontend/scripts/fences.ts`, `frontend/.oxlintrc.json`, `frontend/vite.config.ts`.

Read-only: everything else. The project map and `docs/architecture.md` are not yours (updated once at the feature's
end); put the lines they need in `deviations_from_brief`.

Non-goals (later builds): IPC types and sources, `screen.ts`, the slice `ui/mergeRequests.ts`, the seam, stores,
`mergeRequestsText.ts`, every `.vue` file, fence PM10. Nothing renders yet; the core is used from B4 on.

## Contract

Fixed: design §6 "B2 → B4 and B5" exactly (`mergeRequests/index.ts` exports, `ui/glab.ts`, `ui/mergeRequestFilters.ts`),
with the §2.1 types (`DraftFilter`, `PersonValue`, `LabelValue`, `Filters`, `ListFilter`, `Choice`) and the remembered
form (key `yamt.mergeRequests.filters`, keyed by repository; other repositories' entries kept; unreadable entries
dropped). `StorageLike` is `@vueuse/core`'s; `mergeRequestFilters.ts` builds on `windowStorage.ts`'s `storedValue`.

## Change

1. `frontend/src/mergeRequests/` (index.ts + `internal/`, plus `AGENTS.md` like `search/`'s): filters, choices, order
   (`merged`), summary, relativeTime, ciBox, stored. Self-contained: imports no other `src/` module. Listed as
   `self-contained` in `fences.ts FRAMEWORK_FREE_MODULES`, in `.oxlintrc.json`'s framework-free override (and its
   message), and in `vite.config.ts`'s node test include list.
2. `ui/glab.ts`: the glab sentences the range window's Send button shows (missing, logged out, failed) and
   `RECHECK_PAUSE_MS`, moved out of `rangeThreadText.ts` / `rangeGitLab.ts`; both now import them (clean cutover, no
   second copy, no re-export). The Send button's words do not change.
3. `ui/mergeRequestFilters.ts`: `createRememberedFilters` per the contract.

## Acceptance

- Vitest node tests of design §7 for the core (any value within a filter, all across; Me resolves to the logged-in
  user, never a literal "me" username; None; Draft three ways; a checked value kept at 0; counts over the whole
  list; Me → None → others by name, Label None first; `narrowed`; `merged` dedupe and order with ties; `filterLabel`;
  `summaryText` with and without cut; `createdAgo` at 59 s, 1 min, 23 h, 1 d, 6 d, 7 d, 29 d, 30 d, 364 d, 365 d;
  `ciBox` allow-failure last and the status sentence when no job; `filtersFrom` on junk), `mergeRequestFilters.test`
  (another repository's entry survives a write; a null repository writes nothing), and `rangeThreadText.test` /
  `rangeGitLab.test` unchanged in what they assert and green.
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused`, `sfc-order` pass; `fences.test` passes and a
  `vue` import in `src/mergeRequests/` is refused by `fences.ts` (show the message).
- `just mutants HEAD` run in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://verification`.
