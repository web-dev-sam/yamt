## summary
- The AI's answers now render through yamt's own Markdown subset, plan §2 #112. `editor/markdown.ts` holds `MarkdownView` (`show`, `destroy`), which re-renders from the first block whose source changed.
- Two pure parsers do the reading: `internal/markdownBlocks.ts` (lines → blocks, each top-level block keeps its source lines) and `internal/markdownInline.ts`. Raw HTML stays literal text. Images show as `alt (url)` text. Links show their text plus the address, muted, and are never navigable.
- `internal/markdownDom.ts` builds the DOM from a fixed tag set, with `class` as the only attribute and no `innerHTML`. `internal/codeBlock.ts` colours fenced code with the panes' `paletteHighlight` and `fontHighlight`, and does not paint into a view that is gone.
- `ui/useMarkdown.ts` is the ui seam. A new PM2 rule in `scripts/fences.ts` refuses `MarkdownView` anywhere else in `ui/`.
- The answer's look lives in `editor/theme.css` (`.markdown-*`, palette tokens only), and `editor/AGENTS.md` describes the whole module.

## files_changed
- New: `frontend/src/editor/markdown.ts`, `frontend/src/editor/internal/{markdownBlocks,markdownInline,markdownDom,codeBlock}.ts`, `frontend/src/editor/internal/{markdownBlocks,markdownInline}.test.ts`, `frontend/src/editor/internal/markdownDom.browser.test.ts`, `frontend/src/ui/useMarkdown.ts`
- Changed: `frontend/src/editor/index.ts` (one line: `export { MarkdownView } from "./markdown";`), `frontend/src/editor/theme.css`, `frontend/src/editor/AGENTS.md`, `frontend/scripts/fences.ts`, `frontend/scripts/fences.test.ts`

## tests_added
Each test below was run once against a one-line hand mutation and failed under it; every mutation was then reverted.

**`markdownBlocks.test.ts`**
- "a fenced block keeps a line that looks like a heading". Mutation: `if (HEADING.test(line) || closesFence(line, marks))` in `fence` → `× … 1 failed`.
- "a list item's indented continuation joins the item". Mutation: `indentOf(line) >= start.column` → `true` → `×`.
- "a table needs its delimiter row". Mutation: `startsTable` returns `header.includes("|")` → `×`.
- "raw HTML stays text": a `<div onclick>`/`<script>` block stays a paragraph.
- Also pinned, without a mutation: the tilde fence and an unclosed fence, a lazy line plus a nested list, headings/quotes/rules interrupting a paragraph, and the block sources used for streaming.

**`markdownInline.test.ts`**
- "backticks win over emphasis". Mutation: code-span skipping off in `skipped` (`char === "\`" && false`) → `×`.
- "an unmatched `*` stays literal". Mutation: an unmatched marker becomes `text("", …)` → `×`.
- "raw HTML stays text". Mutation: `AUTOLINK = /^<([^>]*)>/` → `×`.
- "an image is its alt text and address". Mutation: the address is dropped → `×`.
- Also pinned: `snake_case` underscores, strong/strike/nesting, a `javascript:` link kept as text, escapes and breaks.

**`markdownDom.browser.test.ts`**
- The three acceptance tests as named in the brief. They have not run as a file (see smoke_evidence).

**`fences.test.ts`**
- "a ui file importing MarkdownView from editor/index.ts outside useMarkdown.ts violates PM2" covers a renamed import, a re-export, a namespace import and a direct `../editor/markdown` import. Mutation: `markdownViolations(file.path, [])` → `× … Tests 1 failed | 28 passed`.
- A second test checks that `useMarkdown.ts`, other editor names and `editor/index.ts` itself violate nothing.

## smoke_evidence
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, exit 0.
- `pnpm -C frontend lint` → oxlint and eslint, exit 0, nothing reported.
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- `pnpm -C frontend unused` → knip, exit 0.
- `pnpm -C frontend test` → `Test Files 154 passed (154)`, `Tests 1996 passed (1996)`.

