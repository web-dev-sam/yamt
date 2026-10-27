```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "file": "frontend/src/ipc/fixtureRange.ts",
      "line": 55,
      "rule_id": "promote",
      "problem": "Two fixture-parsing rules are now copied instead of shared. The `DIFFERENCE` valibot schema (55–59) repeats the schema written inline in `fixtureCompare.ts:59-63`. `parseCases` (93–104) repeats `fixtureCompare.ts:67-79`, including the rule that turns a file path into a case name (`replace(/^.*\\//u, \"\").replace(/\\.json$/u, \"\")`), which `?range=<case>`, `?diff=<case>` and app-session's case flags all rely on. As the app grows, a change to the Difference fixture shape or to how cases are named has to be made in every fixture source; this is the second 'copied decision' in this run, after RVColumns' range.ts. Generated.Difference catches field drift in both copies, which is why this is graded `should`.",
      "fix": "Export `DIFFERENCE` from `fixture.ts` next to `LINE_RANGE`/`SIDE_WORD_CHANGES`, plus one `parsedCases(schema, label, files, convert): Map<string, T>` that owns the path → case-name rule. Use both from `fixtureCompare.ts` and `fixtureRange.ts`. The orchestrator has to widen Owned to `fixture.ts` and `fixtureCompare.ts`."
    },
    {
      "severity": "should",
      "file": "frontend/src/ipc/fixtureRange.ts",
      "line": 29,
      "rule_id": "TS17",
      "problem": "`ENTRY_KIND = v.picklist([...])` and `notUtf8.sides: v.picklist([\"left\", \"right\", \"both\"])` (line 74) add a second way to write a closed member list in fixture schemas. `fixture.ts` already uses `memberOf(Readonly<Record<Generated.X, true>>)`, and that form makes the compiler require every member. With picklist, a new `RangeEntryKind` or `RangeSides` member from Rust still type-checks, and only a fixture that uses the new member fails, at page load. The implementer's own open risk names this. As the app grows, every new fixture source would pick between two forms, and only one of them is checked.",
      "fix": "Export `memberOf` from `fixture.ts` and write `ENTRY_KINDS: Readonly<Record<Generated.RangeEntryKind, true>>` and `RANGE_SIDES: Readonly<Record<Generated.RangeSides, true>>` as tables passed to it. This can share a slice with the finding above, since both widen Owned to `fixture.ts`."
    }
  ],
  "checked": [
    "Ownership: every source file in the patch is in Owned (ipc/{domain,rangeDomain,rangeDomain.test,RangeSource,tauriRange,fixtureRange,fixtureRange.test,index}.ts, ipc/AGENTS.md, ui/problemText{,.test}.ts, scripts/map-check.sh). Under `.omp/run/`, the commit also adds findings.jsonl lines, RVShell.survivors.txt and RVColumnsBoundary.md. Those are orchestrator bookkeeping (triage text, another slice's review), not implementer edits; RVIpc.md is the expected report.",
    "Contract matches the brief and RangeDesign §9 word for word: `RangeFileId` brand and `isRangeFileId(value: number)` in domain.ts:174; the camelCase shapes in rangeDomain.ts (`shortId`, renamed `oldPath`, texts `differences: readonly Difference[]` from compareDomain); `toRangeStart`/`toRangeFile` reuse `toDifferences`; `RangeSource extends SettingsSource` with exactly `openRange`/`loadRangeFile`, in the same shape as CompareSource.ts.",
    "`createFixtureRangeSource(log, search, files = CASE_FILES)`: the third parameter is an allowed addition and matches `createFixtureCompareSource`. A bare `?range` or `?range=` loads `review`; an unknown case logs `range.fixture_miss` and lists nothing (fixtureRange.ts:113-124). Settings come from `createFixtureSettings()`, as in compare.",
    "Accepted deviation: index.ts does not re-export `isRangeFileId`/`toRangeStart`/`toRangeFile`. The conversions take DTOs (IPC2), compare's `isTabId`/`toTabList` are not re-exported either, and row 9 gets its ids from `RangeEntry.id`.",
    "Accepted deviation: `tauriRange.openRange` skips `toResult` because the generated `commands.openRange` returns a plain `Promise<RangeStart>` (bindings.ts:41). `loadRangeFile` follows tauriCompare's `result.ok ? … : result` pattern.",
    "Accepted deviation: the unknown-case start shape (`range: <case>`, named HEAD sides, `0000000`). The brief left it open; it is built once, in `missingCase`.",
    "Accepted deviation: causedText drops its `default: never` arm. TS3 accepts the switch-exhaustiveness-check form, and the `string` return type makes a missing kind a TS2366 error; the function stays under 40 lines (TS11).",
    "Not graded here (test strength, the correctness reviewer's lens): the open risk that tauriRange.ts has no test, and the Stryker survivors in fixtureRange.ts (44 %) and tauriRange.ts (NoCoverage). tauriRange.test.ts was not in Owned. The domain.ts:176-177/259 survivors are in `nextColumnVersion`/`toListing`, which this patch did not touch.",
    "Not graded here: knip `unused` failing on index.ts and rangeDomain exports until row 9 imports them, because the brief's contract requires them (TS16 is satisfied by row 9). The missing architecture/ipc-contract/project-map entries that make map-check fail belong to the orchestrator's docs pass.",
    "problemText.ts: `UnknownRangeFile` is in the `FIXED_REASONS` Record literal (TS17) with the brief's exact words, and problemText.test.ts:183 pins the sentence.",
    "map-check.sh loop now covers `ChunkSource CompareSource RangeSource`. Its sed picks up the two-space-indented method lines in RangeSource.ts. The edited comment line is allowed by CP4.",
    "Boundaries: rangeDomain → compareDomain/domain/validate/bindings and fixtureRange → fixture/fixtureSettings/rangeDomain are intra-ipc edges with no cycle. Nothing outside ipc/ imports bindings or a DTO (IPC2), the brand is created only through domain.ts's guard (IPC3), and no `as`, `!` or `any` appears.",
    "Comments: the only new code comment is the Stryker glob note copied from fixtureCompare.ts (an external Vite fact, CP1). The contract's inline method comments were dropped from RangeSource.ts, as comment-policy asks.",
    "The ipc/AGENTS.md paragraph matches the code (`?range` → review, an unknown case gives `range.fixture_miss`, id = index, differences through `toDifferences`).",
    "Growth: fixtureRange.ts holds one job (fixture cases → RangeSource), mirroring fixtureCompare. No new state outside the fixture closure, so no new state-ownership row is needed, and no plan §2 #103/#105 row is contradicted.",
    "I ran no checks of my own; this review comes from reading the patch and the files."
  ]
}
```