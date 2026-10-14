# SaveIpc (3.Z-ipc, board row 3b) — committed fd49001


**summary**
- The fixture schema now checks a chunk's `waiting` (`WAITING`, one of SideLines / Markers / AsShown), and the domain `Chunk` copies it unchanged in `toChunk`.
- `ChunkSource.saveFile({ path, text, diskVersion })` is mapped onto `commands.saveFile` in `tauri.ts`, the same way `finishFile` is.
- In fixture mode, `saveFile` logs `fixture.save` with the path, the text's length and its line count. It replies `Written` with the current files and does not mark the file resolved.

**files_changed**
- `frontend/src/ipc/fixture.ts`, `fixture.test.ts`, `domain.ts`, `ChunkSource.ts`, `tauri.ts`, `tauri.test.ts`
- `frontend/src/ui/store.test.ts` (added to Owned by Main)
- `frontend/src/editor/internal/{apply,chunkField,decorations,foldRuns,folds,gap,pane,sides,tone,words}.test.ts` (added to Owned by Main)

**tests_added**
- `fixture.test.ts` "each committed fixture's conflicts wait as markers and its other changes as side lines": across all 11 committed fixtures, every conflict is `Markers` with `open` starting `<<<<<<< `, the last `between` line `=======`, and `close` starting `>>>>>>> `. Every other change is `SideLines`.
- `fixture.test.ts` "a conflict of vueuse-use-magic-keys.ts arrives intact" now also checks that chunk 8's exact `waiting` value arrives.
- `fixture.test.ts` "a chunk waiting as %j arrives as it is" (SideLines, AsShown, Markers with a base section): each kind is copied unchanged into the domain chunk. AsShown appears in no committed fixture, so this is the only test that covers it.
- `fixture.test.ts` "a record with %s is rejected naming the file" gains four cases: an unknown waiting kind, markers without `close`, `between` given as one string, and a missing `waiting`. Each error names the field, e.g. `chunks.0.waiting.close`.
- `fixture.test.ts` "save writes the file, logs its length and lines, and leaves it unresolved": the reply is `Written` with both files still Unresolved, an unknown path gives `UnknownPath`, there is exactly one log entry `fixture.save {path, length: 13, lines: 3}`, and `listFiles` still shows the file Unresolved.
- `tauri.test.ts`: the test chunk now has a Markers `waiting`, and `loadFile`'s domain result is expected to carry it.
- `tauri.test.ts` "saveFile sends its three arguments and returns the reply or the app's error": the call is `("src/a.ts", "saved\r\n", 2)`, the `Written` reply and the `WriteFailed` error come back unchanged, and `finishFile` is never called.

**smoke_evidence**
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, no errors, exit 0
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no findings, exit 0
- `pnpm -C frontend test` → `Test Files  70 passed (70)` / `Tests  809 passed (809)`
- `pnpm -C frontend unused` → `$ knip --include exports,types`, `unused exit 0`
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`

**deviations_from_brief**
- `WAITING` is written as `const WAITING: v.GenericSchema<Generated.Waiting> = v.variant(...)`, not `satisfies SchemaOf<Generated.Waiting>`. `SchemaOf` maps an object's keys, so it cannot describe a union; the existing `MIDDLE` union schema uses this same form.
- `textSide` became `lineCount(text)`, shared by `describeRecord` and the save log so both count lines the same way. The one-line `textSide` wrapper was inlined, so the `SideContent` import in `fixture.ts` went with it.
- I moved the four write actions (finish, save, reset, take) out of `createFixtureSource` into `fixtureWrites(log, records)`. Adding `saveFile` pushed `createFixtureSource` over the 40-line limit (lint `max-lines-per-function`, 44 lines).
- Changing the contract broke tests outside the original Owned list, and Main added them to it:
  - `ui/store.test.ts`: each of its two hand-built ChunkSources gained a `saveFile` stub.
  - The 10 editor test files above built fixture records without `waiting`, which caused 84 failures. Each record got `waiting`: Markers (`<<<<<<< ours` / `=======` / `>>>>>>> theirs`) for Conflict chunks, SideLines otherwise. No assertions changed.
- `ipc/index.ts` needs no change: `Chunk` is already exported from it, and consumers read `chunk.waiting` through that type.

**open_risks**
- `.omp/run/slices.json` shows as modified in the work tree. I did not change it; it is probably orchestration state.
- The `saveFile` log's `length` field is in UTF-16 units (`text.length`), not bytes (`frontend/src/ipc/fixture.ts:211`). This only affects fixture mode.