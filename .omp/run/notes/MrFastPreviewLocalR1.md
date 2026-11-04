# MrFastPreviewLocalR1

Agent output (`agent://MrFastPreviewLocalR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewLocalR1.md), collected 2026-11-04T22:09:27.834Z.

{
  "summary": "Fixed findings 2432–2434 and 2437–2443. The nesting limit is `MAX_NESTING - 1`, trigger lists are records keyed by rule, builders are `described*`. New triggers: GL-123, `iteration:`, `group/project>`, unusual white space, NUL on any line, front matter variants. Line rules also run on lines with leading `>` and list markers stripped. commonMark mode reads a run's neighbours past `~`. Corpus: 63 local entries render, 24 others are null.",
  "files_changed": [
    "frontend/src/editor/internal/localPreview.ts",
    "frontend/src/editor/internal/localPreview.test.ts",
    "frontend/src/editor/internal/markdownInline.ts",
    "frontend/src/editor/internal/markdownInline.test.ts",
    "frontend/src/editor/internal/markdownBlocks.ts",
    "frontend/src/editor/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "each_trigger_sends_the_text_to_gitlab (new cases)",
      "proves": "New nulls: GL-123, `a/b>`, iteration; S1–S5 and S13 under `>` or a list marker; four front-matter variants; NUL in a fence; U+3000 line and indent. N quote is now `> `×(MAX_NESTING-1)."
    },
    {
      "name": "commonmark_flanking_reads_a_runs_neighbours_past_strike_tildes",
      "proves": "In commonMark mode `**~~old~~**new` and `a**~~b~~**` parse as strong(strike(…)), as cmark-gfm and comrak do (they skip `~`)."
    },
    {
      "name": "every_local_entry_of_gitlabs_corpus_renders_to_its_blocks (unchanged)",
      "proves": "Container stripping stops at a thematic break: without that stop, star_rule (`* * *`) fails."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run --project node src/editor/internal/{localPreview,markdownInline,markdownBlocks}.test.ts",
      "observed": "Test Files 3 passed (3); Tests 35 passed (35). The corpus tests pass: 63 local:true entries render, 24 local:false entries return null."
    },
    {
      "command": "Failing path (container case): containerLayers never strips (loop condition false)",
      "observed": "× each_trigger… — AssertionError, 'to be null', for each of: S1 setext in a quote, S1 dash setext in a quote, S2 indented code in a quote, S2 indented code in an item, S3 paren item in a quote, S3 paren item in an item, S4 plus item in a quote, S5 mixed bullets in a quote, S13 info words in a quote. Undone."
    },
    {
      "command": "Failing path: drop the describedBlocks depth check (block-level N)",
      "observed": "× each_trigger_sends_the_text_to_gitlab — AssertionError: N quote: expected { blocks: [ { kind: 'quote', …(1) } ] } to be null. Undone."
    },
    {
      "command": "Failing path: drop the RULE stop in containerLayers",
      "observed": "× every_local_entry… — AssertionError: star_rule: expected null to deeply equal { blocks: [ { …(2) }, …(2) ] }. Undone."
    },
    {
      "command": "Failing path: GL/iteration/projectPath and otherWhiteSpace → /(?!)/, old front-matter check on lines[0], NUL check off",
      "observed": "× each_trigger… — 'to be null' for: T1 GitLab issue, T1 project reference, T1 iteration, T1 iteration number, S7 with a language, S7 closed by dots, S7 after a blank line, S7 after an encoding line, S9 nul, S9 nul in a fence, S9 ideographic space line and indent. Undone."
    },
    {
      "command": "Failing path: commonMarkNeighbours without the ~ skip",
      "observed": "× commonmark_flanking_reads_a_runs_neighbours_past_strike_tildes — AssertionError: expected [ { kind: 'text', text: '**' }, …(2) ] to deeply equal [ { kind: 'strong', …(1) }, …(1) ]. Undone."
    },
    {
      "command": "pnpm -C frontend typecheck; pnpm -C frontend lint; pnpm -C frontend fmt:check",
      "observed": "vue-tsc -b: no output; oxlint --type-aware && eslint: no findings; oxfmt: All matched files use the correct format."
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files 300 passed (300); Tests 4485 passed (4485)"
    },
    {
      "command": "pnpm -C frontend unused",
      "observed": "Unused exports (1): localPreview src/editor/index.ts:14:10 — expected until mr-fast-preview-panel lands (exit 1)."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → \"mutants: no Rust changes since HEAD / mutants: no TypeScript changes since HEAD\" (editor/ is excluded; the failing paths above stand in)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "`RULE` in markdownBlocks.ts is now exported, so `containerLayers` stops at a thematic break by the parser's own rule (`* * *` is a rule, not nested items).",
    "Container fix (#2438) is the broader trigger: line rules run on every container layer (`CONTAINER_PREFIX` strips `>` and `-*+`/`1.`/`1)` markers, up to MAX_NESTING layers). After a container marker, a layer indented 4+ columns always triggers, so a continuation such as `> a\\n>     b` also goes to GitLab (owner rule A2).",
    "Mixed `-`/`*` bullets (S5) are checked on every container layer. Front matter goes to GitLab when the first non-blank line, read past a first line holding `coding:`, matches `/^(---|\\+\\+\\+|;;;)[ \\t]*\\S*[ \\t]*$/`, so a leading `----` rule also goes to GitLab.",
    "The new white-space trigger (`otherWhiteSpace`) is exempt in fenced lines, like the tab. NUL is checked on the whole text.",
    "The doc comment on `Flanking` now also says a run's neighbours are read past `~`. The signature is unchanged.",
    "The new reference triggers are listed as T1 cases, and the white-space cases as S9."
  ],
  "open_risks": [
    {
      "location": "frontend/src/editor/index.ts:14",
      "risk": "knip reports `localPreview` as unused until mr-fast-preview-panel calls it."
    },
    {
      "location": "frontend/src/editor/internal/localPreview.ts:94",
      "risk": "`CONTAINER_PREFIX` partly repeats markdownBlocks' QUOTE/ITEM shapes. It is broader on purpose (`+`, `)` markers), so a change to the parser's markers is not picked up here."
    },
    {
      "location": "frontend/src/editor/internal/localPreview.ts:132-143",
      "risk": "Some texts yamt could draw now go to GitLab: a `>` continuation indented 4+, a `>`-only line before a `-`/`===` line, a quoted fence with indented content."
    }
  ]
}
