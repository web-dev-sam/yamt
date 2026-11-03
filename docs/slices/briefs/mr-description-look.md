# Slice mr-description-look — one code block in yamt's Markdown look; `v-html` an error

Feature: a merge request's description in a floating panel. Sources:

- Request `docs/slices/request-mr-description.md`: rule 3 (code blocks in yamt's own code colours) and rule 6 (nothing
  interpreted).
- Design `docs/slices/briefs/mr-description-design.md` option A, §1.7.
- Proposed plan §2 #171; RK66.

Runs in wave 1 beside `mr-description-rust`. `mr-description-page` uses what this slice adds.

## Target

**Owned:**

- `frontend/src/editor/markdown.ts`
- `frontend/src/editor/markdown.browser.test.ts` (new)
- `frontend/src/editor/AGENTS.md`
- `frontend/src/ui/useMarkdown.ts`
- `frontend/eslint.config.js`
- `frontend/scripts/eslintRules.test.ts` (new)

**Read-only:** everything else.

- `frontend/src/editor/internal/**`: use `paintCode` (`codeBlock.ts:21-38`), `blockNode`/`CodePainter`
  (`markdownDom.ts:6, 121-127, 210-214`) and the `CodeBlock` type (`markdownBlocks.ts:15, 23`) as they are.
- `frontend/scripts/markdownFence.ts`: `MarkdownView` stays reachable from `ui/` only through `ui/useMarkdown.ts`
  (`:15-17, 49-63`). That is why the new function lives in that file, and the fence needs no change.
- `docs/**`: put lines in `deviations_from_brief`.

**Non-goals:**

- The description panel and its renderers (`mr-description-page`).
- Any change to how `show(text)` parses or renders Markdown (plan #112 stands for the AI's answers and threads).
- Any new fence script.

## Contract

Fixed; add-only beyond this.

```ts
// editor/markdown.ts — MarkdownView gains one method
/** Shows one code block in yamt's Markdown look (`pre.markdown-block.markdown-code > code`), replacing whatever the
 *  view showed: the text at once as text, then coloured by the panes' highlighters when `language` names one yamt
 *  knows (`languageNamed`); plain for null, "" or an unknown name. Never reads `text` as markup. */
showCode(language: string | null, text: string): void;

// ui/useMarkdown.ts — beside useMarkdown, the same lifecycle (watch the host with flush "post", destroy on scope end)
export function useMarkdownCode(
  host: Readonly<ShallowRef<HTMLElement | null>>,
  code: () => { readonly language: string | null; readonly text: string },
): void;
```

- `show(text)` after `showCode` and `showCode` after `show(text)` each replace the other's content. `show` keeps its
  first-changed-block diffing among `show` calls.
- `eslint.config.js`: `"vue/no-v-html": "error"` in the `**/*.vue` rules.
  - Today the rule comes from `flat/recommended` as a warning (`eslint.config.js:12`) `[INFERENCE: eslint-plugin-vue
    10's recommended config]`, and `--max-warnings 0` turns it into a failure (`package.json:9`).
  - The explicit error keeps it a failure if that flag ever changes.

## Change

1. `MarkdownView.showCode`: build the block with `blockNode(document, { kind: "code", info: language ?? "", code: text
   }, this.#paint)`, replace the host's children, and reset `#shown` so a later `show` starts afresh. Keep the
   `#destroyed` guard.
2. `useMarkdownCode` in `ui/useMarkdown.ts`, the shape of `useMarkdown` (`useMarkdown.ts:5-28`): one view per host
   element, `showCode` on the host's change and on `code()`'s change, `destroy` on scope dispose.
3. `markdown.browser.test.ts` (WebKit; `vite.config.ts:13-14` runs `src/editor/**/*.browser.test.ts`). Follow
   `internal/markdownDom.browser.test.ts`'s pattern (`style.css` imported, `ALLOWED_TAGS`, hostile text).
4. `eslint.config.js` and `scripts/eslintRules.test.ts`. The node project runs `scripts/**/*.test.ts`
   (`vite.config.ts:44`). Use ESLint's `ESLint` class with `overrideConfigFile` set to the real `eslint.config.js` and
   `lintText(…, { filePath: "src/ui/Sample.vue" })`.
5. `editor/AGENTS.md`: one line for `showCode` beside the existing `MarkdownView` line.

## Acceptance

**Tests:**

- `markdown.browser.test.ts` (`pnpm -C frontend test:browser`):
  - `showCode_colours_a_known_language_with_the_panes_classes`: `ruby` → highlighted spans with the panes' classes,
    as `markdownDom.browser.test.ts` checks `paletteHighlight`.
  - `showCode_keeps_null_empty_and_unknown_languages_plain`: `null`, `""` and `"mermaid"` give one text node only.
  - `showCode_never_reads_its_text_as_markup`: text `<img src=x onerror="window.ran = true"><script>window.ran =
    true</script>` shows literally. `window.ran` stays undefined; no `img` or `script` element is created.
  - `showCode_and_show_replace_each_other`
  - `showCode_after_destroy_does_nothing`
- `scripts/eslintRules.test.ts` (`pnpm -C frontend test`):
  - `v_html_is_an_error_in_a_vue_file`: a sample with `<div v-html="x" />` reports `vue/no-v-html` with severity 2.
  - `a_vue_file_without_v_html_reports_no_v_html`

**Commands:**

- `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend fmt:check` and `pnpm -C frontend test`:
  their summary lines.
- `pnpm -C frontend test:browser -- markdown`: the five tests pass.
- `just mutants HEAD` in your workspace (SP11).

**Smoke:** none beyond the WebKit tests. The panel shows the block in `mr-description-page`.

## Skills

`skill://cm6-rules`, `skill://ts-conventions`, `skill://vue-conventions`, `skill://verification`.
