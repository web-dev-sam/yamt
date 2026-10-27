All ten items are fixed. The node tests, the WebKit (MiniBrowser) checks and the removal-tooltip check pass. `pnpm -C frontend unused` exits 1 on `RangeSideLabel` in `src/ipc/index.ts` and `src/ipc/rangeDomain.ts`, files this round does not touch.

## summary
- One highlighter for code outside a pane: `highlightedNodes(document, code, parser)` and `CODE_HIGHLIGHTERS` live in `syntax.ts`, beside the colour table. `paintCode` and `removalTooltip.ts` both call it. One `loadedSupport(description, fields)` in `language.ts` logs `language.load_failed`; `loadLanguage` and `paintCode` both use it.
- The parsers are linear and their nesting is bounded.
  - One `MAX_NESTING` (16) is passed through `blocksOf`/`quote`/`list` and limits the inline tree; past it, the text stays literal.
  - Heading match: the brief's regex plus string operations; `HEADING_CLOSE` is gone.
  - Inline parsing is now a single left-to-right scan:
    - Links and images use a bracket stack, with no links inside links.
    - Parentheses and backticks are matched by tables built once per text.
    - CommonMark's process_emphasis with `openers_bottom` per link level, then the tree is built in one pass.
- Table rows now stop at a blank line or at the start of another block (`!isBlank(line) && !interrupts(lines, end)`).
- Item 8: `paint(element, block)`, `codeNode(document, block, paint)`, `paintCode(element, block, live)`, and `textElement`/`withInlines` take `{ tag, className, text }`. The doubled `ordered` check in `listNode` is gone.
- The MarkdownView fence moved to `scripts/markdownFence.ts` (`markdownViolations`, called from `fences.ts`, now 246 lines). `ui/useMarkdown.ts` now has tests.

## files_changed
- frontend/src/editor/markdown.ts
- frontend/src/editor/internal/codeBlock.ts
- frontend/src/editor/internal/language.ts
- frontend/src/editor/internal/syntax.ts
- frontend/src/editor/internal/removalTooltip.ts
- frontend/src/editor/internal/markdownBlocks.ts (272 lines)
- frontend/src/editor/internal/markdownBlocks.test.ts
- frontend/src/editor/internal/markdownInline.ts (233 lines: the scan and `parseInline`)
- frontend/src/editor/internal/markdownInline.test.ts
- frontend/src/editor/internal/markdownDom.ts
- frontend/src/editor/internal/markdownTable.ts (new; you granted it)
- frontend/src/editor/internal/markdownTree.ts (new; you granted it)
- frontend/scripts/fences.ts
- frontend/scripts/fences.test.ts
- frontend/scripts/markdownFence.ts (new)
- frontend/src/ui/useMarkdown.test.ts (new)

## tests_added
- **markdownBlocks.test.ts**
  - "a quote with a pipe right after a table starts a quote": `| a |\n|---|\n> q | x` gives a table with no rows, then a quote.
  - "a heading drops its closing run only after a space, in linear time": `# a#` gives "a#", `## b ##  ` gives "b", `### ###` gives "". A heading with 100,000 inner spaces parses to its text in under 500 ms.
  - "a 10,000-deep quote and list stop nesting at MAX_NESTING, the rest a paragraph": nesting stops at depth 16, and the innermost block is a paragraph holding the remaining `>`/`- ` text.
  - "a table needs its delimiter row" is changed: under GFM example 202, `end` is now a row (`["end",""]`), and a blank line ends the table.
- **markdownInline.test.ts**
  - "emphasis never crosses a link's text, and a link inside a link stays text".
  - "a strong closer shared by two openers and the rule of three": `***a***` gives em(strong); `*a**b*` gives em("a**b").
  - "a 10,000-deep emphasis stops at MAX_NESTING, the rest literal": depth is exactly 16, and the flattened text is the source minus the 16 outer pairs.
  - "unmatched openers, brackets and parentheses parse in linear time": `*a `×20000 and `[](`×20000 each come back as one text, under 500 ms in total.
- **fences.test.ts**
  - Violation test: `src/ui/star.ts` (`export * from "../editor"`) and `src/ui/direct2.ts` (`../editor/markdown.ts`) each violate PM2.
  - No-violation test: `src/ui/ns.ts` (`import * as sides from "./sides"`) and `src/ui/re.ts` (`export { MergeController } from "../editor"`) violate nothing.
- **useMarkdown.test.ts** runs `useMarkdown` in an `effectScope`, with `vi.mock("../editor")` returning a fake view that records each call.
  - A null host builds nothing, even when the text changes.
  - A set host gives build, show(text), show on a text change, then destroy on `scope.stop()`.
  - A host swap destroys the old view and builds and shows a new one; a null host only destroys, and a later text change shows nothing.

