# RawCompareFormat (3.C-format, board Raw compare row 3)

The JSON and XML formatters and the "Auto" language finding are built as pure modules, and nothing calls them yet (that wiring is row 8). All five frontend recipes pass, and every named test failed under its hand mutation, which I then reverted.

**summary**
- `formatResult.ts`: the fixed `FormatResult` type, plus the plumbing both formatters share: the failure type, a layout writer, the trailing-newline rule, "unchanged" when the output equals the input, and the failure line counted from the failure's position.
- `formatJson.ts`: a strict RFC 8259 formatter that works as a loop with its own stack, not recursion. Keys keep their order, and strings and numbers keep the exact text they were written with.
- `formatXml.ts`: the XML formatter, also loop-based, applying the brief's line and indent rules. Tag text, entities, CDATA, comments and DOCTYPE stay byte for byte.
- `detectLanguage.ts`: the Auto rules from Behaviour 4, using the language list's own `matchLanguageName`.

**files_changed** (all new)
- `frontend/src/editor/internal/formatResult.ts`
- `frontend/src/editor/internal/formatJson.ts`, `formatJson.test.ts`
- `frontend/src/editor/internal/formatXml.ts`, `formatXml.test.ts`
- `frontend/src/editor/internal/detectLanguage.ts`, `detectLanguage.test.ts`

**tests_added** (the bug each one catches is in its test name; next to each is the mutation I applied, saw fail, and reverted)
- `formatJson.test.ts`:
  - minified and odd layouts give the same text ← `": "` changed to `":"`
  - key order and numbers kept ← layout replaced by `JSON.stringify(JSON.parse(text), null, 2)`; it received `"2"` first, `12345678901234567000` and `10000000000`
  - missing comma → `line: 3` ← `line += 1` changed to `line += 0` in `formatResult.ts` `lineOf`
  - final newline kept, and its absence kept ← always append `"\n"`
  - `{ }` and `[\n]` stay compact ← `` `${opened}\n${close}` ``
  - `"a\"b"` is one token ← `at += 1` with no escape handling
  - text after the root fails ← the end check made unreachable (`this.#at < 0`)
  - already formatted → unchanged (JSON and XML) ← always answer `formatted`
  - whitespace only → unchanged ← blank check changed to `end === -1`
  - 100,000 nested arrays don't throw ← `return this.#value();` added (recursion); it failed with `RangeError: Maximum call stack size exceeded`
  - extra tests for string, number and object grammar.
- `formatXml.test.ts`:
  - nested elements re-indented ← `depth += 0`
  - text-only element on one line ← `!element.children ||` dropped
  - mixed content verbatim ← `|| element.text` dropped
  - declaration, comment, CDATA, DOCTYPE with an internal subset, and character references kept ← references decoded with `.replace(/&#(\d+);/g, …)`
  - `</b>` closing `<a>` fails at line 3 ← name comparison made always false
  - `xml:space="preserve"` kept ← `preserve: tag === ""`
  - quoted `>` and a tag over two lines kept ← quotes ignored inside a tag
  - second root fails ← refusal made unreachable
  - extra: unterminated constructs, plus 100,000 nested elements. I proved no mutation for the nesting test: this scanner has no recursion to mutate.
- `detectLanguage.test.ts`:
  - `{"a":1}` is JSON, `{ foo }` is nothing ← `/^\{/`
  - `[section]` is nothing, `[1, 2]` is JSON ← `/^\[/`
  - `<!DOCTYPE html>` and `<HTML …>` are HTML ← HTML rule refused whenever the tag rule matches (same effect as XML first)
  - interpreter version stripped ← `const name = interpreter;` (it received `"SQL"` instead of `"SQLite"`)
  - leading whitespace and BOM skipped ← `text.search(/^/)`
  - left wins, right read when the left finds nothing ← columns swapped
  - only the first 4,096 characters read ← `text.slice(start)`
  - every returned name resolves through `matchLanguageName` ← `"Json"`

**smoke_evidence**
- `pnpm -C frontend exec vitest run --project node` on the 3 new files → `Test Files 3 passed (3)`, `Tests 33 passed (33)`
- `pnpm -C frontend typecheck` → `$ vue-tsc -b` with no errors
- `pnpm -C frontend test` → `Test Files 129 passed (129)`, `Tests 1789 passed (1789)`
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint …`, exit 0, no findings
- `pnpm -C frontend unused` → `$ knip --include exports,types`, no findings
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- Example mutation runs: J10 → `× … 100,000 nested arrays … RangeError: Maximum call stack size exceeded`; X5 → `× … (catches the end-tag name not compared)`, `Tests 1 failed | 10 passed (11)`. Every other mutation listed above produced a `×` on its named test.

**deviations_from_brief**
- **Extra file:** `formatResult.ts` also exports `FormatFailure`, `Layout`, `formatWith` and `SPACE`, so the trailing-newline, unchanged and line rules exist once for both formatters. Everything stays within the owned files.
- **Line test mutation:** the failure line is counted from the failure's position when a failure happens, not by a running counter. The brief's mutation ("counter not incremented on `\n` in whitespace") therefore became `line += 0` in `lineOf`, which is the same bug in this design.
- **Nested-arrays test:** it uses 100,000 `[` with one `]` missing and expects a failure. Formatting 100,000 valid nested levels would produce about 10¹⁰ characters, far beyond the longest string a JS engine can hold. The scan still covers the full depth, and the recursion mutation overflows the stack.
- **`&#233;` in the XML test:** I used `&#x00E9;` and `&#38;` instead, because `scripts/palette.test.ts` reads `#233` as a colour literal and fails the test run. The decode mutation was re-proved on the new references.
- **Extra cases:** `#!/usr/bin/sqlite3` is in the version test. `matchLanguageName(…, true)` matches any alias longer than 2 characters as a substring, so `python3` resolves to Python even without stripping, and the Python case alone could not catch the mutation.
- **Decisions the brief left open:**
  - JSON failure messages for keys, values, escapes and control characters.
  - XML failure messages.
  - In XML, CDATA counts as a node on its own line, not as text, so it does not make content mixed.
  - CDATA outside the root fails as "Text outside the root element".
  - The language list has 143 entries in 6.5.2, not the 151 the brief gives.
- **`pnpm -C frontend install --frozen-lockfile --offline`:** I ran it in the worktree because it had no `node_modules`.

**open_risks**
- `frontend/src/editor/internal/formatResult.ts:35-39`: valid JSON or XML nested deep enough that the indented output passes the engine's maximum string length makes `Layout.toString` throw a `RangeError` instead of returning `failed`. Inside an 8 MiB column this needs nesting in the tens of thousands of levels.
- `frontend/src/editor/internal/formatXml.ts:18`: `PRESERVE` is matched against the whole start tag, so ` xml:space="preserve"` written inside another attribute's value would also count. XML tags and attributes are otherwise not validated, which is a non-goal.
- `frontend/src/editor/internal/detectLanguage.ts:51`: the substring matching inside `matchLanguageName` can map an unknown interpreter to a language whose alias it contains (for example `javascript3` would become Java). That is CodeMirror's own rule, which the brief requires.