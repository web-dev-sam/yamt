# MrFastPreviewLocalR2

Agent output (`agent://MrFastPreviewLocalR2`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewLocalR2.md), collected 2026-11-04T22:29:06.143Z.

{
  "summary": "I fixed finding #2455. `CONTAINER_PREFIX` now takes any leading indent before a `>` or list marker (`^ *`). It also falls back to stripping a bare leading indent (`|^ +`), which adds the indent-stripped line as a layer. Line rules now run on continuation lines at column 4+. These four texts now return null: a `10.` item setext, a second-level dash setext, third-level indented code, and a nested S13 fence. Corpus still green: 63 local entries render, 24 are null.",
  "files_changed": [
    "frontend/src/editor/internal/localPreview.ts",
    "frontend/src/editor/internal/localPreview.test.ts",
    "frontend/src/editor/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "each_trigger_sends_the_text_to_gitlab: S1 setext in a tenth item",
      "proves": "`10. Title\\n    ===` returns null (GitLab shows a heading)."
    },
    {
      "name": "each_trigger_sends_the_text_to_gitlab: S1 dash setext in a second-level item",
      "proves": "`- a\\n  - Title\\n    ---` returns null."
    },
    {
      "name": "each_trigger_sends_the_text_to_gitlab: S2 indented code in a third-level item",
      "proves": "`- a\\n  - b\\n    -     code` returns null."
    },
    {
      "name": "each_trigger_sends_the_text_to_gitlab: S13 info words in a second-level item",
      "proves": "A nested ```` ```rust ignore ```` fence under `- a\\n  - b` returns null."
    }
  ],
  "smoke_evidence": [
    {
      "command": "Failing path, before the fix: pnpm -C frontend exec vitest run --project node src/editor/internal/localPreview.test.ts",
      "observed": "× each_trigger_sends_the_text_to_gitlab — AssertionError: 'expected { blocks: [ { kind: 'list', …(2) } ] } to be null' for all four: S1 setext in a tenth item, S1 dash setext in a second-level item, S2 indented code in a third-level item, S13 info words in a second-level item."
    },
    {
      "command": "Failing path, `|^ +` alternative removed (only `^ *` kept)",
      "observed": "× each_trigger… 'to be null' for: S1 setext in a tenth item, S1 dash setext in a second-level item, S13 info words in a second-level item. I put the alternative back."
    },
    {
      "command": "pnpm -C frontend exec vitest run --project node src/editor/internal/{localPreview,markdownInline,markdownBlocks}.test.ts",
      "observed": "Test Files 3 passed (3); Tests 35 passed (35). The corpus tests pass; jq on gitlab-preview.json counts 63 local:true and 24 local:false entries."
    },
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check",
      "observed": "vue-tsc -b: no output. lint exit 0. fmt:check first flagged my new test line; after oxfmt on the two files: 'All matched files use the correct format.'"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files 300 passed (300); Tests 4495 passed (4495)"
    },
    {
      "command": "pnpm -C frontend unused",
      "observed": "knip --include exports,types: no findings, exit 0"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 'mutants: no Rust changes since HEAD / mutants: no TypeScript changes since HEAD' (editor/ is not mutated; the failing paths above cover the changed regex)",
    "survivors": [
      "frontend/src/editor/internal/localPreview.ts:94 `^ *`→`^ {0,3}` in the marker alternative — equivalent: `|^ +` strips the indent first and the marker comes off on the next layer. It differs only in using one more of the MAX_NESTING layers."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "`frontend/src/editor/AGENTS.md`: the S rule now says layers are taken after each leading `>`, list marker or indent, at any column.",
    "Broader trigger (owner rule A2): any line with a leading indent of one or more spaces gets an indent-stripped layer. So a 4+ indented `===`/`---` after a plain paragraph also goes to GitLab, even where CommonMark makes it paragraph text. The corpus is unaffected."
  ],
  "open_risks": [
    {
      "location": "frontend/src/editor/internal/localPreview.ts:94",
      "risk": "Indented continuation lines now get their setext, fence and line rules checked, so a few texts yamt could draw go to GitLab (for example `a\\n    ---`). This is the A2 trade-off."
    }
  ]
}
