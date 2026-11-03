# MrDescriptionLook

Agent output (`agent://MrDescriptionLook`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionLook.md), collected 2026-11-03T23:27:54.373Z.

{
  "summary": "`MarkdownView.showCode(language, text)` now shows one code block (`pre.markdown-block.markdown-code > code`) through the existing `blockNode`/`paintCode`, replacing what the view showed. It is coloured when `languageNamed` knows the language and plain otherwise. A later `show` rebuilds from the top. `ui/useMarkdown.ts` gains `useMarkdownCode`, with the same lifecycle as `useMarkdown`. `vue/no-v-html` is an explicit error in `eslint.config.js` and is pinned by a node test. The ten tests the brief names pass, plus three node tests for `useMarkdownCode` that the mutation run needed.",
  "files_changed": [
    "frontend/src/editor/markdown.ts",
    "frontend/src/editor/markdown.browser.test.ts",
    "frontend/src/editor/AGENTS.md",
    "frontend/src/ui/useMarkdown.ts",
    "frontend/src/ui/useMarkdown.test.ts",
    "frontend/eslint.config.js",
    "frontend/scripts/eslintRules.test.ts"
  ],
  "tests_added": [
    {
      "name": "markdown.browser.test.ts > showCode_colours_a_known_language_with_the_panes_classes",
      "proves": "`ruby` shows its text at once, then `def` gets paletteHighlight's keyword class and the computed `--color-syntax-keyword` colour, and `42` gets the number class (WebKit)."
    },
    {
      "name": "markdown.browser.test.ts > showCode_keeps_null_empty_and_unknown_languages_plain",
      "proves": "null, \"\" and \"mermaid\" each give one `pre.markdown-block.markdown-code > code` holding a single text node. Checked after a ruby block shown at the same time has finished painting."
    },
    {
      "name": "markdown.browser.test.ts > showCode_never_reads_its_text_as_markup",
      "proves": "`<img onerror><script>` text shows literally, both plain and as `html`. Only PRE/CODE/SPAN appear, `class` is the only attribute, there is no img/script in the host, and `window.ran` stays undefined."
    },
    {
      "name": "markdown.browser.test.ts > showCode_and_show_replace_each_other",
      "proves": "`show` → `showCode` leaves one code block; `showCode` → `show` leaves exactly H1, P; two `showCode` calls in a row leave the second one alone."
    },
    {
      "name": "markdown.browser.test.ts > showCode_after_destroy_does_nothing",
      "proves": "`showCode` after `destroy` leaves the host empty."
    },
    {
      "name": "eslintRules.test.ts > v_html_is_an_error_in_a_vue_file",
      "proves": "Linting a sample with the real eslint.config.js (filePath src/ui/Sample.vue): `<div v-html=\"x\" />` gives exactly one vue/no-v-html message, with severity 2."
    },
    {
      "name": "eslintRules.test.ts > a_vue_file_without_v_html_reports_no_v_html",
      "proves": "A `{{ x }}` template gives no vue/no-v-html message."
    },
    {
      "name": "useMarkdown.test.ts > useMarkdownCode with a null host builds nothing, even when the code changes",
      "proves": "With no host, nothing is built or shown, and stopping the scope destroys nothing."
    },
    {
      "name": "useMarkdown.test.ts > useMarkdownCode shows the code in a set host, again on a change, and stopping the scope destroys",
      "proves": "Calls happen in the order build → showCode(ruby,a) → showCode(null,b) → destroy, so `language` and `text` both reach the view."
    },
    {
      "name": "useMarkdown.test.ts > useMarkdownCode on a host swap destroys the old view and shows the code in a new one; a null host only destroys",
      "proves": "A host swap gives one view per host element; with a null host, a code change shows nothing."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; echo $?",
      "observed": "$ vue-tsc -b → exit 0, no output"
    },
    {
      "command": "pnpm -C frontend lint; echo EXIT=$?",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" → EXIT=0"
    },
    {
      "command": "pnpm -C frontend fmt:check",
      "observed": "All matched files use the correct format. Finished in 1090ms on 776 files"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  281 passed (281)  Tests  4236 passed (4236)"
    },
    {
      "command": "pnpm -C frontend test:browser -- markdown (plain)",
      "observed": "Playwright WebKit does not launch: MiniBrowser 'error while loading shared libraries: libicudata.so.74' (the known #1445)."
    },
    {
      "command": "PLAYWRIGHT_BROWSERS_PATH=/tmp/mdl-pw pnpm -C frontend exec vitest run --project browser --reporter=verbose src/editor/markdown.browser.test.ts src/editor/internal/markdownDom.browser.test.ts",
      "observed": "✓ (webkit) the 5 showCode_* tests and the 3 markdownDom tests. Test Files 2 passed (2), Tests 8 passed (8)."
    },
    {
      "command": "PLAYWRIGHT_BROWSERS_PATH=/tmp/mdl-pw pnpm -C frontend test:browser markdown",
      "observed": "Test Files  2 passed (2)  Tests  8 passed (8)"
    },
    {
      "command": "PLAYWRIGHT_BROWSERS_PATH=/tmp/mdl-pw pnpm -C frontend test:browser -- markdown",
      "observed": "pnpm passes `--`, so the filter is ignored and every browser file runs: 5 files failed, 5 passed; 8 tests failed, 50 passed. All failures are in compare/problems/range/rangeThreads/removals: 'Access denied to /tmp/...png (server.fs)' screenshots plus the removals tests that follow. They are older than this slice; none is a markdown test."
    },
    {
      "command": "just mutants HEAD",
      "observed": "useMarkdown.ts: 26 killed, 2 survived, 0 no coverage (92.86%). Survivors: useMarkdown.ts:18 flush \"post\"→\"\" (an unchanged line) and :44, the same mutation on the new line."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → StrykerJS on src/ui/useMarkdown.ts: 26 killed, 0 timeout, 2 survived, 0 no-cov; editor/ (markdown.ts) and test/config files are not mutated",
    "survivors": [
      "frontend/src/ui/useMarkdown.ts:44 flush \"post\" → \"\" — wiring: flush post runs the host watch after Vue's DOM patch, so a template ref is set first. Only a mounted component shows this. useMarkdown's unchanged :18 survives the same mutation."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "`showCode` keeps the code node in `#shown` as `{ source: null, node }` (ShownBlock.source is now `string | null`) instead of setting `#shown = []`. With an empty list, a later `show` would append after the code block rather than replace it. A null source never equals a parsed block's source, so `show` drops it and rebuilds from the top.",
    "Owned was extended by Main mid-slice to `frontend/src/ui/useMarkdown.test.ts`: the mock gained `showCode`, and 3 useMarkdownCode tests kill the 14 no-coverage mutants.",
    "Playwright WebKit cannot launch on this host (#1445). I rebuilt a private copy at /tmp/mdl-pw/webkit-2370 (webkit-2370 plus Ubuntu noble's libicu74 74.2-1ubuntu3.1, libxml2 2.9.14+dfsg-1.3ubuntu3.10 and libflite1 2.2-6build3 .so files in minibrowser-wpe/sys/lib) and ran with PLAYWRIGHT_BROWSERS_PATH=/tmp/mdl-pw and the repo config.",
    "`pnpm -C frontend test:browser -- markdown` does not filter under pnpm 12 (the `--` reaches vitest). `pnpm -C frontend test:browser markdown` is the filtered form; both outputs are in smoke_evidence.",
    "The Ruby legacy mode tags `def` as `keyword`, not `definitionKeyword`, so the colour test checks `tags.keyword` / `--color-syntax-keyword`.",
    "Docs for the docs keeper: in project-map tree.md, :197 Markdown row should add `showCode` (one code block), and :270 should read `useMarkdown.ts (useMarkdown, useMarkdownCode; the only MarkdownView importer)`. The plan §2 #171 row is still the design's to add."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/useMarkdown.ts:46",
      "risk": "`watch(code, …)` compares the getter's object by identity. A caller whose getter builds a fresh object re-renders whenever any dependency it reads changes; it does not re-render when the result has not changed."
    },
    {
      "location": "frontend/src/editor/markdown.browser.test.ts:74",
      "risk": "\"Stays plain\" is checked after a ruby block shown at the same time has painted, not after an unbounded wait. A slower paint path just for an unknown name would go undetected (none exists: paintCode returns before any await)."
    }
  ]
}
