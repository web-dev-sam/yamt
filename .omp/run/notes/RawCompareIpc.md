# RawCompareIpc (3.C-ipc, board Raw compare row 7)

The compare window's sources are built, and four of the five frontend recipes pass. The fifth, `pnpm unused` (knip), fails. It lists the new public exports as unused because their importers are rows 8, 9 and 11 (editor fields, the compare store, wiring in `main.ts`), which don't exist yet.

**summary**
- `ipc/compareDomain.ts` holds the compare window's domain shapes and converts every reply once: camelCase names, brands set by the `domain.ts` guards, a bad number refused through the existing `invalid` path.
- `ipc/CompareSource.ts` is the interface. `ipc/tauriCompare.ts` implements it, with one method per generated command through the existing `toResult` and the merge window's settings methods.
- `ipc/fixtureCompare.ts` is the in-memory fixture source. `?raw=<case>` loads that case into tab 1. The tab rules mirror `crates/compare`. On a text miss, `setColumn` logs `compare.fixture_miss` and answers no differences.
- `ipc/index.ts` re-exports everything the contract names.

**files_changed**
- `frontend/src/ipc/compareDomain.ts` (new)
- `frontend/src/ipc/CompareSource.ts` (new)
- `frontend/src/ipc/tauriCompare.ts` (new)
- `frontend/src/ipc/fixtureCompare.ts` (new)
- `frontend/src/ipc/compareDomain.test.ts` (new)
- `frontend/src/ipc/fixtureCompare.test.ts` (new)
- `frontend/src/ipc/tauriCompare.test.ts` (new)
- `frontend/src/ipc/domain.ts`: the four compare brands, guards `isTabId`/`isColumnVersion`/`isLeftLine`/`isRightLine`, `nextColumnVersion`, and `export` added to `LineRange` and `toRange`. It is now 281 lines.
- `frontend/src/ipc/tauri.ts`: `export` added to `toResult` and `createTauriSettings`.
- `frontend/src/ipc/fixture.ts`: `export` added to `LINE_RANGE` and `SIDE_WORD_CHANGES`, nothing else (Main gave me ownership).
- `frontend/src/ipc/index.ts`: the contract's exports.
- `frontend/src/ipc/AGENTS.md`: one sentence on the compare sources.

**tests_added**
- `compareDomain.test.ts`:
  - "a start and a tab's texts convert every field, camelCased, with both columns' words": proves `holds_text` → `holdsText`, `column_limit` → `columnLimit`, both languages, and the ranges and words of both columns.
  - "a tab id or the shown tab of %s is refused", "a column limit of %s is refused", "a column version of %s is refused on either column", "a line of %s is refused in either column's range or words": each runs with -1 and 0.5 and checks that the field is named.
  - "nextColumnVersion adds one".
- `fixtureCompare.test.ts` (each title names the bug it catches):
  - first start shows one empty "Compare 1" and the limit
  - `?raw=json-payload` puts the case in tab 1 and `loadTab` returns its 4 differences
  - an unknown `?raw` case fails the start
  - numbers come from the highest open tab and ids never repeat: closing "Compare 2" of three gives "Compare 4"; closing "Compare 4" then adding gives "Compare 4" again with id 5
  - closing the shown tab shows the next, then the previous, and the last tab leaves a fresh "Compare 1" (id 4)
  - closing a tab that isn't shown keeps the shown one
  - a rename is trimmed, and spaces only keep the old name
  - a picked language and the shown tab are kept
  - a stale version (same or older) stores nothing and replies with the stored versions; `holdsText` turns true
  - a column over the limit counted in UTF-8 bytes is refused even though its UTF-16 length is under it, and nothing is stored
  - a column of exactly the limit is stored
  - a miss logs one `compare.fixture_miss` with the tab and both lengths and answers `[]`; a match answers the case's differences without logging
  - all six tab commands answer `UnknownTab` for an id that isn't listed
  - a broken case file fails the parse naming the file, for 3 kinds of breakage
- `tauriCompare.test.ts`: written because `tauri.test.ts` already tests the mapping beyond forwarding.
  - `openCompare` and `loadTab` turn replies into domain data
  - `setColumn` sends its four arguments in order
  - each tab command returns the domain list or the app's error unchanged
  - a fractional tab id in a reply is refused
  - a string error from Tauri rejects the call

**smoke_evidence**
- `pnpm exec vitest run --project node src/ipc/compareDomain.test.ts src/ipc/fixtureCompare.test.ts src/ipc/tauriCompare.test.ts` → `Test Files  3 passed (3)`, `Tests  31 passed (31)`
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, no errors
- `pnpm -C frontend test` → `Test Files  132 passed (132)`, `Tests  1830 passed (1830)`
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no findings
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- `pnpm -C frontend unused` → **fails**: "Unused exports (3)" (`nextColumnVersion`, `createFixtureCompareSource`, `createTauriCompareSource` in `index.ts`) and "Unused exported types (19)" (the contract's type exports in `index.ts`, plus `TabEntry` and the re-exported brands in `compareDomain.ts`). All of them are exports the contract requires. Their importers arrive in rows 8, 9 and 11, and I have no owned importer for them.

**deviations_from_brief**
- The four brand types (`TabId`, `ColumnVersion`, `LeftLine`, `RightLine`) are declared in `domain.ts`, and `compareDomain.ts` re-exports them (`export type { ... } from "./domain"`). The contract shows them declared in `compareDomain.ts`. A type-only import from `domain.ts` back into `compareDomain.ts` counts as an import cycle under `scripts/fences.test.ts` (PM5). Consumers get the same types from the same modules.
- `fixture.ts` exports `LINE_RANGE` and `SIDE_WORD_CHANGES`, approved by Main, so the schemas aren't copied.
- `tauri.ts` now exports `toResult` and `createTauriSettings`, which the brief implies.
- Decided where the brief was silent:
  - An unknown `?raw=<case>` makes `createFixtureCompareSource` throw, naming the case and the known ones. An empty `?raw` starts empty.
  - `loadTab` answers matching differences without logging a miss; only `setColumn` logs one.
  - `toCompareStart` refuses a negative or fractional `column_limit`.
  - The fixture checks the tab exists, then the version, then the size, in the same order as `TabStore::set_column`.
- Needed outside my files:
  - `just map-check` (PM6) needs `CompareSource.ts`, `compareDomain.ts`, `tauriCompare.ts` and `fixtureCompare.ts` named in `docs/architecture.md` and the `frontend/src/ipc` line of the project map.
  - `skill://ipc-contract` needs the eight compare commands and `CompareSource` listed.
  - knip stays red until rows 8, 9 and 11 import the exports.

**open_risks**
- `frontend/src/ipc/fixtureCompare.ts`, in `setColumn`: the byte count uses `new TextEncoder().encode(text)`, which copies up to 8 MiB on each send in fixture mode. That is acceptable for fixtures but would be slow while typing in a huge column.
- `frontend/src/ipc/fixtureCompare.ts`, in `differencesOf`: it compares the texts with every case on each call, which is cheap with 3 cases.
- `frontend/src/ipc/domain.ts`, in `nextColumnVersion`: it doesn't cap at Rust's `u32` maximum, the same as the other guards. The Rust side would refuse a version past it.