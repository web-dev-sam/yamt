# MrFastPreviewLocalCorrectness

Agent output (`agent://MrFastPreviewLocalCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewLocalCorrectness.md), collected 2026-11-04T22:02:03.992Z.

{
  "verdict": "fail",
  "checked": [
    "K1: reducer takes data-canonical-lang as written (element.rs:6-19); fenced_ts keeps \"ts\". Probe: js/sh/c++ same string, py/glql/query null. Both paths colour via MergeRequestDescriptionCode -> languageNamed.",
    "Emoji reduce to plain text (corpus:unicode), so T4 only errs toward GitLab. Entities, www. (/i), e-mail, mailto/xmpp, scheme://, :name: checked against GitLab's filters: no gap.",
    "commonMarkAbility matches CommonMark 0.31.2 §6.2 (flanking, _ rules 2/4, P+S punctuation, Zs/tab/LF/FF/CR). comrak's is_cmark_punctuation agrees. markdownDom.ts:117 keeps yamt mode (A4).",
    "Corpus 63 local / 24 refused. Deviations accepted: exemption kept, S12 off, extra exports, row-186 wording, knip risk. Five failing paths pasted; empty survivors accepted (brief: editor/ not mutated).",
    "Each TRIGGERS text checked for masking: T7 reachable only via C2 (by construction), S7 isolated by the +++ case, N quote masked by S6 (finding). Ran a scratch vitest probe outside the repo.",
    "Sources: gitlab.com markdown.md:805-830, issue.rb:486-520, project.rb:1359-1375, front_matter.rb; comrak inlines.rs:67-68,2308-2420; cmark-gfm inlines.c:425-434."
  ],
  "findings": [
    {
      "file": "frontend/src/editor/internal/localPreview.ts",
      "line": 67,
      "severity": "block",
      "rule_id": "A2",
      "problem": "Three GitLab references have no trigger: `GL-123` (issue.rb:488), `namespace/project>` (project.rb:1359 `reference_postfix '>'`) and `*iteration:\"Sprint 1\"` (markdown.md:816). The probe showed `see *iteration:12 now` rendered locally, so yamt shows plain text where GitLab links.",
      "fix": "Add triggers `/GL-\\d/`, `/iteration:/` and a slash-path followed by `>` (`/[\\p{L}\\p{N}_.-]\\/[\\p{L}\\p{N}_.-]+>/u`; a bare `>` would break corpus ampersand_no_angle), each with a trigger case."
    },
    {
      "file": "frontend/src/editor/internal/localPreview.ts",
      "line": 110,
      "severity": "block",
      "rule_id": "A2",
      "problem": "S1–S4, S8 and S15 test raw lines, so a `>` or list marker hides them. `>     code` and `-     code` are indented code on GitLab but a paragraph here. `> Title\\n> ===` and `> a\\n> -` are setext headings on GitLab. `> 1) a`, `- 1) a`, `> + a` and `> - a\\n> * b` are new lists on GitLab. All render locally.",
      "fix": "Run the line rules on each line with its container prefixes removed (repeated `^ {0,3}> ?` and list markers, keeping the remaining indent), or on the lines quote/itemEnd hand to blocksOf; add these texts as trigger cases."
    },
    {
      "file": "frontend/src/editor/internal/localPreview.ts",
      "line": 88,
      "severity": "block",
      "rule_id": "A2",
      "problem": "GitLab front matter (front_matter.rb) allows a language after the opener, leading blank lines, a `coding:` first line and a `...` closer. S7 checks only lines[0] against `/^(---|\\+\\+\\+|;;;)\\s*$/`, so `+++toml\\nk = 1\\n+++`, `---json\\nx\\n...` and `\\n---\\nk: v\\n...` render locally while GitLab draws a front-matter code block.",
      "fix": "Test the first non-blank line, and the line after a `coding:` first line, against `/^(---|\\+\\+\\+|;;;)[ \\t]*\\S*[ \\t]*$/`; add these three texts to the triggers."
    },
    {
      "file": "frontend/src/editor/internal/markdownInline.ts",
      "line": 178,
      "severity": "block",
      "rule_id": "A2",
      "problem": "GitLab's parsers both skip `~` when reading a delimiter run's neighbours (cmark-gfm inlines.c:427-433 SKIP_CHARS; comrak inlines.rs:68,2308-2359). commonMark mode reads the raw neighbour, so `**~~old~~**new` is strong+strike on GitLab but here a literal `**` around a strike, with no trigger.",
      "fix": "In commonMark mode, skip `~` when computing before/after (a skipped-to edge counts as a line end), as comrak does, or trigger when a `*`/`_` run touches `~~`; test `**~~old~~**new`."
    },
    {
      "file": "frontend/src/editor/internal/markdownBlocks.ts",
      "line": 50,
      "severity": "block",
      "rule_id": "A2",
      "problem": "isBlank (`trim()`) and paragraph (`trimStart()`) treat NBSP, U+3000 and U+FEFF as blank or indent; CommonMark and comrak use only space and tab. `a\\n\\u3000\\nb` becomes two paragraphs here but one on GitLab, and a `\\u3000`-indented Japanese paragraph loses its indent. No rule triggers.",
      "fix": "Add a line trigger beside S9 for white space other than space, tab, CR and LF (`/[^\\S \\t\\r\\n]/`), leaving the AI chat's isBlank unchanged; add `a\\n\\u3000\\nb` and `\\u3000x` trigger cases."
    },
    {
      "file": "frontend/src/editor/internal/localPreview.ts",
      "line": 127,
      "severity": "block",
      "rule_id": "A2",
      "problem": "S9's NUL check skips fenced lines, but CommonMark replaces U+0000 with U+FFFD everywhere, code included. A fence holding `a\\0b` renders locally as code `a\\0b`, while GitLab's reduced block reads `a\\uFFFDb`.",
      "fix": "Test `\\0` on every line (keep the fence exemption only for the tab) and add a fence-with-NUL trigger case."
    },
    {
      "file": "frontend/src/editor/internal/localPreview.test.ts",
      "line": 69,
      "severity": "block",
      "rule_id": "VF7",
      "problem": "The `N quote` text `>>>>>>>>>>>>>>> deep` matches S6 `/^ {0,3}>>>/`, so it stays null even with blocksOf's depth check deleted. Block-level N is untested, yet a `> > > …` quote 17 deep (past MAX_NESTING) renders its markers as text without that check.",
      "fix": "Use `\"> \".repeat(15) + \"deep\"` (no `>>>` run) and paste the failure seen with the blocksOf depth check removed."
    }
  ]
}