**Browser test: Playwright WebKit cannot launch on this host, so the file never ran.**
- `pnpm -C frontend exec vitest run --project browser src/editor/internal/markdownDom.browser.test.ts` stopped at `MiniBrowser: error while loading shared libraries: libicudata.so.74` (#423/#1074).
- Instead, as RVColumns did: `just app-session start-fixture --name rvmd` (which starts `just webdriver` and MiniBrowser). A throwaway WebDriver script, `/tmp/md-probe/probe.mjs`, imports `/src/editor/index.ts` in the page and runs the file's three checks. Final run on the finished tree:
  - **hostile:** `{"elements":33,"badTags":[],"badAttributes":[],"ran":null,"scriptText":true,"linkText":true,"imageText":true,"address":"javascript:window.ran=true","pass":true}`. `ran` is `undefined` in the page; JSON prints it as `null`.
  - **highlight:** `"constClass":"ͼx","constRules":[".ͼx {color: var(--color-syntax-definition-keyword);}"],"constColour":"rgb(224, 152, 107)"` equals the colour of `var(--color-syntax-definition-keyword)`. `"numberRules":[".ͼ13 {color: var(--color-syntax-number);}"]`, `"stylesMounted":1`, `"pass":true`.
  - **streaming:** `{"keptTitle":true,"replacedParagraph":true,"paragraph":"First paragraph, done.","em":"paragraph","count":3,"pass":true}`.
- The same probe under each mutation:
  - `innerHTML` for paragraphs: `hostile: False`, with `badTags: ['IMG','DIV','IFRAME','B','A']`, `badAttributes: ['src','onerror','onclick','src','onmouseover','href']`, `ran: True` (the `onerror` really ran).
  - Highlighter dropped (`HIGHLIGHTERS = []`): `highlight: False`, `constClass: None`.
  - Re-render from block 0: `streaming: False`, `keptTitle: False`.
- **Screenshots** (MiniBrowser, through `/tmp/md-probe/shot.mjs`): `/tmp/md-probe/answer-dark.png` and `/tmp/md-probe/answer-light.png`. One answer with an h2, inline code, strong/em/strike, a nested bullet list, an ordered list, a table aligned left/right/center, a quote, a coloured `ts` block, and a link with its muted address. Tags present: `H2,CODE,P,STRONG,EM,DEL,UL,LI,OL,SPAN,TABLE,THEAD,TR,TH,TBODY,TD,BLOCKQUOTE,PRE`; 76 highlight spans. I looked at both images; they render as intended.
- `just map-check` → `map-check: ok`, but only because it reads `git ls-files` and the new files are untracked. See deviations.

## deviations_from_brief
- **`StyleModule.mount` is not used.** style-mod is not in `frontend/package.json`; pnpm keeps it private to `@codemirror/view`, and the brief forbids a dependency. `codeBlock.ts` instead puts `paletteHighlight.module.getRules()` and `fontHighlight.module.getRules()` into one `<style class="markdown-highlight-styles">` in `<head>`, mounted once per document (it checks the DOM; no module state). These are the same rules from the same HighlightStyles, so there is still only one colour table. The CSP allows inline styles (`style-src 'self' 'unsafe-inline'`).
- **Ordered lists carry their start number in a `span.markdown-number`.** `class` is the only allowed attribute, so `<ol start>` cannot be used; the list is `list-style: none` and the number is positioned in the margin.
- **Every block also carries the class `markdown-block`.** Tailwind's preflight resets margins and list styles, so `theme.css` styles spacing, headings and lists as well as the brief's code block, table, quote and address.
- **A `.markdown-address` is left out when it adds nothing.** If a link's address is empty or equals its text, only the text is shown.
- **The fence also refuses a namespace import or `export *` of `editor/` in `ui/` outside `useMarkdown.ts`, and any `ui/` import of `editor/markdown`.** Both expose `MarkdownView`.
- **Shared files outside my ownership need these edits** (PM6 will fail once the new files are committed):
  - `.omp/skills/project-map/SKILL.md`, `frontend/src/editor` row, add: "the AI's answers (plan §2 #112): markdown.ts (`MarkdownView(host)`: show, destroy; reached only through ui/useMarkdown.ts); internal/: markdownBlocks (pure: lines → blocks with their source lines), markdownInline (pure: inlines; code spans win), markdownDom (createElement/textContent/className only, fixed tags, `class` the only attribute), codeBlock (`languageNamed` + `highlightCode` with `paletteHighlight` + `fontHighlight`, their rules in one `<style>`)".
  - Same file, `frontend/src/ui` row, add: "useMarkdown.ts (`useMarkdown(host, text)`: the ui seam of `MarkdownView`, PM2)".
  - Same file, PM2 detector line: "`ui/` imports `MarkdownView` only in `ui/useMarkdown.ts` (`scripts/fences.ts`)".
  - `frontend/src/ui/AGENTS.md` line 1: add `useMarkdown` to "the editor seams are …".
  - `docs/architecture.md` §5.2: name `MarkdownView` as a public class.
- `pnpm -C frontend install --frozen-lockfile --offline` was run because the worktree had no `node_modules` (gitignored).

## open_risks
- `frontend/src/editor/internal/markdownDom.browser.test.ts` has never run in Playwright WebKit; only its scenario was reproduced in MiniBrowser. Its `expect.poll` waits and the `tags.definitionKeyword` / `tags.number` classes match what the probe saw (`ͼx`, `ͼ13`).
- Unmatched emphasis is approximate in `frontend/src/editor/internal/markdownInline.ts` (`closer`): an inner opener with no closer makes the outer one fail too, so `*a **b c*` shows as literal `*a *` plus emphasis on "b c", where CommonMark gives `<em>a **b c</em>`. This was chosen to keep the scan from going exponential.
- `frontend/src/editor/internal/markdownBlocks.ts` (`itemEnd`): a lazy line can join an item whose last content is an open fence. Tabs count to 4-column stops, but a tab split by a strip is dropped, not split into spaces.
- `frontend/src/editor/internal/markdownBlocks.ts` (`delimiterRow`) and `markdownBlocks.ts:50` hold the whole parser in 296 lines, close to the 300-line cap.
- Table cells are split with a lookbehind regex (`(?<!\\)\|`), which needs WebKit ≥ 16.4; WebKitGTK 2.54 has it.