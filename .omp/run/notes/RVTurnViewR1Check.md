Fix round 1 (`ac5cc22`) fails: one new block. Every other item from both earlier reviews is fixed.

The block: an edit can now show "LF line ending" on a line that has no line ending. I traced this by hand. I tried to run it through `tsx`, but `ipc/fixture.ts`'s `import.meta.glob` only works under Vite, so it was not run.

```json
{
  "verdict": "fail",
  "items": [
    { "id": "B1", "status": "fixed", "evidence": "aiText.ts:5-26 now holds RUNNING_TEXT, LOADING_DIFF_TEXT, NO_NEWLINE_TEXT, LINE_ENDING_WORDS, AI_SETTINGS_TEXT and YOLO_NOTE. The ⋯ is inside skippedLinesText (aiText.ts:98), and unknownPlaceholderText is at aiText.ts:102. agentSettingsFields.ts has only rules left (no YOLO_NOTE, no unknownPlaceholderLines; grep finds no stale use). AiTurn, AiStep, EditDiff and AgentSettings templates have no literal words (grep for text nodes and title/aria-label/placeholder attributes: none). aiText.test.ts asserts every moved word verbatim." },
    { "id": "B2", "status": "fixed", "evidence": "agentDomain.ts:44 `toAiRefs`: `stash` is true exactly when the name is `stash`, and every other name is a branch. This matches checkout.rs:86-96 (`for-each-ref --format=%(refname:short) refs/heads refs/stash`; with both present, git shortens refs/heads/stash to `heads/stash`). question.ts:160-171 only words the `{branches, stash}` shape. The ipc tests now use Rust's short names: agentDomain.test.ts:35-63 and tauriAgent.test.ts:119 `[\"ai\",\"stash\"]`. A branch named `stash` is worded as a branch (question.test.ts table)." },
    { "id": "B3", "status": "fixed", "evidence": "fences.ts:155-160 `windowRoot` counts the AI_FILES (the four views, aiClose and their own tests) as range. rootFinding and aiFileFinding both use it. Failing-path tests in fences.test.ts: aiClose→./store, AiTurn→./compareStore, AgentSettings→../lsp, App.vue→./aiClose. The App.vue→./aiClose allowance is gone. The #108 fence is agentFence.ts, with failing paths for `new AgentClient`, `ipc.createTauriAgentSource(…)` and `createFixtureAgentSource(…)`, and passing paths for main.ts, a test file and a declaration. Real-tree grep: these builders are called only in *.test.ts." },
    { "id": "B4", "status": "fixed", "evidence": "editDiffLines.ts:191-216 `diffRowCells` is one exhaustive switch with a `never` default. Its words come from aiText. EditDiff.vue:110-115 reads only `cells.*`, and editDiffLines.test.ts covers all six kinds. The fifth `note` cell is an accepted deviation. Test gap on the added row with no ending: see the should finding." },
    { "id": "B5", "status": "fixed", "evidence": "AiStep.vue:6 and EditDiff.vue:16 take `client: Pick<AgentClient, \"editDiff\">`. AiTurn keeps the contract's `client: AgentClient`." },
    { "id": "B6", "status": "fixed", "evidence": "question.ts:197 builds the note as `${DISCARD} removes the checkout.`, and question.test.ts still asserts \"Discard Changes removes the checkout.\"" },
    { "id": "C1", "status": "not fixed (new block)", "evidence": "The no-newline row and the \\r stripping are correct. Traced by hand: \"a\\nb\"→\"a\\nb\\nc\" gives `-2 b, \\, +2 b, +3 c`, which is git's order. The CRLF→LF pair is marked `crlf`/`lf`. A CRLF context line is stripped and not marked. But `pairEnding` (editDiffLines.ts:68-73) calls a side's last line \"lf\" when that line has no line break at all. See finding 1." },
    { "id": "C2", "status": "fixed", "evidence": "editDiffLines.test.ts \"past the cap a skipped run counts none of its lines\". Recounted by hand: 200 added lines hidden, plus 3+3 context lines around a skipped run of 884, plus 1 removed and 1 added, plus 3 context lines before the final skipped run, gives 211, which is the asserted `more 211`. Counting each skipped run as one line would give 213, so the earlier `!== \"skipped\"` survivor is now killed." },
    { "id": "C3", "status": "fixed", "evidence": "aiText.test.ts:46: the `refused` message is \" no model configured\\n\" and the expected sentence is trimmed, which kills the `.trim()` survivor." },
    { "id": "AGENTS.md", "status": "fixed", "evidence": "ui/AGENTS.md:7 has all five sentences from RVThreadBoxesR1 item 12. The clipboard sentence now appears twice, which the implementer noted (doc only, not reported under RV8). Line 9 describes B1–B6, C1, C2, the PM9 coverage and agentFence." }
  ],
  "findings": [
    {
      "severity": "block",
      "rule_id": "C1 acceptance; RK5 by analogy",
      "file": "frontend/src/ui/editDiffLines.ts",
      "line": 68,
      "problem": "`pairEnding` labels every changed line \"lf\" unless it ends in \\r, even a side's last line with no line break. So when the AI writes a CRLF file back as LF without a final newline, the last pair shows `−1 a  CRLF line ending`, `+1 a  LF line ending`, then `\\ No newline at end of file`: the window claims an LF the file does not have. The reverse case (old \"a\" without a final newline → new \"a\\r\\n\") puts \"LF line ending\" on the removed row. Traced: sideOf(\"a\") = {lines:[\"a\"], open:true}; pairEnding(\"a\", \"a\\r\") → \"lf\"; then addLastLine adds the noNewline row.",
      "fix": "Pass in whether the line is its side's last line with no line break, and give that row `ending: null`; its noNewline row already says it has none, and the other side keeps its own word. Add `\"a\\r\\n\"`→`\"a\"` (expect `-1 a [crlf]`, `+1 a`, `\\`) and its reverse to the C1 test."
    },
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/src/ui/editDiffLines.test.ts",
      "line": 151,
      "problem": "Several survivors are real gaps in C1 and B4: every CRLF test line is one character, so `withoutCr`'s `slice(0, +1)` survives (:65); no unpaired removed or added row is followed by a line equal to it apart from \\r, so `index <= len` and `true` survive (:130, :142); and diffRowCells is never called on an added row with `ending: null`, the most common row, so a stray note there survives (:202). If this stays, the next change to the line-ending rule is unguarded; nothing else builds on it.",
      "fix": "In the C1 test use CRLF lines longer than one character and add an uneven pair whose next unchanged line differs only by \\r (for example old `\"a\\r\\nc\\r\\nc\\n\"`, new `\"a\\nc\\n\"`, difference [0,2,0,1]: expect `-2 c` with no mark). Add an added row with `ending: null` to the diffRowCells test, or share one `endingNote(ending)` between the removed and added cases."
    }
  ],
  "survivors": [
    { "mutant": "frontend/scripts/fences.ts:159 OptionalChaining `?.[1]?.` → `?.[1].`", "verdict": "drop (a)", "reason": "Equivalent: WINDOW_FILE's group 1 is required, so any match has [1], and no match stops at `exec(...)?.`." },
    { "mutant": "frontend/scripts/fences.ts:159 StringLiteral `?? \"\"` → non-empty", "verdict": "drop (a)", "reason": "Equivalent: with no match, any non-window string fails `isWindowRoot` (rootFinding returns undefined) and is still `!== \"range\"` in aiFileFinding, so neither result changes." },
    { "mutant": "frontend/src/ipc/agentDomain.ts:35 StringLiteral STASH → \"\"", "verdict": "drop (b)", "reason": "`pnpm -C frontend test` kills it: agentDomain.test.ts \"a changed checkout comes out camelCased, its short ref names split into branches and the stash\" (STASH \"\" would keep `stash` as a branch and give stash false), and tauriAgent.test.ts :119. It is a module-level constant the vitest runner does not re-evaluate (justfile:140, #732)." },
    { "mutant": "frontend/src/ui/editDiffLines.ts:58 BooleanLiteral `open: false` → true (empty text)", "verdict": "drop (a)", "reason": "Equivalent: `open` is read only in addLastLine as `line === lines.length - 1` = -1, and no loop index is -1 when there are no lines." },
    { "mutant": "frontend/src/ui/editDiffLines.ts:65 UnaryOperator `slice(0, -CR.length)` → `slice(0, +CR.length)`", "verdict": "finding (should)", "reason": "Every CRLF line in the tests is one character long, so keeping only the first character looks the same as removing \\r. This is a real gap in C1's \\r stripping." },
    { "mutant": "frontend/src/ui/editDiffLines.ts:91/:129/:141 StringLiteral `?? \"\"` (NoCoverage)", "verdict": "drop (a)", "reason": "Unreachable: sideOf counts lines the same way as Rust's split_inclusive('\\n') (\"\", \"\\n\", \"a\\nb\", \"a\\r\\nb\\r\\n\" traced), so Rust's differences and runs index only existing lines." },
    { "mutant": "frontend/src/ui/editDiffLines.ts:130 and :142 EqualityOperator `<` → `<=` and ConditionalExpression → `true`", "verdict": "finding (should)", "reason": "Not equivalent: an unpaired row would be compared with the next unchanged line on the other side and could get a false ending mark. No test has such a neighbour, so this is a real gap in the pairing boundary." },
    { "mutant": "frontend/src/ui/editDiffLines.ts:202 ConditionalExpression → false and StringLiteral \"\" (NoCoverage)", "verdict": "finding (should)", "reason": "The added case is tested only with ending \"lf\". A stray note on every added row without an ending would pass the tests." },
    { "mutant": "frontend/src/ui/editDiffLines.ts:211 exhaustive default (ConditionalExpression/BlockStatement, NoCoverage)", "verdict": "drop (a)/(b)", "reason": "Unreachable `never` arm over DiffRow, proven by `pnpm -C frontend typecheck`." }
  ],
  "checked": [
    "Read in full: the brief, both earlier reviews, the implementer's notes, the survivor list, editDiffLines.ts and its test, aiText.ts, AiTurn/AiStep/EditDiff/AgentSettings.vue, aiClose.ts, question.ts (diff), agentDomain.ts (diff), fences.ts:140-185 and agentFence.ts.",
    "Line spaces: Difference.left/right are 0-based and rows add 1. Old numbers come only from `left`, new numbers from `right` or old + shift. The noNewline row follows the old side for context and removed rows, and the new side for added rows. A last line with no line break that is context is the last line on both sides, because Rust counts the line break as part of the line.",
    "The cap: noNewline and skipped rows past row 2,000 are not counted, and a noNewline row below the cap counts toward the 2,000 rows.",
    "Accepted deviation: agentFence.ts is new, shares rule id PM9, and its failing and passing paths are tested. The project-map PM9 line is the orchestrator's.",
    "Accepted deviation: aiClose.ts is fenced as range-only; no non-range file in the real tree imports it (grep: only aiClose.test.ts).",
    "Accepted deviation: question.ts types the `{branches, stash}` shape inline because ipc/index.ts (not owned) does not export CheckoutChanges. The stash decision itself lives only in agentDomain.ts.",
    "Accepted deviation: the AI settings words moved into AI_SETTINGS_TEXT; AgentSettings maps `unknownPlaceholders` through `unknownPlaceholderText`; `store` was renamed to `save`.",
    "Accepted open risk: a lone branch named `stash` reads as a stash, because Rust's short names cannot tell it apart. The brief defines `stash` exactly that way.",
    "Every consumer of the new refs shape was updated: aiClose.ts and the question, aiClose, agentDomain, tauriAgent and fixtureAgent tests; fixtureAgent.ts still sends the generated `refs: []` DTO.",
    "No growth harm: EditDiff now only loads and lays out; formatting moved to diffRowCells, and no new state or import edge appears. The ui→agent and ui→ipc imports go only through their index files.",
    "Not run: the block rests on a hand trace of pairEnding and addLastLine. Running it outside vitest through tsx failed: `import.meta.glob` in ipc/fixture.ts needs Vite."
  ]
}
```