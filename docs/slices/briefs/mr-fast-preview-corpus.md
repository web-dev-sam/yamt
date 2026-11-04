# Slice mr-fast-preview-corpus — GitLab's preview answers recorded, reduced and pinned

Feature: an instant comment preview when yamt can render it. Sources:

- Request `docs/slices/request-mr-fast-preview.md`: "To be measured" A (the corpus "recorded as a test fixture") and
  the acceptance "every A1 construct of the corpus renders locally to the same blocks GitLab's recorded answer gives".
- Design `docs/slices/briefs/mr-fast-preview-design.md` option A, §1.1 (the verdict table), §1.2 (the rules each
  verdict rests on).
- The orchestrator's recording: `.omp/run/notes/PlanFastPreviewCorpus.json` (62 entries, `{ text, html }` by name) and
  `.omp/run/notes/PlanFastPreviewCorpus.md`.

Runs in round 1, beside `mr-fast-preview-remembered`. `mr-fast-preview-local` starts once this is committed: its tests
read your fixture.

## Target

**Owned:**

- `frontend/fixtures/markdown/gitlab-preview.json` (new)
- `crates/merge-requests/src/description/tests.rs` — one line only: `mod corpus;`
- `crates/merge-requests/src/description/tests/corpus.rs` (new)

**Read-only:** everything else.

- `crates/merge-requests/src/**` other than the two files above: `mr-fast-preview-remembered`'s (it owns
  `description.rs`); the reducer (`description/html.rs`, `element.rs`) is used as it is.
- `frontend/src/**`: `mr-fast-preview-local` writes the TypeScript side.
- `.omp/run/notes/PlanFastPreviewCorpus.*`: the source, never edited.
- `docs/**`: lines in `deviations_from_brief`.

