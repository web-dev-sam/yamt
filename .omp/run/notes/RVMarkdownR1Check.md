**Verdict: fail.** Of the ten items, nine are fully fixed. Item 4's emphasis algorithm is correct, but no test exercises the part that keeps it linear. The fix also changed table behaviour, and the parser still has a hostile-input freeze of the same kind item 3 removed. That makes three blocks.

I ran no workspace gates, only read-only `tsx -e` probes against the two parser modules (Node 24). For the CommonMark comparison I checked 41 spec-style emphasis inputs:
- **36 matched.**
- **2 matched CommonMark after all:** my expected values for `*a **b c*` and `**a *b c**` were wrong; the parser's output is CommonMark's.
- **3 differ for a reason this round didn't touch:** `*(*foo*)*`, `a**"foo"**` and `**foo.**bar` come out differently because the earlier simplified rule for whether a `*`/`_` run can open or close ignores CommonMark's punctuation clause. The previous parser gave the same results, and it was not in this brief.

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "hostile input: quadratic regex (fix-round item 3's class, R-AI7 precedent)",
      "file": "frontend/src/editor/internal/markdownBlocks.ts",
      "line": 37,
      "problem": "Item 3 fixed `HEADING`, but `ITEM` (:37, `( +)(.*)$`) and `FENCE` (:32, `` (`{3,}|~{3,})(.*)$ ``) still backtrack quadratically when a line ends in U+2028 or U+2029, because without the `s` flag `.` stops there and `$` fails. Probed: `-` + 20,000 spaces + U+2028 took 894 ms and 40,000 took 3,573 ms; `1.` + 40,000 spaces + U+2029 took 3,650 ms; 40,000 backticks + U+2028 took 1,338 ms; a paragraph followed by such a 20 KB item line took 912 ms, through `interrupts`. `show()` re-parses on every streamed chunk, so the window freezes for seconds on each chunk. The implementer added `s` to `HEADING` for exactly this reason but left the other two regexes alone.",
      "fix": "Give `ITEM` and `FENCE` the `s` flag, as `HEADING` has (QUOTE is linear, but add it there too for one rule). Add a node test in markdownBlocks.test.ts that parses `-`/`1.` + 100,000 spaces + U+2028 and 100,000 backticks + U+2028 under `LINEAR_MS`."
    },
    {
      "severity": "block",
      "rule_id": "fix broke behaviour (RV8); GFM tables",
      "file": "frontend/src/editor/internal/markdownBlocks.ts",
      "line": 124,
      "problem": "The table row loop now stops at any `interrupts`, and `interrupts` (:155) includes `startsTable(line, next)`. So a data row followed by a row whose cells are all dashes is taken as a new table's header. Probe: `| name | a | b |\\n|---|---|---|\\n| x | 1 | 2 |\\n| - | - | - |\\n| y | 3 | 4 |` now renders as two tables. The first has no rows, the second has header `x | 1 | 2`, and the `- | - | -` row disappears. Before the fix this rendered as one table with three rows, which is also what GFM (cmark-gfm) does: a new table only opens from a paragraph, never inside a table.",
      "fix": "Split `interrupts` into a block-start check (list, quote, fence, heading, rule) and `startsTable`. Let the table loop stop only on the block-start check, and keep the paragraph and lazy-line callers on the full `interrupts`. Add a node test that a `| - | - |` row after a data row stays a row of the same table."
    },
    {
      "severity": "block",
      "rule_id": "test would pass with the feature deleted (review-protocol grading (1))",
      "file": "frontend/src/editor/internal/markdownInline.test.ts",
      "line": 139,
      "problem": "Nothing tests the openers_bottom memo (markdownTree.ts:114) that item 4 names and that keeps emphasis matching linear. In `*a `×20000 every run opens and none can close, so no opener search runs. I disabled the memo in-process by patching `Map.prototype.get` for its keys: `*a `×20000 still took 18.6 ms and the test would pass, while `\"*a \".repeat(20000) + \"a_ \".repeat(20000)` went from 113 ms to 2,344 ms (and with `a~~ ` closers, from 56 ms to 2,001 ms). The new code-span cursor (`CodeSpans.#next`) is also untested.",
      "fix": "In the linear-time test, also parse `\"*a \".repeat(20_000) + \"a_ \".repeat(20_000)`, expecting one text node, and `\"`a` \".repeat(20_000)`, inside the same `LINEAR_MS` window."
    }
  ],
  "checked": [
    "Item 1 is fixed. `highlightedNodes(document, code, parser)` and `CODE_HIGHLIGHTERS` are in syntax.ts:143-165, the only `highlightCode(` call left in frontend/src (grep). `paintCode` (codeBlock.ts) and `removalTooltip.ts` `codeBlock` both call it, and `mountStyles` reads the same pair. The tooltip's behaviour is unchanged (same classes, text nodes, `\\n` breaks); the implementer's fixture-mode check shows the classes ͼ1i/ͼ11 coloured.",
    "Item 2 is fixed. `parsedAt` offers quote/list only while `depth < MAX_NESTING` (16); `Tree.open` turns any opener past 16 into literal text and its close into literal text. Probes: quote 10k 1.1 ms, quote 100k 1.4 ms, list 10k 2.5 ms, list 50k 11.1 ms, ordered 10k 0.5 ms, mixed `> - `×10k 0.7 ms, emphasis 10k-deep 25 ms, none throwing. Both depth tests check exactly `MAX_NESTING`, so deleting the bound or an off-by-one fails them.",
    "Item 3 is fixed for headings. HEADING is the brief's regex plus `s`, and `headingText` uses string operations; `# a#`→`a#`, `## b ##  `→`b`, `### ###`→`` (test). Probes: 100k inner spaces 0.4 ms, 200k 0.8 ms, 200k spaces then `#` 0.7 ms, 200k `#`s 1.6 ms, a paragraph plus 20k heading-like lines 29 ms. The old regexes took over 1 s at 50k, so the 500 ms test would catch them.",
    "Item 4 timings. `*a `×20000 47 ms (100000: 121 ms); `[](`×20000 19 ms (100000: 58 ms); `[`×20000 4 ms; `]`×20000 3.9 ms; `[a]`×20000 16.6 ms; `![`×20000 11.8 ms; `![a](`×20000 26.7 ms; `[a](`×20000 then `)`×20000 3.2 ms; `<`/`<a`/`<a@a`/`<ab:`×20000 9-14 ms; backtick runs of lengths 1..400 2.5 ms; `` `a` ``×20000 31.7 ms; `_a`/`**a`/`a*`/`*_a`/`~~a`×20000 13-31 ms; `*a** `×20000 58 ms; link-in-link 10k 14.5 ms; `*[a](b)`×10000 30 ms.",
    "Item 4 compared with CommonMark process_emphasis by hand.\n- Pairing: `pairs` matches the spec's rule of 3 on the original run lengths, and a strong pair is chosen on min(left, left) ≥ 2.\n- Memo: the key (char, closer can-open, closer length mod 3) covers everything `pairs` reads from the closer. Failures are permanent because `pairs` never reads `left`, and clamping bottoms on `#truncate` keeps the stored positions valid.\n- Removal: the delimiters between an opener and its closer are removed, an exhausted opener is dropped, and a closer that can open keeps its leftover on the stack.\n- Links: each link level gets its own bottoms and a barrier (process_emphasis with stack_bottom), and the stack is cut back at the link's end.\n- Brackets: openers before a link are deactivated (`#inactiveBelow`); images never are. The image's pieces are removed before matching.\n- Tree: closes come first, then the leftover text, then opens in reverse, which matches cmark's placement of leftovers. Nesting is proper by construction, so the implementer's open risk on `Tree.close` is accepted.",
    "Item 4, the 41-case comparison. 36 matched. `*a **b c*` and `**a *b c**` match CommonMark (my expected values were wrong). `*(*foo*)*`, `a**\"foo\"**` and `**foo.**bar` differ only because `delimiterRun`'s can-open/can-close rule leaves out the punctuation clause, which round 1's `canOpen`/`canClose` also did. Old and new give the same output on these, so this is not a regression of this round.",
    "Item 5's intent holds: a quote after a table starts a quote (test plus probe `[table rows:[], quote 'q | x']`); list and heading lines after a table start their blocks (probe); `end` becomes a row under GFM example 202. The regression from `startsTable` is block 2.",
    "Item 6 is fixed. `loadedSupport(description, fields)` logs `language.load_failed` with `{...fields, language, reason}`. The panes' entries still carry `{ path, language, reason }` as before, `paintCode` passes `{ place: \"markdown\" }`, and no `markdown.language_failed` is left (grep).",
    "Item 7 is fixed. `scripts/markdownFence.ts` exports `markdownViolations`, which fences.ts:245 calls next to `clipboardViolations`. The moved code is unchanged.",
    "Item 8 is fixed. `CodePainter(element, block: CodeBlock)`, `codeNode(document, block, paint)`, `paintCode(element, block, live)`, and `textElement`/`withInlines(document, { tag, className, text })`. The doubled `ordered` check is gone.",
    "Item 9 is fixed. star.ts/direct2.ts are in the violation test and ns.ts/re.ts in the no-violation test (fences.test.ts:428-456).",
    "Item 10 is fixed. useMarkdown.test.ts's expected call sequences fail if any of these is deleted: the null-host guard (`build 1` would appear), the text watch (`show 1 ab` missing), the destroy on a host swap (`destroy 1` missing) or `onScopeDispose` (`destroy 1` missing).",
    "Survivors triaged.\n- fences.ts: every listed line lies outside this round's hunks (the only addition is the import at :8; the rest are deletions). Dropped.\n- markdownFence.ts:24 (×1): the `true` condition is killed by the range test's `import \"../editor\"` that must give []. What remains is `[]`→a non-MarkdownView list, which is equivalent (a).\n- :34 (×2): equivalent (a); other statements have no moduleSpecifier, so the target is \"\".\n- :38 (×4): `isStringLiteral`→true and `\"\"`→string are equivalent (a). The `literal !== undefined` mutants would throw on a ui `export { x };` without `from`; that failure is loud, not silent, so it is below the fix round's block bar.\n- :39 (×1): a query on an editor import is not a real form; below the block bar.\n- :40 (×2): equivalent (a); a non-relative specifier never joins to src/editor.\n- :61 (×1): equivalent (a); `violationsOf` strips the reason.",
    "Deviations accepted:\n- markdownTable.ts and markdownTree.ts were granted (233/214/272 lines, all under 300).\n- The paren match table replaces the remembered failure position; stack matching gives the same close as the old depth scan.\n- Links inside links staying literal and the rule of three are CommonMark.\n- The `s` flag on HEADING is fine.\n- No markdownFence.test.ts: it is covered through `findFenceViolations`, like clipboardFence.",
    "The implementer's open risk about the paren/backtick tables being global (a backtick inside an autolink) is pre-existing and accepted.",
    "Docs and map are not updated: the project map and editor/AGENTS.md do not yet name markdownTable.ts, markdownTree.ts, markdownFence.ts, `highlightedNodes`/`CODE_HIGHLIGHTERS` or `loadedSupport`. `just map-check` (PM6) needs them in the orchestrator's docs pass.",
    "Streaming soundness is unchanged: a kept block's parse depends only on its own source, and the new table end decision only changes the block's extent, which is part of its source.",
    "No line spaces or EditorState are touched (CM1-CM9 do not apply), and no risk-register owner is touched (RK1-RK27).",
    "Commands run: only read-only `pnpm -C frontend exec tsx -e` probes importing markdownBlocks.ts and markdownInline.ts, plus one `node -e` measuring how many spread arguments V8 accepts. The memo was disabled in-process only by patching `Map.prototype.get`; no file was edited and no test file or toolchain was run."
  ]
}
```