## Re-check: Markdown renderer round 2 (`82b5099`) fails, thread rows round 2 (`da05430`) passes

Items 1 and 2 of the Markdown round are fixed. Item 3 is only half fixed. The test now catches a missing `openers_bottom` memo, but it still passes if the code-span cursor is removed. That one block goes to the owner. It costs the user nothing today, because the parser is linear now. What it costs is protection: if someone later breaks the cursor, the window could freeze on long answers and no test would fail. The fix is to change one number in the test.

The thread-rows block is fixed and I found nothing new that blocks.

```json
{
  "round": "3.RV-markdown fix round 2 (82b5099)",
  "verdict": "fail",
  "items": [
    {"item": 1, "status": "fixed", "evidence": "markdownBlocks.ts:32/36/37: FENCE, QUOTE and ITEM have the `s` flag. Once their marker group matches, `(.*)$` always reaches the end of the line, so they are linear. Probe (`tsx`, parseBlocks): `-`+100k spaces+U+2028 1.1 ms, `-`+100k+U+2029+`x` 0.7 ms, `1.`+100k+U+2029 0.5 ms, 100k `~`+U+2028 0.2 ms, `>`+100k+U+2028 0.4 ms, `p\\n*`+100k+U+2028 1.7 ms (through `interrupts`), `> -`+100k+U+2028 0.6 ms, a nested item 1.2 ms, a closing fence of 100k backticks 0.8 ms. The new test (markdownBlocks.test.ts) fails on the old regexes in two ways: old FENCE gives no code block, and old ITEM goes quadratic (~22 s at 100k, by scaling 884 ms at 20k). I checked the regex audit myself and it is correct. RULE and CLOSING_FENCE: every repetition starts with a fixed character, so giving characters back costs O(n). DELIMITER_CELL has one quantifier and is anchored. The pipe regexes have no quantifier. AUTOLINK stops at the next `<`, whitespace or `@`. PUNCTUATION, SPACE and WORD each match one character. markdownTree.ts has no regex."},
    {"item": 2, "status": "fixed", "evidence": "`startsBlock` (list, quote, fence, heading, rule) and `interrupts` = `startsBlock || startsTable`. The table loop (:124) uses `startsBlock`; paragraph, lazy quote and lazy item lines keep `interrupts`. The new test fails on the old code: `startsTable(\"| x | 1 |\", \"| - | - |\")` cut the table before row x. Probes: the re-check's 3-column case is one table with rows [x,1,2],[-,-,-],[y,3,4]. A second `|---|---|` inside a table stays a row. After a table, a quote, a list, a heading and a rule still start their own blocks. 20k dash rows take 23 ms."},
    {"item": 3, "status": "not fixed (memo half fixed, cursor half not)", "evidence": "The memo half is fixed: the implementer's run with the memo removed failed at 1,856 ms against the 500 ms limit, which agrees with the previous re-check's 113 → 2,344 ms. The cursor half is not: with the cursor turned off the test still passes (findings[0])."}
  ],
  "findings": [
    {
      "severity": "block",
      "rule_id": "review-protocol grading (1): test passes with the feature deleted",
      "file": "frontend/src/editor/internal/markdownInline.test.ts",
      "line": 143,
      "problem": "The ``\"`a` \".repeat(20_000)`` case (from the re-check's own wording) is too small to catch a missing `CodeSpans.#next` cursor (markdownInline.ts:53). With the cursor turned off in-process, that input takes 242–246 ms instead of 26–31 ms, and all four inputs of the test take 267–308 ms in total, under `LINEAR_MS` (500), so the test stays green. At 60k spans the cursor-off parse takes 2,030 ms against 80 ms with it. Cost to the user: nothing visible today, because the parser is linear. If the cursor breaks later, every streamed AI answer with many code spans re-parses in quadratic time and freezes the window for seconds per chunk, and no test fails.",
      "fix": "Raise the code-span case to ``\"`a` \".repeat(60_000)`` (40k pairs → 120k expected nodes; 80 ms with the cursor, about 2 s without). Or move it into its own test with its own `LINEAR_MS` window. Either way, turn the cursor off once by hand (`let index = 0`) and report the failure, as was done for the memo."
    }
  ],
  "checked": [
    "Cursor probe (no file edited): `pnpm -C frontend exec tsx -e` replaced the global `Map` with a subclass. Maps built inside `CodeSpans` answer `get` with undefined for number values, so `index` starts at 0 on every call, which is the same as having no cursor. Results: 20k spans, on 26.0/30.6 ms, off 246.0/241.9 ms. The test's four inputs together: on 164/76 ms, off 308/267/270 ms. 60k spans: on 80.2 ms, off 2,030.4 ms. I did not run the test file itself; this probe is the evidence for the block.",
    "Deviation accepted: with the `s` flag, an item, fence or quote line containing U+2028/U+2029 now parses as that block instead of a paragraph. `HEADING` already behaved this way, and CommonMark treats these as ordinary characters.",
    "Deviation accepted: the linear-time test was renamed, and markdownTable.test.ts and markdownTree.test.ts were not created.",
    "Open risk accepted: the 500 ms limit on a wall clock is the existing pattern in both test files. The memo-off run fails by about 3.7×.",
    "An empty item line after a table (`-`+spaces+U+2028) stays a table row. This is not a regression: `listStarts` needs non-blank item content and has not changed.",
    "Not touched by this round: no EditorState or line spaces (CM1–CM9 do not apply), no RK owner, no new import or state."
  ]
}
```

```json
{
  "round": "3.RV-thread-rows fix round 2 (da05430)",
  "verdict": "pass",
  "items": [
    {"item": 1, "status": "fixed", "evidence": "threadField.ts:62-65: `topBelow` now returns `view.lineBlockAt(doc.line(place + 1).from).top`. I traced the new deletion test by hand with 20 px lines and 100 px rows. Right column: line 20 block 380–500 (unchanged row after it); line 21 block 500–620 with its text at 600–620 (removed-line row before it). Left column: line 21 text 500–520; line 22 520–640 with its row. Thread anchors: (400,400),(500,500). Band: left {500,640}, right {500,600}, so the band top is also (500,500). Duplicate anchors are safe: `targets` takes the `after[source] === y` path, so it never divides by zero. With the left scrollTop at 470, the middle is at 570, which gives a right middle of 500 + 70/140·100 = 550, so a scrollTop of 450. That matches the assertion. The old text top would give (500,600) and fail both `toEqual(ROW_AFTER_LINE_20)` and the scrollTop (the implementer's hand revert: 2 failed). The insertion test mirrors this through ADDITION_ROW (leftEmpty) and checks the right column leading. `placedBlock` places the rows as `rowDecorations` does: the unchanged row at line(20).to with a positive side, the empty-side row at line(21).from with a negative side. MiniBrowser: maxExtraFollowerStepPx 0 after the fix and 198 on the old code, in both directions."}
  ],
  "findings": [],
  "checked": [
    "Nothing nearby broke. Where no widget sits before the next line, block top = text top, so the round-1 tests' anchors (10·20+100, 13·20+100) and every non-empty-side case are unchanged. An unchanged row on the line after a pure deletion still uses `bottomAbove` = text bottom, below the empty-side rows. `bottomAbove` still uses `textBlock`, so the import is still needed.",
    "Compare window: `topBelow` is only reached through `threadAnchors`, and only the range window passes that (range.ts:85). The compare window's spans and anchors are untouched.",
    "Anchors are sorted by left, then right (compareFrame.ts:59-61). The new lower anchor equals the band top on both sides, so the right column stays monotone across the unchanged row, the band top and the band bottom. I checked this for both the deletion and the insertion mirror.",
    "Open risk accepted: a future widget placed before a line in a non-empty column would move this anchor. Today only empty-side thread rows sit before a line (`sitsBeforePlace`).",
    "The editor/AGENTS.md wording for `threadAnchors` is already assigned to the brief 3.RV-thread-state (lines 31-32), so it is not a finding.",
    "rangeThreads.browser.test.ts has not run under Playwright WebKit (#423/#1074). The MiniBrowser follower-step samples from RVThreadRowsR2.md are accepted as the browser evidence.",
    "RK4: drift is now continuous at the case the re-check named. The four RK4 rows of the previous re-check are covered by compareFrame.test.ts's two new cases plus the round-1 cases."
  ]
}
```