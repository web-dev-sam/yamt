# RawCompareIpcR1 (3.C-ipc rework 1, board Raw compare row 7)

All six review blocks are fixed. I applied both survivor mutations by hand: each new test failed against its mutation and passed again once I reverted it. `typecheck`, `test`, `lint` and `fmt:check` pass. `unused` lists five exports that later rows will import, which the brief expects.

```
summary
  - ipc/compareDomain.ts no longer re-exports the four brands. ipc/index.ts now exports ColumnVersion, LeftLine, RightLine and TabId from ./domain.
  - Column and TabLanguage are now built from the generated types: Column = Generated.Column, TabLanguage = Readonly<Generated.TabLanguage>.
  - ipc/fixture.ts exports one helper, parsedFixture(schema, name, json, convert), and both fixture sources use it. The prefixes are unchanged: "fixture …" for merge fixtures, "compare fixture …" for compare cases.
  - tauriCompare.ts drops the `converted` helper and uses tauri.ts's inline ok-map form.
  - Two new tests close the survivors: an edited left column after ?raw=words, and a bare ?raw / ?raw=.

files_changed
  frontend/src/ipc/compareDomain.ts
  frontend/src/ipc/CompareSource.ts
  frontend/src/ipc/index.ts
  frontend/src/ipc/fixture.ts
  frontend/src/ipc/fixtureCompare.ts
  frontend/src/ipc/fixtureCompare.test.ts
  frontend/src/ipc/tauriCompare.ts

tests_added
  fixtureCompare.test.ts "an edited left column after ?raw=words answers no differences (catches matching the right column only)"
    Proves that after ?raw=words, a setColumn on the left with changed text at nextColumnVersion answers differences: [] and logs exactly one compare.fixture_miss { tab, left: edited.length, right: words.right.length }. This catches #1507.
  fixtureCompare.test.ts test.each(["?raw", "?raw="]) "%s without a case starts one empty Compare 1 (catches a bare ?raw read as a case name)"
    Proves both searches start one "Compare 1" with holdsText: false, and loadTab gives empty texts, versions 0/0 and no differences. This catches #1508.

smoke_evidence
  pnpm -C frontend exec vitest run --project node src/ipc
    → Test Files  11 passed (11) / Tests  201 passed (201)
  Block 5 mutation by hand (differencesOf: `each.left === texts.left` → `true`):
    → × an edited left column after ?raw=words answers no differences (catches matching the right column only)
      AssertionError: expected [ { …(3) }, { …(3) }, …(3) ] to deeply equal []
      Tests  1 failed | 18 passed (19)
    Reverted: the file hash went back to #0D0C, the same as before the mutation.
  Block 6 mutation by hand (firstTabs: `raw === ""` → `false`):
    → × ?raw without a case starts one empty Compare 1 …
      × ?raw= without a case starts one empty Compare 1 …
      Error: no compare fixture ; known: json-payload, typescript, words
      Tests  2 failed | 17 passed (19)
    Reverted: hash back to #0D0C.
  pnpm -C frontend typecheck → `$ vue-tsc -b`, no errors
  pnpm -C frontend test → Test Files  142 passed (142) / Tests  1893 passed (1893)
  pnpm -C frontend lint → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no diagnostics
  pnpm -C frontend fmt:check → All matched files use the correct format.
  pnpm -C frontend unused (exits 1; the brief expects these):
    Unused exports (1): createTauriCompareSource src/ipc/index.ts:85:10
    Unused exported types (4): ColumnWrite :10, CompareStart :11, LeftLine :34, RightLine :44

deviations_from_brief
  - Changed frontend/src/ipc/CompareSource.ts (outside the original Owned list; Main granted it). Dropping the re-export broke its `TabId` import from ./compareDomain, so it now imports `TabId` from ./domain.
  - parsedFixture takes the whole message prefix as `name` (`fixture ${file}` / `compare fixture ${file}`), not the bare file name. This keeps each source's prefix as the brief allows.
  - In index.ts, ColumnVersion, LeftLine, RightLine and TabId now sit in the ./domain export list in alphabetical order. Every exported name keeps its type.

open_risks
  - frontend/src/ipc/compareDomain.ts:18 `Readonly<Generated.TabLanguage>` only makes each variant's fields readonly because TypeScript's Readonly<T> applies to each member of a union, so it matches the contract's union. typecheck accepted it at every use, but I wrote no type-level test for it.
  - frontend/src/ipc/fixtureCompare.ts:101: I hand-tested only the `raw === ""` → `false` survivor. I assume the other survivor at that line (e.g. the `""` string literal swapped for another string) behaves the same way: a bare ?raw is then looked up as a case and throws, which the new test catches. [INFERENCE]
```