## smoke_evidence
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, exit 0.
- `pnpm -C frontend lint` → oxlint `--type-aware` and eslint, exit 0, nothing reported.
- `pnpm -C frontend test` → `Test Files 162 passed (162)`, `Tests 2092 passed (2092)`.
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- `pnpm -C frontend unused` → exit 1: `Unused exported types (2) RangeSideLabel type src/ipc/index.ts:92:3 / src/ipc/rangeDomain.ts:6:13`. This round does not touch those files.
- Timings, `pnpm exec tsx -e` importing the two parsers (Node 24):
  - heading with 100k spaces: **0.5 ms** (200k: 0.3 ms; the review measured 55 s at 200k)
  - `*a `×20000: **33.6 ms**
  - `[](`×20000: **25.9 ms**
  - `[`×20000: 1.5 ms
  - quote 10000 deep: 0.6 ms
  - list 10000 deep: 2.5 ms
  - emphasis 10000 deep: 34.5 ms
- WebKit: Playwright WebKit cannot launch here. I used `just app-session start-fixture --name rvmd1` (MiniBrowser through `just webdriver`) and the round-1 throwaway `/tmp/md-probe/probe.mjs`, with one depth check added:
  - **hostile:** `{"elements":33,"badTags":[],"badAttributes":[],"ran":null,"scriptText":true,"linkText":true,"imageText":true,"address":"javascript:window.ran=true","pass":true}`
  - **highlight:** `constClass "ͼx"`, `constColour "rgb(224, 152, 107)"` equals `definitionKeywordColour`; `numberColour "rgb(82, 188, 207)"` equals `syntaxNumberColour`; `stylesMounted 1`, `pass true`.
  - **streaming:** `{"keptTitle":true,"replacedParagraph":true,"paragraph":"First paragraph, done.","em":"paragraph","count":3,"pass":true}`
  - **deep** (10k quote, 10k list, 10k-deep emphasis, `[](`×20000 and a heading with 100k spaces in one `show()`): `{"ms":60,"blocks":5,"quoteChainDepth":17,"ems":16,"heading":100002,"pass":true}`
- Removal tooltip, merge window in fixture mode, same session: `hover '.chunk-removal' --nth 2`, then a read gave:
  - `{"kind":"removal-tooltip removal-tooltip-code cm-tooltip-section","text":"\t\t: \`globalThis.JSX.IntrinsicAttributes\`;","spans":3}`
  - spans: `[":","ͼ1i","rgb(196, 194, 206)"]`, ``["`globalThis.JSX.IntrinsicAttributes`","ͼ11","rgb(120, 191, 123)"]``, `[";","ͼ1i","rgb(196, 194, 206)"]` — the code is still coloured.
  - Session stopped: `{"stopped":"rvmd1","session":"ended",…webdriver stopped, vite stopped, folder removed}`.

## deviations_from_brief
- **Two new files, both granted by you:**
  - `markdownTable.ts`: `Align`, `Table`, `startsTable(header, delimiter)`, `tableOf(lines)`. `markdownBlocks.ts` would otherwise have been 311 lines.
  - `markdownTree.ts`: the `Inline` type, the scan's pieces, process_emphasis and the bounded-depth tree build. The inline parser would otherwise have been 438 lines.
  - `MAX_NESTING` lives in `markdownTree.ts`. `markdownDom.ts` now imports `Inline` from `markdownTree` and `Align` from `markdownTable`; there is no re-export.
- **Item 4, a different way to stay linear for `]`/`)`:** instead of remembering one failure position, the parentheses are matched once per text with a stack pass. For each `(` this gives the same answer as the old depth scan. Code spans use a table of backtick runs per length, with a cursor that only moves forward (the old search was also quadratic).
- **Two behaviour changes that move the parser closer to CommonMark:**
  - A link can no longer hold another link; the outer one becomes literal brackets.
  - The rule of three now applies, so `*a**b*` gives em("a**b").
- **Heading regex:** I added the `s` flag so `.` also matches U+2028 and U+2029, which keeps the match linear on such a line.
- **Paint failure field:** `paintCode` logs the failure as `language.load_failed` with `{ place: "markdown" }` (the panes' entries use `{ path }`).
- **No `markdownFence.test.ts`:** the fence's tests stay in `fences.test.ts`, which exercises it through `findFenceViolations`, the same way `clipboardFence.ts` is tested.
- **Docs outside Owned need updating:**
  - `editor/AGENTS.md`'s Markdown paragraph and the project map's `editor/internal` list: `markdownTable`, `markdownTree`, `highlightedNodes`/`CODE_HIGHLIGHTERS` in `syntax`, `loadedSupport` in `language`.
  - The project map's `frontend/scripts` row: `markdownFence.ts` (PM2's MarkdownView rule, called by `fences.ts`).

## open_risks
- `frontend/src/editor/internal/markdownTree.ts:105` (`Tree.close`): the build trusts that openers and closers nest properly. That holds because the barriers truncate the stack at link ends and matches truncate it too. A wrong pairing would put content in the wrong frame, but nothing would throw.
- `frontend/src/editor/internal/markdownInline.ts` (the global paren and backtick tables): they are built over the whole inline text. A backtick inside an autolink can still be read as a code-span opener; the old `bracketEnd` did the same.
- The new `markdownTree.ts`/`markdownInline.ts` lines have not been through `just mutants` yet.