**Non-goals:** changing the reducer (a cell's `align` attribute stays unread, design §4.1); deciding a verdict the
table below does not give; any TypeScript.

## Contract

Fixed; you may add, never change.

**The fixture** `frontend/fixtures/markdown/gitlab-preview.json`, formatted by `pnpm -C frontend fmt` (oxfmt checks
`frontend/fixtures/**` except golden, showcase, compare, `frontend/.oxfmtrc.json:6-13`):

```jsonc
{
  // how, where and when: the POST, its body, the project, the date(s)
  "recorded": "glab api --method POST markdown --input - with {text, gfm: true, project: \"samubr/glab-yamt-playground\"} on gitlab.com, 2026-11-04",
  "entries": [
    {
      "name": "paragraph",          // unique, snake_case; the 62 recorded names unchanged, then the extras below
      "text": "Looks good to me.",  // what was sent
      "html": "<p …>…</p>",         // GitLab's answer's `html`, verbatim
      "local": true,                // the design's verdict: true = yamt renders it itself, false = GitLab must
      "blocks": [ … ]               // `described(html, None).description.blocks` as serde serialises them
    }
  ]
}
```

Entries in this order: the 62 of `PlanFastPreviewCorpus.json` in its key order, then the extras in the table's order.

**Verdicts for the 62 recorded entries** (design §1.1–§1.2): `local: false` for exactly `ampersand`, `dollar_word`,
`emoji`, `entity`, `fenced_mermaid`, `hard_break_backslash`, `hex_short`, `html`, `indented_code`, `link`,
`math_inline`, `mention`, `ordered_paren`, `ref_issue`, `setext`, `task`, `unicode`, `url` (18); `local: true` for the
other 44.

**Extras to record**, in this order: send each `text` exactly as this JSON decodes it; `local` is its verdict (`"¹"` and
`"²"` are decided by the answer, below).

````json
[
  {
    "name": "code_hides_refs",
    "text": "use `@samubr`, `#1`, `:thumbsup:`, `😀`, `Vec<u8>`, `{x}`, `$5` and `a\\b` here",
    "local": "¹"
  },
  {
    "name": "fence_hides_refs",
    "text": "```rust\nlet who = \"@samubr\"; // #1 :x: [y](z) <b> {c} $d \\n\n```",
    "local": "¹"
  },
  { "name": "heading_closing_hashes", "text": "## Title ##", "local": true },
  { "name": "heading_then_text", "text": "## Title\ntext right after", "local": true },
  { "name": "mixed_bullets", "text": "- a\n* b", "local": false },
  { "name": "table_short_row", "text": "| a | b |\n| - | - |\n| 1 |", "local": true },
  {
    "name": "table_after_paragraph",
    "text": "text\n| a | b |\n| - | - |\n| 1 | 2 |",
    "local": "²"
  },
  { "name": "quote_lazy", "text": "> a\nb", "local": true },
  { "name": "quote_two_paragraphs", "text": "> a\n>\n> b", "local": true },
  { "name": "list_lazy", "text": "- a\ncontinued\n- b", "local": true },
  { "name": "nested_ordered", "text": "- a\n  1. b\n  2. c", "local": true },
  { "name": "ordered_para_items", "text": "1. a\n\n   para\n2. b", "local": true },
  { "name": "ordered_zero_start", "text": "010. ten\n011. eleven", "local": true },
  { "name": "emphasis_punct", "text": "**bold**. (*it*) and a**\"b\"**", "local": true },
  { "name": "emphasis_nested", "text": "*a **b** c* and **x*y*z**", "local": true },
  { "name": "fence_blank_edges", "text": "```\n\na\n\n```", "local": false },
  { "name": "unicode_plain", "text": "Schöne Grüße — “quotes”", "local": true },
  { "name": "ampersand_no_angle", "text": "a & b > c \"q\" 'x'", "local": true },
  { "name": "hard_break_three_spaces", "text": "a   \nb", "local": true },
  { "name": "rule_after_list", "text": "- a\n\n---\n\nb", "local": true },
  { "name": "star_rule", "text": "a\n\n* * *\n\nb", "local": true },
  { "name": "strike_single_tilde", "text": "a ~(x)~ b", "local": false },
  { "name": "code_language_upper", "text": "```TS\nconst x = 1;\n```", "local": false },
  { "name": "fence_info_words", "text": "```rust ignore\nlet a = 1;\n```", "local": false },
  { "name": "quick_action", "text": "/label ~bug", "local": false }
]
````

¹ `true` unless GitLab's `html` holds an `<a`, a `<gl-emoji` or a `js-render-math` element inside a `<code>` or `<pre>`;
then `false`, and `open_risks` says so first (the local slice then counts code too, design §1.2 "Code is exempt").
² `true` when the reduced `blocks` are exactly a `paragraph` holding the text `text` followed by a `table` (head `a`,
`b`; body `1`, `2`); else `false` (the local slice then adds rule S12). Say which in `smoke_evidence`.

```rust
// crates/merge-requests/src/description/tests/corpus.rs (a child of `description::tests`; reaches
// `super::super::html::described`)

/// The fixture, read once per test with `include_str!("../../../../../frontend/fixtures/markdown/gitlab-preview.json")`
/// and `serde_json`; `blocks` compared as `serde_json::Value`.
#[derive(Deserialize)] struct Corpus { recorded: String, entries: Vec<Entry> }
#[derive(Deserialize)] struct Entry { name: String, text: String, html: String, local: bool, blocks: serde_json::Value }
```

Tests (names fixed):

- `every_recorded_answer_reduces_to_its_blocks` — for every entry, `serde_json::to_value(described(&entry.html,
  None).description.blocks)` equals `entry.blocks`; a failure names the entry. Pins the reducer on GitLab's real HTML
  (RK66's reducer, request A3).
- `a_local_entry_holds_no_link_image_details_or_task_box` — no `local` entry's blocks hold a `link`, an `image`, a
  `details` block or an item whose `task` is not `none`, at any depth (the local side builds none of them).
- `the_corpus_holds_each_name_once_and_every_recorded_name` — names unique; the 62 recorded names and the 25 extras
  present; `recorded` not empty; every `text` not blank.

## Change

1. **Record the extras** on gitlab.com (`glab` is logged in on this machine; nothing is written to GitLab: a preview
   counts nothing, RK54). One text at a time, the body as `crates/merge-requests/src/query/rest.rs:90`
   `markdown_body` builds it:

   ```sh
   jq -n --arg text "$TEXT" '{text: $text, gfm: true, project: "samubr/glab-yamt-playground"}' \
     | glab api --method POST markdown --input - | jq -r .html
   ```

   Keep the loop in your scratch folder (never committed). Paste the command and the first line of each answer into
   `smoke_evidence`.

2. **Build the fixture**: the 62 recorded entries copied verbatim (`text`, `html`) with the verdicts above, then the
   extras with their answers and verdicts (¹, ² decided from the answers). Fill `blocks` from the reducer itself: write
   `corpus.rs`, run it once with an empty `blocks`, take the reduced value from the failure output (or a throwaway
   print you delete), paste it, run again. Never hand-write `blocks`.
3. `pnpm -C frontend fmt` (the fixture only changes formatting), `pnpm -C frontend fmt:check`.
4. `mod corpus;` in `description/tests.rs`; the three tests.

## Acceptance

**Tests** (`cargo nextest run -p yamt-merge-requests corpus`, hermetic prefix as `just test`): the three above green;
the crate's other tests green.

**Commands:** `cargo fmt --all --check`; `cargo clippy --workspace --all-targets -- -D warnings`; `pnpm -C frontend
fmt:check`; `just mutants HEAD` (your changed lines are test code and data: report "no mutants" if so).

**Smoke:** the recording itself — for each extra, the command and GitLab's first `html` line; the verdicts ¹ and ²
with the evidence that decided them; the count of entries (87) and of `local: true` entries.

## Skills

`skill://rust-conventions`, `skill://verification`, `skill://risk-register` (RK66, RK71).
