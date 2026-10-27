The range window's IPC surface is in place and the brief is done: the `RangeFileId` brand, `rangeDomain.ts`, `RangeSource`, the Tauri and fixture sources, the problem words and the `map-check.sh` loop. Typecheck, lint, format and the full node suite pass. Two checks still fail and need follow-up from you: `pnpm -C frontend unused` and `just map-check`, both explained below.

```
summary
  New: the `RangeFileId` brand and `isRangeFileId` guard in ipc/domain.ts; ipc/rangeDomain.ts (camelCase range shapes, `toRangeStart`, `toRangeFile`, reusing `toDifferences`); ipc/RangeSource.ts; ipc/tauriRange.ts (`createTauriRangeSource`); ipc/fixtureRange.ts (`createFixtureRangeSource(log, search, files = fixtures/range glob)`: a bare `?range` loads `review`, `?range=<case>` loads that case, an unknown case logs `range.fixture_miss` and lists nothing). ipc/index.ts exports the surface.
  ui/problemText.ts: `UnknownRangeFile` → "that file is not part of this range."
  scripts/map-check.sh now loops over `ChunkSource CompareSource RangeSource`.

files_changed
  frontend/src/ipc/domain.ts
  frontend/src/ipc/rangeDomain.ts (new)
  frontend/src/ipc/rangeDomain.test.ts (new)
  frontend/src/ipc/RangeSource.ts (new)
  frontend/src/ipc/tauriRange.ts (new)
  frontend/src/ipc/fixtureRange.ts (new)
  frontend/src/ipc/fixtureRange.test.ts (new)
  frontend/src/ipc/index.ts
  frontend/src/ipc/AGENTS.md
  frontend/src/ui/problemText.ts
  frontend/src/ui/problemText.test.ts
  scripts/map-check.sh

tests_added
  rangeDomain.test.ts:
    - "a start converts both sides and every change, camelCased, keeping the merge-base label": all four RangeChange arms (renamed → oldPath), short_id → shortId, the mergeBase and named labels.
    - "a file id of %s is refused by the brand, naming the field" (-1, 0.5): isRangeFileId refuses it and accepts 0; toRangeStart throws `files[1].id must be a non-negative safe integer, got …`.
    - "a texts reply converts its differences with both columns' words and keeps the mode": both mode arms (changed and same).
    - "a bad line in a texts reply's differences is refused, naming the field".
    - "a $kind reply carries its fields unchanged": binary, tooLarge, notUtf8, modeOnly, kindChanged, submodule.
  fixtureRange.test.ts (inline JSON passed as `files`; row 7's fixtures do not exist yet):
    - "?range=review lists the case's sides and files and loads each file by its id" (no log entry).
    - "%s without a case loads review" for `?range` and `?range=`.
    - "?range=empty loads that case, not review".
    - "an unknown case logs range.fixture_miss naming the known ones and lists nothing": exact empty start, the log entry, and loadRangeFile → UnknownRangeFile.
    - "loadRangeFile of an id past the list answers UnknownRangeFile with that id".
    - "a case file with %s fails the parse, naming the file": a missing start, an unknown file kind, a negative id.
  problemText.test.ts:
    - "a range file Rust does not list says it is not part of this range" → "Could not open src/a.ts: that file is not part of this range."

smoke_evidence
  pnpm -C frontend exec vitest run --project node src/ipc/rangeDomain.test.ts src/ipc/fixtureRange.test.ts src/ui/problemText.test.ts
    → Test Files  3 passed (3) / Tests  65 passed (65)
  pnpm -C frontend typecheck → `$ vue-tsc -b`, no errors
  pnpm -C frontend lint → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no findings
  pnpm -C frontend fmt:check → All matched files use the correct format. (449 files)
  pnpm -C frontend test → Test Files  154 passed (154) / Tests  1999 passed (1999)
  bash scripts/map-check.sh (not my recipe; run only to see what the loop change does)
    → missing: command open_range / load_range_file (not in docs/architecture.md, not in .omp/skills/ipc-contract/SKILL.md); RangeSource.openRange and RangeSource.loadRangeFile (not in docs/architecture.md). These are for you to add to the docs.
  Not observed: Stryker. I did not run `just mutants`.

deviations_from_brief
  - problemText.ts: adding the case pushed `causedText` to 41 lines (max-lines-per-function 40). I removed its `default: never` arm. TS3 allows that form: tsgolint switch-exhaustiveness-check covers it, and TS2366 fails the build if a kind is missing because the function returns `string`.
  - index.ts exports the source interface, the domain types, `RangeFileId` and both factories. It does not export `isRangeFileId`, `toRangeStart` or `toRangeFile`, so nothing outside ipc/ sees DTO conversions (IPC2). I read "exports all of the above" that way; if row 9 needs the guard, it is a one-word re-export.
  - The bindings make `commands.openRange()` infallible (`Promise<RangeStart>`, no typedError). So `createTauriRangeSource.openRange` always answers `ok: true`; an IPC rejection throws, as any invoke rejection does.
  - An unknown fixture case answers openRange with `{ range: <case>, both sides { label: named "HEAD", shortId: "0000000", subject: "" }, files: [] }` and logs `range.fixture_miss` with `{ case, known }`. The brief left that shape open.
  - fixtureRange.ts has its own valibot schemas for range types and Difference. fixtureCompare.ts keeps its Difference schema inline and fixture.ts's `memberOf` is not exported, and neither file is mine, so the Difference schema now exists twice and the entry kinds use `v.picklist`.
  - The worktree had no frontend/node_modules; I ran `pnpm -C frontend install --offline --frozen-lockfile` before the recipes.
  - .omp/run/slices.json shows as modified in the worktree. I did not edit it.

open_risks
  - frontend/src/ipc/tauriRange.ts:6: no test. tauriRange.test.ts is not in my Owned list, so mutants on these lines survive until someone adds one in the pattern of tauriCompare.test.ts.
  - `pnpm -C frontend unused` (knip) fails: index.ts exports for the range surface and several rangeDomain.ts types have no importer until row 9 consumes them.
  - Project map / architecture.md / ipc-contract SKILL.md need: rangeDomain.ts, RangeSource.ts, tauriRange.ts, fixtureRange.ts, the RangeSource methods openRange and loadRangeFile, and the commands open_range and load_range_file.
  - frontend/src/ipc/fixtureRange.ts:29: the entry-kind picklist is not checked against `Generated.RangeEntryKind` for completeness. A new Rust kind would fail only when a fixture uses it.
```