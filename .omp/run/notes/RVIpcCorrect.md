```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "frontend/src/ipc/fixtureRange.ts",
      "line": 69,
      "rule_id": "SP5",
      "problem": "No test parses a fixture that has a `deleted` or `renamed` entry (:46-47), a texts reply whose mode is `changed` (:69), or a `tooLarge`, `notUtf8`, `modeOnly`, `kindChanged` or `submodule` reply (:73-78), and none uses the entry kinds (:29). So these survivors would live on even if Stryker re-evaluated module scope. A wrong literal in any of these arms makes `createFixtureRangeSource` throw at load and blanks the `?range` fixture page that row 9 and app-session build on, and every test stays green. That is because fixtureRange.test.ts feeds only inline JSON (`modified`/`added`, `same`, `binary`), while the committed review.json, which holds every arm, is never read by a test.",
      "fix": "In fixtureRange.test.ts, add a test over the committed cases with the default `files`, as fixtureCompare.test.ts's `COMMITTED` does. `?range` should list 13 entries, including the renamed `docs/keys.md` and the deleted `src/api/mockBoards.ts`. Each id's `loadRangeFile` should give the kinds in order (kindChanged, tooLarge, texts, texts, notUtf8, binary, texts, texts, texts, modeOnly, texts with mode changed, texts, submodule). `?range=empty` should list none. Neither fixture uses the `submodule` entry kind, so after the promoted `memberOf` tables that member remains a type-level proof only."
    },
    {
      "severity": "block",
      "file": "frontend/src/ipc/tauriRange.ts",
      "line": 6,
      "rule_id": "SP5",
      "problem": "All 8 mutants in tauriRange.ts are NoCoverage (the implementer's open risk 1). Real app data reaches the range window only through this file. Three bugs here would pass every test and reach row 9's headers and list: `openRange` returning the raw reply (`short_id` and `old_path` instead of `shortId`/`oldPath`); `loadRangeFile` turning `{ ok: false, failure: UnknownRangeFile }` into a value or emptying it; texts differences skipping `toDifferences`'s line checks.",
      "fix": "Add tauriRange.test.ts in tauriCompare.test.ts's pattern (`vi.mock(\"./bindings\", () => ({ commands }))`). It should show that openRange and loadRangeFile return camelCased domain data, that an `UnknownRangeFile` error comes back unchanged as `{ ok: false, failure }`, and that a texts reply with a negative difference line rejects naming `differences[0]…`. The orchestrator widens Owned to that file."
    },
    {
      "severity": "should",
      "file": "frontend/src/ipc/fixtureRange.ts",
      "line": 117,
      "rule_id": "VF7",
      "problem": "The survivor on :117 is the `asked === null` half. `?range` and `?range=` both give `\"\"` and kill the other half, but no test builds the source from a search with no `range` parameter at all. The compare window's store and text tests use exactly that form (`createFixtureCompareSource(log, \"\", {})`). If this stays, row 9's store tests rely on an unpinned default: a regression would show an empty `null` range instead of review.",
      "fix": "Add `\"\"` to the `test.each([\"?range\", \"?range=\"])` in fixtureRange.test.ts (\"%s without a case loads review\")."
    }
  ],
  "checked": [
    "Read the brief 3.RV-ipc.md, the patch (516810c), the report RVIpc.md, the survivors file and RVIpcBoundary.md; I did not repeat its two promoted findings (one shared DIFFERENCE/parsedCases, memberOf tables).",
    "The committed fixtures (a766541) parse through the real module. I ran a throwaway vitest file in /tmp (deleted afterwards; nothing written in the repo) importing fixtureRange.ts with its default glob. `?range` gave `main...feature` with 13 files and every `loadRangeFile` answered (kindChanged, tooLarge, texts, texts, notUtf8, binary, texts, texts, texts, modeOnly, texts, texts, submodule). `?range=empty` gave `feature..feature` with 0 files. No `range.fixture_miss` was logged. So block 1 is a test gap, not a broken page today.",
    "Survivors dropped as #732-class static mutants (module-level schema constants that the vitest runner never re-evaluates, so they come back as Survived despite `--ignoreStatic`; logged as #1609). Each is killed by an existing assertion once evaluated: :25 DEFAULT_CASE by the `?range` → REVIEW_START equality; :27 NULL_SHORT_ID by the unknown-case `shortId: \"0000000\"`; :31-34 RANGE_SIDE by the inline mergeBase and named labels; :40, :43-45, :49-51 by the inline modified/added entries with counted/notCounted lines; :61-63, :67-68 by the inline texts reply with mode same; :72 by the inline binary reply; :84-85 by the 'missing start' parse test and the start equality.",
    "fixtureRange.ts:55, :58 (DIFFERENCE): static, and the inline difference in REVIEW.files[0] kills them; they move into fixture.ts with the promoted shared schema.",
    "fixtureRange.ts:97 ×2: I inferred these are the regex anchor removals (`^` in `/^.*\\//u`, `$` in `/\\.json$/u`); Stryker kept no per-mutant report for this run. They are equivalent (VF7 a) for glob keys of the form `../../fixtures/range/<case>.json`, where `.*\\/` is greedy and `.json` appears once at the end. A `.*`→`.` change would be killed by the FILES keys. The line moves into the promoted `parsedCases`.",
    "Survivors outside the patch's hunks (pre-existing, line-shifted): domain.ts:176-177 are `nextColumnVersion` (+5 lines from the added guard) and :259 is `toListing`; index.ts:104 (`IN_APP`) and :108 (`onWindowClose`); problemText.ts:63/86/111 are older `default` arms, :95-96 `AT_POSITION` `.trim()` (#735), and :129 the WriteFailed `.trim()` (was :125).",
    "rangeDomain.ts killed 26 of 26. The `raw.kind !== \"texts\"` → true mutant (a texts reply passed raw) passes every toEqual, because domain Differences are structurally identical; it dies only on 'a bad line in a texts reply's differences is refused' (rangeDomain.test.ts). The test is kept and this is noted, not a finding.",
    "Conversions traced by hand. Only `renamed` changes shape (`old_path` → `oldPath`); added, modified and deleted pass through. `short_id` → `shortId`. Ids are checked by `isRangeFileId` with the field `files[i].id` (map passes the index). Texts differences go through compareDomain `toDifferences`, so left lines become LeftLine and right lines RightLine, matching `compare(left, right)`; non-texts arms are returned as given. Fixture ids equal their index in review.json (0–12), so `shown.files[file]` loads the listed file.",
    "Brand: `isRangeFileId` = `isNonNegativeInteger`; -1 and 0.5 are refused and 0 accepted (rangeDomain.test.ts 'a file id of %s is refused by the brand').",
    "Acceptance lines map to tests. Every RangeChange arm and the merge-base label: rangeDomain.test.ts first test. Every RangeFile arm: the texts tests plus the `$kind` table. `?range=review` lists the case; bare `?range`/`?range=` loads review; an unknown case logs `range.fixture_miss` with `known: \"empty, review\"` and an exact empty start; unknown id → `UnknownRangeFile` (both for a missing case and for an id past the list): fixtureRange.test.ts. The new reason: problemText.test.ts:183.",
    "problemText.ts: `UnknownRangeFile` is in FIXED_REASONS and the fall-through case group. Removing `default: never` is accepted: the `string` return type makes a missing kind a TS2366 error, and switch-exhaustiveness-check covers it.",
    "tauriRange `openRange` is infallible, matching bindings.ts:41 (`__TAURI_INVOKE<RangeStart>`, no typedError); `loadRangeFile` goes through `toResult` as tauriCompare does. The deviation is accepted.",
    "map-check.sh: the sed `^  \\([a-zA-Z]*\\)(` picks up both RangeSource methods.",
    "No risk-register row (RK1–RK27) owns ipc/range or problemText; merge-core §3.1 and CM1–CM9 do not apply because the patch has no merge-core or editor changes.",
    "I ran no workspace toolchain. Besides the throwaway committed-fixture parse described above, I ran no test."
  ]
}
```