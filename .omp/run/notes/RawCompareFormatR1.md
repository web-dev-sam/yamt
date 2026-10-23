# RawCompareFormatR1 (3.C-format rework 1, board Raw compare row 3)

All five blocks are fixed inside the Owned files. Each new test failed under its one-line hand mutation, and every mutation was reverted afterwards. `typecheck`, `test`, `lint`, `unused` and `fmt:check` all pass.

**summary**
- **#1472:** `Layout` keeps a running output length (piece lengths, plus `1 + 2·depth` per line) and never builds the indent to measure it. Once the length passes `MAX_FORMATTED_CHARS` (64,000,000 characters), `formatWith` answers `failed` with "The formatted text is too long", so a deeply nested input no longer throws.
- **#1473:** `NUMBER` and `ESCAPE` are now `#number` and `#escape` fields of `JsonScan`, and `NAME` is `#name` in `XmlScan`.
- **#1477:** a CDATA section always counts as text of the element holding it, so an element with child elements and a CDATA section is mixed content and stays verbatim.
- **#1478:** inside a DOCTYPE's internal subset, `#doctypeEnd` now skips a processing instruction the same way it skips a comment.
- **#1479:** `formatWith` keeps a leading U+FEFF as the first character of the output and hands the scanners the text after it.

**files_changed**
- `frontend/src/editor/internal/formatResult.ts`
- `frontend/src/editor/internal/formatJson.ts`
- `frontend/src/editor/internal/formatXml.ts`
- `frontend/src/editor/internal/formatJson.test.ts`
- `frontend/src/editor/internal/formatXml.test.ts`

**tests_added**
- `formatJson: valid input nested past the output cap fails instead of throwing (catches the indent not counted in the output length)`: proves #1472. Depths 6,000 and 32,768 both answer `failed` on line 1.
- `formatJson: no sticky regex lives at module level, …` and `formatXml: no sticky regex lives at module level, …`: prove #1473. Each reads its own module's source through `import.meta.glob(…, { query: "?raw" })` and checks that no top-level `const X = /…/y;` exists.
- `formatXml: a CDATA section beside a child element is character data, …`: proves #1477. `<a><b/><![CDATA[x]]></a>` comes back `unchanged`.
- In the existing DOCTYPE test, `<note>…</note>` is now expected verbatim on one line (#1477).
- `formatXml: a processing instruction inside the DOCTYPE's internal subset is skipped like a comment (…)`: proves #1478. Both documents from the brief format to `<!DOCTYPE …]>\n<a/>`.
- `formatJson: a leading byte order mark is kept and the scan starts after it (…)` and the same test for `formatXml`: prove #1479. Each checks one input that gets formatted and one that comes back `unchanged`, both with the BOM.

**smoke_evidence**
- **Mutation 1:** in `formatResult.ts`, `this.#length += 1 + INDENT.length * depth;` changed to `this.#length += 1;`. Run: `vitest run --project node formatJson.test.ts -t "output cap"`.
  - `AssertionError: expected 72000000 to deeply equal { kind: 'failed', …(2) }`.
- **Mutation 2:** `const ESCAPE = /…/y;` (first run: `const NUMBER`) put back at the top of `formatJson.ts`, and `const NAME = /…/y;` at the top of `formatXml.ts`. Run: `-t "sticky regex"`.
  - Both tests: `AssertionError: expected 'import { FormatFailure, type FormatRe…' not to match /^const \w+ = \/.*\/\w*y\w*;$/m`.
  - That is 2 failed, 29 skipped.
- **Mutation 3:** `if (delimited.opener === CDATA)` changed back to `… && this.#open.length === 0`.
  - The DOCTYPE test fails: `expected { kind: 'formatted', …(1) } to deeply equal { kind: 'formatted', …(1) }`.
  - The new CDATA test fails: `expected { kind: 'formatted', …(1) } to deeply equal { kind: 'unchanged' }`.
- **Mutation 4:** the processing-instruction branch's condition prefixed with `false &&`.
  - `AssertionError: expected { kind: 'failed', …(2) } to deeply equal { kind: 'formatted', …(1) }` at `formatXml.test.ts:52`.
- **Mutation 5:** `lay(body, layout)` changed to `lay(input, layout)`.
  - Both BOM tests: `expected { kind: 'failed', …(2) } to deeply equal { kind: 'formatted', …(1) }`.
- **Recipes:**
  - `pnpm -C frontend typecheck`: `vue-tsc -b`, exit 0.
  - `pnpm -C frontend lint`: exit 0, no findings.
  - `pnpm -C frontend fmt:check`: "All matched files use the correct format.", exit 0.
  - `pnpm -C frontend unused`: `knip --include exports,types`, exit 0.
  - `pnpm -C frontend test`: `Test Files 129 passed (129)`, `Tests 1796 passed (1796)`, exit 0.

**deviations_from_brief**
- **Where the too-long failure is raised.** The brief says to throw once the length passes the cap. Throwing at that moment made the existing test `100,000 nested arrays are scanned without throwing` fail, because it hit the cap long before the closing brackets and so no longer showed that deep input is scanned to its end.
  - Instead, `lineAt` records the position where the length first passes the cap and the scan carries on. `Layout.build()` (renamed from `toString`, because it can now fail) raises the `FormatFailure` at that position.
  - The scan stays linear: the pieces array holds one number per line.
  - A syntax error later in the text is reported before "too long".
- **Changed internal signatures.** `formatWith`'s callback is now `(text, layout)`, so the scanners get the text after the BOM, and `Layout.lineAt` takes `(depth, at)`. Neither is in the Contract; the only callers are `formatJson.ts` and `formatXml.ts`.
- **The #1473 test reads source text.** Moving a regex to module level changes no output, so no behaviour test can catch it. The tests read the module's own source through `import.meta.glob` with `?raw` instead. A plain `import x from "./formatXml.ts?raw"` was rejected by oxlint's `import(default)` rule.
- **What happens with a BOM followed only by whitespace.** That input answers `unchanged`; the brief doesn't say.
- **Cap value.** `MAX_FORMATTED_CHARS = 64_000_000`. The brief named no value, and `64 * 1024 * 1024` was rejected by `no-magic-numbers`.

**open_risks**
- `formatResult.ts:36-42`: only a line break checks the cap. Text after the last line break isn't counted against it, but that text is a slice of the input plus at most a few closing characters, so the output can only pass the cap by about the input's own length.
- Mutation 4 failed on its first assertion, so the second document (`<!DOCTYPE a [<?p it's?>]><a/>`) passes after the fix but wasn't shown failing on its own.
- The source-pattern test only catches a module-level sticky regex written as a one-line `const X = /…/y;`. A sticky regex built with `new RegExp`, or exported, would get past it.