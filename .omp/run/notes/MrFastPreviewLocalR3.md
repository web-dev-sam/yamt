# MrFastPreviewLocalR3

Agent output (`agent://MrFastPreviewLocalR3`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewLocalR3.md), collected 2026-11-04T22:36:11.913Z.

{
  "summary": "I made the fix for #2462 and #2463, with one change from the brief. `CONTAINER_PREFIX` is now `/^ {0,3}(?:> ?|(?:[-*+]|\\d{1,9}[.)])(?: |$))|^ +/`, so an indent of 4+ is stripped first. A `>>>` quote in a second-level item now goes to GitLab (S6). The `- a\\n  - b\\n    - - -` case is a rule, which GitLab also draws, so it renders locally and is not a null trigger (see deviations). Both new tests fail on the old regex. The kept survivor is dropped. Corpus: 63 local, 24 null. All gates pass.",
  "files_changed": [
    "frontend/src/editor/internal/localPreview.ts",
    "frontend/src/editor/internal/localPreview.test.ts",
    "frontend/src/editor/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "each_trigger_sends_the_text_to_gitlab: 'S6 multi-line quote in a second-level item' (`- a\\n  - b\\n    >>>\\n    q\\n    >>>`)",
      "proves": "A 4+ indent is stripped before a `>` is read, so S6 fires in a nested item. Fails on the old `^ *` regex, which is the dropped survivor."
    },
    {
      "name": "a_rule_in_a_second_level_item_is_drawn_inside_it (`- a\\n  - b\\n    - - -`)",
      "proves": "Layering stops at the thematic break and yamt draws item b as [paragraph b, rule], as CommonMark and GitLab do. Fails on the old regex, which peeled the line down to `-` and sent it to GitLab through S15."
    }
  ],
  "smoke_evidence": [
    {
      "command": "Failing path, old regex `^ *(?:…)` with the new tests: pnpm -C frontend exec vitest run --project node src/editor/internal/localPreview.test.ts",
      "observed": "× each_trigger_sends_the_text_to_gitlab — AssertionError: S6 multi-line quote in a second-level item: expected { blocks: [ { kind: 'list', …(2) } ] } to be null; × a_rule_in_a_second_level_item_is_drawn_inside_it — expected null to deeply equal { blocks: [ { kind: 'list', …(2) } ] }; Tests 2 failed | 4 passed (6)"
    },
    {
      "command": "pnpm -C frontend exec vitest run --project node src/editor/internal/localPreview.test.ts (new regex)",
      "observed": "Tests  6 passed (6). This includes the corpus tests: every local:true entry renders, every local:false entry is null."
    },
    {
      "command": "jq '[.entries[]|.local]|group_by(.)|…' frontend/fixtures/markdown/gitlab-preview.json",
      "observed": "false: 24, true: 63"
    },
    {
      "command": "pnpm -C frontend typecheck && lint && fmt:check && test; pnpm -C frontend unused",
      "observed": "vue-tsc -b clean; oxlint --type-aware + eslint --max-warnings 0 clean; 'All matched files use the correct format.'; Test Files 300 passed (300), Tests 4496 passed (4496); knip --include exports,types exit 0"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 'mutants: no Rust changes since HEAD / mutants: no TypeScript changes since HEAD' (editor/ is not mutated). Hand mutant `^ {0,3}`→`^ *` (the old form) is killed by both new tests.",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "`- a\\n  - b\\n    - - -` is not a null trigger. With the brief's regex it stops at the RULE layer, and yamt draws item b as [paragraph b, rule]. CommonMark §4.1 gives the same: the break wins over a list item, and spaced `- - -` is no setext underline. The corpus marks rules local (rule_dash, rule_after_list). I pinned it as a local-render test that still tells the two regexes apart.",
    "The kept survivor line in `.omp/run/mutants/MrFastPreviewLocalR2.survivors.txt` is outside Owned. For R3 there is no survivor to keep, so that entry should not carry over.",
    "AGENTS.md: the S wording now says `>`/list markers indented 0–3 are stripped, and any other leading indent is stripped first."
  ],
  "open_risks": [
    {
      "location": "frontend/src/editor/internal/localPreview.ts:94",
      "risk": "The hand mutant `{0,3}`→`{0,4}` was not run. By reasoning ([INFERENCE]), the nested S6 test kills it: `    > ` would be stripped as a quote, so no layer reads `>>>`."
    }
  ]
}
