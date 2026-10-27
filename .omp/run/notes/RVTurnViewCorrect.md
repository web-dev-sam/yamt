```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "RK5 (line endings, by analogy); acceptance: editDiffLines no final newline, CRLF",
      "file": "frontend/src/ui/editDiffLines.ts",
      "line": 30,
      "problem": "`merge_core::compare` counts a line's line break as part of the line (`triples.rs:104` `missing_final_newline_alone_is_a_one_line_change`; `word_changes.rs:45`: `a\\r\\n` vs `a\\n` is a change with no word marks). `linesOf` removes the `\\n` and leaves the `\\r`, and `addChange` (lines 78-86) prints each side's text as it is. So when the AI appends to a file without a final newline, the last line shows as `-23 last` / `+23 last` with identical text. A CRLF→LF rewrite shows every line removed and added again with no visible difference. Git would add `\\ No newline at end of file` here; this view shows a change the user cannot see. No test has a final-newline-only change or any CRLF text: the only test without a final newline (`editDiffLines.test.ts:117`) leaves both sides without one.",
      "fix": "In `editDiffLines`, add a `noNewline` row after the last removed or added row of a side whose text has no final newline (git's words, kept in `aiText.ts`). Mark a removed/added pair whose texts differ only by a trailing `\\r` (for example a `lineEnding` flag on the row, worded in `aiText`), and strip the `\\r` from the row text. Add one test for each case: `\"a\\nb\"`→`\"a\\nb\\nc\"` and `\"a\\r\\nb\\r\\n\"`→`\"a\\nb\\n\"`."
    },
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/src/ui/editDiffLines.ts",
      "line": 36,
      "problem": "After the cap, the \"n more lines not shown\" count leaves out a `skipped` row and counts every context, removed and added row. No test reaches a skipped row past row 2,000: the cap test has one difference covering the whole file. Both survivors (`!== \"skipped\"` → `true` / `\"\"`) count each skipped run as one line, and the tests miss it. If this stays, the next change to the count is unguarded; nothing else builds on it.",
      "fix": "Add a test with two hunks more than 6 lines apart where the cap falls inside the first hunk. Assert the `more` row's exact count, so a skipped run past the cap is pinned as not counted."
    },
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/src/ui/aiText.ts",
      "line": 43,
      "problem": "The `refused` sentence trims omp's message, but the test message `\"no model configured\"` (`aiText.test.ts:37`) has no surrounding whitespace, so the `.trim()` survivor lives. An error message ending in a newline would put a line break into the one-line failure. If this stays, nothing beyond this sentence is affected.",
      "fix": "Give the `refused` entry in `SENTENCES` a message with a trailing `\\n`, as `checkoutFailed` and `spawnFailed` already have."
    }
  ],
  "survivors": [
    { "mutant": "frontend/scripts/fences.ts:175 StringLiteral reason → \"\"", "verdict": "drop (c)", "reason": "This is the fence's printed reason. It decides nothing: `violationsOf` compares rule, file and specifier for every PM rule, and PM9 firing is asserted by the new failing-path test. Not observed in a smoke." },
    { "mutant": "frontend/scripts/fences.ts:171 OptionalChaining `?.[1]?.` → `?.[1].`", "verdict": "drop (a)", "reason": "Equivalent. Group 1 of `WINDOW_FILE` (`(compare|range)`) is required, so a match always has `[1]`, and no match short-circuits at `exec(...)?.`." },
    { "mutant": "frontend/src/ui/aiClose.ts:29 ConditionalExpression/BlockStatement (exhaustive default)", "verdict": "drop (a)/(b)", "reason": "Unreachable: `changes` is `never` there, which `pnpm -C frontend typecheck` proves." },
    { "mutant": "frontend/src/ui/aiClose.ts:58 ConditionalExpression/BlockStatement (exhaustive default)", "verdict": "drop (a)/(b)", "reason": "Unreachable: `Reply` is exhausted, which typecheck proves." },
    { "mutant": "frontend/src/ui/aiClose.ts:15 ObjectLiteral `{...look.cause}` → `{}` and StringLiteral event → \"\"", "verdict": "drop (c)", "reason": "Fields and name of a log call. The decision (a failed look closes) is asserted by `aiClose.test.ts` \"a look that fails closes without asking\". The smoke did not drive a failed look, so the line was not observed." },
    { "mutant": "frontend/src/ui/aiText.ts:52 ConditionalExpression/BlockStatement (exhaustive default)", "verdict": "drop (a)/(b)", "reason": "Unreachable `never` arm. The `Record<AgentFailure[\"kind\"], …>` in the test also fails to compile when a kind is added." },
    { "mutant": "frontend/src/ui/aiText.ts:43 MethodExpression `.trim()` removed", "verdict": "finding", "reason": "Third finding (should)." },
    { "mutant": "frontend/src/ui/editDiffLines.ts:43 StringLiteral `?? \"\"` (NoCoverage)", "verdict": "drop (a)", "reason": "Unreachable. Rust's `split_inclusive('\\n')` and `linesOf` give the same line count for every text (checked by hand for \"\", \"\\n\", \"a\\n\\n\" and \"a\\nb\"), so `old[line]` is always in range for Rust's differences." },
    { "mutant": "frontend/src/ui/editDiffLines.ts:82 / :85 StringLiteral `?? \"\"` (NoCoverage)", "verdict": "drop (a)", "reason": "Same reason as :43: the indexes come from differences over the same texts." },
    { "mutant": "frontend/src/ui/editDiffLines.ts:58 ConditionalExpression/BlockStatement (exhaustive default)", "verdict": "drop (a)/(b)", "reason": "Unreachable `never` arm over `RunPlace`, proven by typecheck." },
    { "mutant": "frontend/src/ui/editDiffLines.ts:36 ConditionalExpression → `true`, StringLiteral → `\"\"`", "verdict": "finding", "reason": "Second finding (should)." },
    { "mutant": "frontend/src/ui/editDiffLines.ts:55 EqualityOperator `<=` → `<`", "verdict": "drop (a)", "reason": "Equivalent. At length 6 the other branch gives {start 3, end 3}, which skips 0 lines and adds no skipped row, so the rows are the same as {6, 0}. Lengths 0-5 still take the first branch. The \"first and last line\" test kills the `false` variant with a run of length 1." },
    { "mutant": "frontend/src/ui/problem.ts:84 StringLiteral/LogicalOperator/ObjectLiteral, :83 BlockStatement, :103 StringLiteral (stoppedFields / store.stopped)", "verdict": "drop (c)", "reason": "Fields of the `store.stopped` log call. The extraction left the behaviour unchanged and the call decides nothing. Not observed in the smoke." },
    { "mutant": "frontend/src/ui/question.ts:157-160 StringLiteral KEEP_TITLE / KEEP / DISCARD / STASH → \"\"", "verdict": "drop (b)", "reason": "`pnpm -C frontend test` kills each one. `question.test.ts:260,264,265,308,312,313` assert the title and both buttons verbatim. `:274` (`[\"stash\"]` → \"It also left a stash there.\") fails when STASH is \"\", because the ref would then be worded as a branch. These are module-level constants the vitest runner does not re-evaluate (justfile:140, #732)." }
  ],
  "checked": [
    "aiMayClose (aiClose.ts read in full; aiClose.test.ts): Missing/Clean → true with no question and no discard (test.each); Changed → `keepAiChanges` with folder, files, headMoved and refs, Keep → true, no discard; Discard → one `discardCheckout`, true, no problem; a failed discard and a throwing one → false with `{action:\"ai\", step:\"discard\", cause}` (the throw becomes `Unexpected` via `attempt`); Escape (`dismissed`) → false, no discard; Unreadable → its own question; a failed look → true with no question. Each test fails if its branch is changed (e.g. `discarded.ok` → `true` fails the failed-discard test). A second close while the question is open gets `dismissed` from asking.ts and stays open, which is safe.",
    "The failed-look decision is safe per plan #111 and design §5: the shell looks again at exit and removes only a Clean checkout, so a checkout changed after a failed look is kept.",
    "editDiffLines tests compare whole rows (`shape`), so they catch real bugs: a run of 3 context lines on each side (`… 6` / `… 7` skip counts), the new-number shift after an insert (`6:7`), the boundary joining runs of 6 or fewer and splitting at 7 (skip rows `… 2, … 1, … 13`), changes at the first and last line with no skipped rows, the cap at exactly 2,000 (catches a cap one row early) and at 2,001 rows (`+500 new 500`, `more 1000`), and created files. The shift arithmetic (`right.end - left.end`) traced by hand for an insert, a delete ([5,2]→[5,0] gives shift −2) and a replace; all correct. Lines are 0-based from Rust and +1 in rows.",
    "Line spaces: `Difference.left`/`right` are `LeftLine`/`RightLine` 0-based (merge-core compare.rs); old numbers come only from `left`, new numbers only from `right` or old+shift; the two never mix.",
    "Every failure sentence (aiText.ts:30-57) checked against the design §3 table. checkoutFailed, notFound (with and without searched folders), spawnFailed, noCommand, crashed (with code and last line; with no code; with a blank last line), refused, sessionGone, ended and busy are each asserted verbatim. `app` is worded through `problemText`'s `ai`/`ask` reasons, not a second table. The test's `Record<AgentFailure[\"kind\"], …>` makes the table exhaustive at compile time.",
    "Settings rules (agentSettingsFields.ts): the default is shown while `command` or `firstMessage` is null; Use splits the words, stores null for the default's words or text, and is off for the words in use or no words (`commandField(OWN, \"omp\")` kills a `sameWords` without its length check); Default stores null and is off while null; first-message text is stored exactly as typed. Unknown placeholders are named once each in typed order, known ones are not, and the five placeholders come from `PLACEHOLDERS`. No survivors in this file.",
    "AgentSettings.vue: drafts are restored when the stored `shown` changes and on Escape; Use and Default reach only `setAgent`; hints come from the draft while typing.",
    "Turn view states (AiTurn.vue): while running (`end === null`), \"Thinking and steps\" shows with \"working…\" and can be opened while live; it is closed at first; stopped shows \"You stopped the AI.\" with no Retry; failed shows one sentence plus Retry, which emits `retry`. `TurnRun.end` sends `changed(endTurn(turn))` before settling, so the live `turn` prop and `end.turn` agree and unfinished steps read \"No result\".",
    "EditDiff.vue: a stale `editDiff` reply is ignored (`props.edit === edit`); a new edit object resets the view and reloads if it is open; `turn.ts` keeps an output's identity unless an update replaces it, so status-only updates trigger no new call; a created file makes no call. The design's \"too large\" and failure notes are present.",
    "question.ts: both kinds are worded per #111/#122, with Keep Changes as confirm (autofocused, so Enter answers it) and Discard Changes as cancel; `endsWithStop` is false for both; tests cover notes for a moved HEAD, branches, a stash and their combinations, and the no-files message.",
    "problem.ts / problemText.ts: the `ai` arm logs its step and cause (problem.test.ts) and words all three steps plus a `RemoveFailed` discard naming the folder (problemText.test.ts).",
    "Acceptance smoke evidence exists: /tmp/aiturn/{dark-ended,dark-opened,dark-bottom,dark-retried,light-collapsed,light-opened,light-bottom,settings-dark}.png. In dark-opened.png the steps are open with an edit diff (`⋯ 20 unchanged lines`, `24 + hello` on the inserted colour). dark-bottom.png shows a coloured ts block, a link as muted text, the stopped line, and the crash sentence with Retry.",
    "Implementer's open risks accepted (the boundary review already covered them): grey removed lines are the panes' own `bg-chunk-deleted` token; `said` entries are plain text; `empty:hidden` was not re-checked in the browser (cosmetic: at worst an empty gap).",
    "Not run: no targeted test was needed. The block rests on merge-core's own tests `triples.rs:104` and `word_changes.rs:45` together with `linesOf`'s code, both read."
  ]
}
```