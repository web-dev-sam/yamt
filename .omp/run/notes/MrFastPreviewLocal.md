# MrFastPreviewLocal

Agent output (`agent://MrFastPreviewLocal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewLocal.md), collected 2026-11-04T21:49:35.544Z.

{
  "summary": "`localPreview(text): Description | null` in `editor/internal/localPreview.ts`, exported from `editor/index.ts`. It returns null when any of rules C, T, S, K or N holds; otherwise GitLab's reduced blocks, every table cell `start`. `parseInline` gains a CommonMark §6.2 flanking mode; the default stays `\"yamt\"`. `fencedLines` shares `fence`'s scan (`fenceAt`). Corpus: all 63 `local: true` entries render to GitLab's blocks; all 24 `local: false` entries return null.",
  "files_changed": [
    "frontend/src/editor/internal/localPreview.ts",
    "frontend/src/editor/internal/localPreview.test.ts",
    "frontend/src/editor/internal/markdownInline.ts",
    "frontend/src/editor/internal/markdownInline.test.ts",
    "frontend/src/editor/internal/markdownBlocks.ts",
    "frontend/src/editor/internal/markdownBlocks.test.ts",
    "frontend/src/editor/index.ts",
    "frontend/src/editor/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "every_local_entry_of_gitlabs_corpus_renders_to_its_blocks",
      "proves": "Each of the 63 `local: true` corpus entries equals GitLab's reduced blocks after the `visible` normalisation; failures name the entry (`expect.soft`). Owns A1."
    },
    {
      "name": "every_other_entry_of_the_corpus_goes_to_gitlab",
      "proves": "Each of the 24 `local: false` entries returns null."
    },
    {
      "name": "each_trigger_sends_the_text_to_gitlab",
      "proves": "One or more texts per rule (C1–C5, T1–T7, S1–S9, S13–S15, K1, K3, N quote and emphasis 15 deep) plus every GITLAB_DRAWN_LANGUAGES fence return null. Owns A2."
    },
    {
      "name": "a_trigger_inside_code_stays_local",
      "proves": "C and T characters inside a code span, and a rust fence holding a tab, a 4-space line after a blank and references, still render locally."
    },
    {
      "name": "a_table_reads_start_whatever_its_alignment",
      "proves": "`:-`/`:-:`/`-:` columns give every cell `align: start`; head cells have `header: true`, body cells `false`."
    },
    {
      "name": "commonmark_flanking_refuses_what_yamts_allows",
      "proves": "`a**\"b\"**` is strong in yamt and plain text in commonMark; `**bold**.`, `(*it*)`, `(_it_)`, `snake_case_name`, `***both***`, `~~gone~~` parse the same in both modes. Owns A4."
    },
    {
      "name": "commonmark_flanking_reads_unicode_punctuation_and_white_space",
      "proves": "Curly quotes and an emoji count as punctuation by code point, not surrogate half; a no-break space counts as white space; `_` follows §6.2 rules 2 and 4."
    },
    {
      "name": "fenced_lines_are_the_insides_of_each_fence",
      "proves": "Covers closed, unclosed, `~~~` (holding a backtick line), indented-2 and two fences; a backtick info holding a backtick is no fence; a quoted fence is not counted."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run --project node src/editor/internal/{localPreview,markdownInline,markdownBlocks}.test.ts",
      "observed": "Test Files  3 passed (3); Tests  34 passed (34). Corpus (jq): 63 local:true entries all rendered to GitLab's blocks, 24 local:false entries all refused (null)."
    },
    {
      "command": "Failing path: drop `@` from T1",
      "observed": "× every_other_entry_of_the_corpus_goes_to_gitlab — AssertionError: mention: expected { blocks: [ { …(2) } ] } to be null; × each_trigger_sends_the_text_to_gitlab — AssertionError: T1 mention: … to be null (and T1 e-mail). Undone."
    },
    {
      "command": "Failing path: parseInline(source, \"yamt\") in localPreview",
      "observed": "× every_local_entry_of_gitlabs_corpus_renders_to_its_blocks — AssertionError: emphasis_punct: expected { blocks: [ { …(2) } ] } to deeply equal { blocks: [ { …(2) } ] }. Undone."
    },
    {
      "command": "Failing path: drop the code exemption (code text = \"\")",
      "observed": "× every_local_entry… — AssertionError: code_hides_refs: expected null to deeply equal {…}; × a_trigger_inside_code_stays_local — expected null to deeply equal {…}. Undone."
    },
    {
      "command": "Failing path: cells align \"center\"",
      "observed": "× every_local_entry… — AssertionError: table_align: expected {…table…} to deeply equal {…} (also table, table_inline, table_short_row, table_after_paragraph); × a_table_reads_start_whatever_its_alignment. Undone."
    },
    {
      "command": "Failing path: fencedLines returns empty (loop never runs)",
      "observed": "× a_trigger_inside_code_stays_local — AssertionError: expected null to deeply equal { blocks: [ { kind: 'code', …(2) } ] }. Undone."
    },
    {
      "command": "pnpm -C frontend typecheck && pnpm -C frontend lint && pnpm -C frontend fmt:check",
      "observed": "vue-tsc -b: no output (clean); oxlint --type-aware && eslint: no findings, exit 0; oxfmt --check: All matched files use the correct format."
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  300 passed (300); Tests  4484 passed (4484). Includes fences.test.ts and palette.test.ts."
    },
    {
      "command": "pnpm -C frontend unused",
      "observed": "Unused exports (1): localPreview  src/editor/index.ts:14:10. Expected: its caller arrives with mr-fast-preview-panel."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → \"mutants: no Rust changes since HEAD / mutants: no TypeScript changes since HEAD\" (editor/ is excluded; the five failing paths above stand in)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Code exemption kept: the fixture marks code_hides_refs and fence_hides_refs `local: true`. S12 left off: table_after_paragraph is `local: true`, so it has no implementation and no trigger case.",
    "Added exports in markdownBlocks.ts so localPreview reuses the parser's own rules instead of copying them: `FENCE`, `LINE_BREAK`, `indentOf`, `isBlank`. `fence` is split into a private `fenceAt` (opener, indent, info, closing index), which both `fence` and `fencedLines` use.",
    "`GITLAB_DRAWN_LANGUAGES` is exported from localPreview.ts so `each_trigger…` can iterate it; editor/index.ts exports only `localPreview`.",
    "Contract doc comments say `plan §2 row 186` / `plan §2 row 112` instead of `#186` / `#112`. Reason: scripts/palette.test.ts flagged `#186` and `#112` as colour literals, and other .ts files cite plan rows the same way. Signatures are unchanged.",
    "N rule depth: a block or inline nested inside 15 containers returns null (top level is depth 0). A quote 15 deep and emphasis 15 deep are both tested.",
    "Failing path 'map aligned cells to center' was run by mapping every cell to center; table_align and a_table_reads_start… both failed as the brief expects.",
    "Extra test commonmark_flanking_reads_unicode_punctuation_and_white_space, beyond the named acceptance tests."
  ],
  "open_risks": [
    {
      "location": "frontend/src/editor/index.ts:14",
      "risk": "knip reports `localPreview` as an unused export until mr-fast-preview-panel calls it, so `pnpm -C frontend unused` fails on this slice alone."
    },
    {
      "location": "frontend/src/editor/internal/localPreview.ts:110-120",
      "risk": "S rules read raw lines, so some texts go to GitLab even though yamt could draw them: a 4-column list continuation after a blank line, or a closing-fence line before a `---`. Erring toward GitLab is the brief's doubt rule."
    },
    {
      "location": "frontend/src/editor/internal/localPreview.ts:180-185",
      "risk": "K1 keeps any lower-case info that `languageNamed` knows (e.g. `js`). GitLab's data-canonical-lang may change some aliases; only `rust` and `ts` are in the corpus."
    }
  ]
}
