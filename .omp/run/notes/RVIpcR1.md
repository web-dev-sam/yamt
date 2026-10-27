All five items in the brief are done. typecheck, lint and fmt:check pass. `pnpm -C frontend unused` still exits 1, on 21 findings that were already there before this round (detail in `open_risks`). One full test run had a single failure I couldn't name; the next two runs passed.

## summary
- `fixture.ts` now exports `DIFFERENCE`, `memberOf` and `parsedCases(schema, label, files, convert): Map<string, T>`, which holds the one rule turning a path into a case name. `fixtureCompare.ts` and `fixtureRange.ts` both use them, so their two copies are gone.
- The two `v.picklist`s in `fixtureRange.ts` are replaced by `memberOf(ENTRY_KINDS)` and `memberOf(RANGE_SIDES)`, typed `Readonly<Record<Generated.RangeEntryKind | RangeSides, true>>`.
- New tests: the committed range cases are parsed, the Tauri range source has its own test file (`tauriRange.test.ts`), and the no-parameter default `""` is pinned.

## files_changed
- `frontend/src/ipc/fixture.ts`
- `frontend/src/ipc/fixture.test.ts`
- `frontend/src/ipc/fixtureRange.ts`
- `frontend/src/ipc/fixtureRange.test.ts`
- `frontend/src/ipc/fixtureCompare.ts`
- `frontend/src/ipc/tauriRange.test.ts` (new)

## tests_added
- **fixtureRange.test.ts**
  - "the committed cases parse: review lists 13 files of every kind, empty none" uses the default glob. `?range` lists 13 entries; entry 3 is `docs/keys.md` renamed from `docs/shortcuts.md` (as `oldPath`), entry 6 is the deleted `src/api/mockBoards.ts`. The `loadRangeFile` kinds come back in the brief's order: kindChanged, tooLarge, texts, texts, notUtf8, binary, texts, texts, texts, modeOnly, texts, texts, submodule. File 10's mode is changed from `file` to `executable`. `?range=empty` lists none, and nothing is logged.
  - `test.each(["", "?range", "?range="])` "'%s' without a case loads review" pins the case with no `range` parameter at all.
  - Three new rows in the parse-failure table: an unknown entry kind, an entry kind that is no string (`["file"]`, which kills the `typeof` half of `memberOf`), and unknown sides. Each checks the `expected one of …` message.
- **tauriRange.test.ts**
  - "openRange and loadRangeFile turn the app's replies into domain data": `shortId` and `oldPath` are camelCased, and the id is sent unchanged.
  - "an UnknownRangeFile error comes back unchanged": the reply is `{ ok: false, failure }`.
  - "a texts reply with a negative difference line is refused, naming the field": it rejects with `differences[0].left.start must be a non-negative safe integer, got -1`.
- **fixture.test.ts**
  - "parsedCases names each case by its file name without the last .json": `../a.json/v1.jsonc.json` → `v1.jsonc`. This kills the mutant that removes the `$` anchor.
  - "parsedCases names the file in a parse failure": the error starts `range fixture bad.json: `.

## smoke_evidence
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, no errors.
- With `submodule: true` removed from `ENTRY_KINDS` for one run, then restored, typecheck fails: `src/ipc/fixtureRange.ts(29,7): error TS2741: Property 'submodule' is missing in type '{ file: true; executable: true; link: true; }' but required in type 'Readonly<Record<RangeEntryKind, true>>'.`
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no findings.
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- `pnpm -C frontend test` → `Test Files 157 passed (157)  Tests 2027 passed (2027)`, the last two runs. One run before that, under load (15.9 s instead of the usual 4.6 s), reported `1 failed | 2026 passed`; see `open_risks`.
- `vitest run --project node src/ipc` → `Tests 236 passed (236)`.
- `pnpm -C frontend unused` → `Unused exports (2)`, `Unused exported types (19)`. All 21 are the range surface in `index.ts` and `rangeDomain.ts`, which have no importers yet. I touched neither file, and none of the findings are the new exports `DIFFERENCE`, `memberOf` or `parsedCases`.
- Stryker on the changed lines that run at call time (`fixture.ts:51-56,160-172`, `fixtureRange.ts:101-143`, `tauriRange.ts`, with `--ignoreStatic`): `fixtureRange.ts 100.00`, `tauriRange.ts 100.00`, `fixture.ts 78.95 (15 killed, 4 survived)`. The four survivors:
  - `fixture.ts:53:5` (the arrow becomes `() => undefined`) and `fixture.ts:54:5` / `54:50` (the message): `memberOf` is called at module scope, so these are module-level mutants the vitest runner never re-evaluates (#732 / #1609). The new parse-failure rows would kill them once they are re-evaluated.
  - `fixture.ts:168:20`: removing the `^` from `/^.*\//u` changes nothing, because `.*` is greedy.
  - On the whole of `fixtureRange.ts`, the only survivors are its module-level schema constants, the same class the correctness review already dropped.

## deviations_from_brief
- `LINE_RANGE`, `SIDE_WORD_CHANGES` and `parsedFixture` are no longer exported from `fixture.ts`; their only outside users now go through `DIFFERENCE` and `parsedCases`, and knip would flag the leftover exports.
- `fixtureRange.ts`'s local `parseCases` would have had a single caller, so it is folded into `createFixtureRangeSource`. `fixtureCompare.ts` keeps its `parseCases`, which has two callers.
- I added the two `parsedCases` tests in `fixture.test.ts` and the three `memberOf` refusal rows in `fixtureRange.test.ts` for SP5's mutant kills; the brief didn't list them.

## open_risks
- One full `pnpm -C frontend test` run had one failure, during the slow run noted above. I didn't capture its name, and the next two runs passed. It's probably a timing test that fails under load, not one of the ipc changes: the ipc project passed every time.
- `pnpm -C frontend unused` exits 1 on this branch before this round too (`frontend/src/ipc/index.ts:41-100`, `frontend/src/ipc/rangeDomain.ts:6-30`). It will stay that way until row 9 imports the range surface.
- Neither committed fixture uses the `submodule` entry kind, so `ENTRY_KINDS.submodule` (`frontend/src/ipc/fixtureRange.ts:33`) is covered only by the type check, not by a test.