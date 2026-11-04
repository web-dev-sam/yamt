# MrFastPreviewCorpus

Agent output (`agent://MrFastPreviewCorpus`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewCorpus.md), collected 2026-11-04T21:38:10.498Z.

{
  "summary": "I added `frontend/fixtures/markdown/gitlab-preview.json` with 87 entries. The first 62 are copied verbatim from `PlanFastPreviewCorpus.json`. The other 25 extras were recorded on gitlab.com today. 63 entries are `local: true`. The reducer filled every `blocks` field, in serde's key order. `description/tests/corpus.rs` adds the three tests from the brief, and `tests.rs` gains `mod corpus;`. Verdicts: both ¹ entries are `true`, since no `<a`, `<gl-emoji` or `js-render-math` appears inside code/pre. ² is `true`.",
  "files_changed": [
    "frontend/fixtures/markdown/gitlab-preview.json",
    "crates/merge-requests/src/description/tests.rs",
    "crates/merge-requests/src/description/tests/corpus.rs"
  ],
  "tests_added": [
    {
      "name": "description::tests::corpus::every_recorded_answer_reduces_to_its_blocks",
      "proves": "For all 87 entries, described(html, None).description.blocks as a serde_json::Value equals the stored blocks. On mismatch the assert message names the entry. This pins the reducer on GitLab's real HTML."
    },
    {
      "name": "description::tests::corpus::a_local_entry_holds_no_link_image_details_or_task_box",
      "proves": "No local:true entry holds a link, image, details block or non-none task at any depth. I flipped link and task to local:true and it failed with left: [\"link\", \"task\"], then I restored the fixture."
    },
    {
      "name": "description::tests::corpus::the_corpus_holds_each_name_once_and_every_recorded_name",
      "proves": "The names are exactly the 62 recorded names in key order, then the 25 extras in the brief's order, each once. `recorded` and every `text` are not blank."
    }
  ],
  "smoke_evidence": [
    {
      "command": "per extra (`/tmp/fpc/record.sh`): `jq '.[$i] | {text: .text, gfm: true, project: \"samubr/glab-yamt-playground\"}' extras.json > body.json; glab api --method POST markdown --input - < body.json`",
      "observed": "This body is the same JSON as the brief's `jq -n --arg text`. First html lines: code_hides_refs: `<p data-sourcepos=\"1:1-1:80\" dir=\"auto\">use <code …>@samubr</code>, …`; fence_hides_refs: `<div class=\"gl-relative markdown-code-block js-markdown-code\"><pre … language-rust\" …>`; heading_closing_hashes / heading_then_text: `<h2 id=\"user-content-title\" …>Title<a href=\"#title\" … class=\"anchor\"></a></h2>`; mixed_bullets: `<ul data-sourcepos=\"1:1-1:3\" dir=\"auto\">`; table_short_row: `<table data-sourcepos=\"1:1-3:5\" dir=\"auto\">`"
    },
    {
      "command": "(same recording loop, continued)",
      "observed": "table_after_paragraph `<p data-sourcepos=\"1:1-1:4\" dir=\"auto\">text</p>`; quote_lazy `<blockquote data-sourcepos=\"1:1-2:1\" dir=\"auto\">`; quote_two_paragraphs `<blockquote data-sourcepos=\"1:1-3:3\" dir=\"auto\">`; list_lazy `<ul data-sourcepos=\"1:1-3:3\" dir=\"auto\">`; nested_ordered `<ul data-sourcepos=\"1:1-3:6\" dir=\"auto\">`; ordered_para_items `<ol data-sourcepos=\"1:1-4:4\" dir=\"auto\">`; ordered_zero_start `<ol data-sourcepos=\"1:1-2:11\" start=\"10\" dir=\"auto\">`"
    },
    {
      "command": "(same recording loop, continued)",
      "observed": "emphasis_punct `<p …><strong …>bold</strong>. (<em …>it</em>) and a**\"b\"**</p>`; emphasis_nested `<p …><em …>a <strong …>b</strong> c</em> and <strong …>x<em …>y</em>z</strong></p>`; fence_blank_edges `<div …><pre … language-plaintext\" …><code><span id=\"LC1\" class=\"line\" data-lang=\"plaintext\"></span>`; unicode_plain `<p …>Schöne Grüße — “quotes”</p>`; ampersand_no_angle `<p …>a &amp; b &gt; c \"q\" 'x'</p>`; hard_break_three_spaces `<p data-sourcepos=\"1:1-2:1\" dir=\"auto\">a<br data-sourcepos=\"1:3-1:5\">`"
    },
    {
      "command": "(same recording loop, continued)",
      "observed": "rule_after_list `<ul data-sourcepos=\"1:1-1:3\" dir=\"auto\">`; star_rule `<p data-sourcepos=\"1:1-1:1\" dir=\"auto\">a</p>`; strike_single_tilde `<p …>a <del …>(x)</del> b</p>`; code_language_upper `<div …><pre … data-canonical-lang=\"TS\" class=\"code highlight js-syntax-highlight language-plaintext\" …>`; fence_info_words `<div …><pre … data-canonical-lang=\"rust\" data-lang-params=\"ignore\" … language-rust\" …>`; quick_action `<p data-sourcepos=\"1:1-1:11\" dir=\"auto\">/label ~bug</p>`"
    },
    {
      "command": "verdict ¹: `jq -r '.[]|select(.html|test(\"<a |<a>|gl-emoji|js-render-math\"))|.name' answers.json` plus a read of both full answers",
      "observed": "Only heading_closing_hashes and heading_then_text match: their heading anchor `<a>` sits outside any code. In code_hides_refs every ref is plain text inside a `<code>`. In fence_hides_refs the `<pre>` holds only Rouge `<span>`s. So both ¹ entries are `local: true`."
    },
    {
      "command": "verdict ²: the reduced blocks of table_after_paragraph",
      "observed": "`[{\"kind\":\"paragraph\",\"inlines\":[{\"kind\":\"text\",\"text\":\"text\"}]},{\"kind\":\"table\",\"head\":[cells a,b header:true],\"body\":[cells 1,2]}]`. That is a paragraph holding `text` followed by a table with head a,b and body 1,2, so `local: true` and rule S12 is not needed."
    },
    {
      "command": "jq '(.entries|length), ([.entries[]|select(.local==true)]|length)' frontend/fixtures/markdown/gitlab-preview.json",
      "observed": "87, then 63. The 62 recorded entries split 44 true / 18 false (exactly the 18 the brief lists). The 25 extras split 19 true / 6 false."
    },
    {
      "command": "jq -S '[.entries[:62][]|{key:.name,value:{text,html}}]|from_entries' fixture | md5sum  vs  jq -S . PlanFastPreviewCorpus.json | md5sum",
      "observed": "6508afbbc92380d95308f675a8284aa8 for both: the 62 recorded entries are verbatim."
    },
    {
      "command": "env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-merge-requests",
      "observed": "PASS corpus::the_corpus_holds_each_name_once_and_every_recorded_name; PASS corpus::a_local_entry_holds_no_link_image_details_or_task_box; PASS corpus::every_recorded_answer_reduces_to_its_blocks; Summary 320 tests run: 320 passed, 1 skipped"
    },
    {
      "command": "cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "FMT-OK; `Finished dev profile` with no warnings. A first run flagged clippy::assert_is_empty; I changed it to `assert_ne!(corpus.recorded.trim(), \"\")`."
    },
    {
      "command": "pnpm -C frontend fmt && pnpm -C frontend fmt:check",
      "observed": "All matched files use the correct format. Finished in 1627ms on 822 files."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → `mutants: no Rust changes since HEAD` / `mutants: no TypeScript changes since HEAD` (my changed lines are test code and data, so there are no mutants)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "`tests.rs`: besides `mod corpus;` I added one blank line after it, so it does not run straight into `const BASE`. That makes the diff 2 added lines instead of 1.",
    "I built each extra's request body with `jq '.[$i] | {text, gfm: true, project: …}' extras.json` instead of `jq -n --arg text \"$TEXT\"`. It is the same JSON and keeps the exact text, including trailing newlines and backslashes.",
    "`blocks` comes from the reducer through two throwaway tests (since deleted). The first dump went through `serde_json::Value`, which sorts keys alphabetically. I then re-dumped with `serde_json::to_string` so the fixture keeps serde's field order. Both dumps give the same data (md5 of `jq -S` output is identical).",
    "Added a small `holds_remote_part(&Value)` walker in corpus.rs. It is needed for the any-depth check; the existing `keys_and_strings` helper in tests.rs collects keys and strings, not kind or task values."
  ],
  "open_risks": [
    {
      "location": "frontend/fixtures/markdown/gitlab-preview.json",
      "risk": "GitLab answers change over time (sourcepos, code-block wrappers, Rouge classes). A re-record could change html and blocks. The test only pins the reducer on this snapshot."
    },
    {
      "location": "crates/merge-requests/src/description/tests/corpus.rs:127",
      "risk": "The test checks `local` entries on their reduced blocks, so it can only see what the reducer keeps. A trigger the reducer drops, such as the gl-emoji wrapper or mermaid markup, is not caught here. Those entries are local:false by the brief's verdicts anyway."
    }
  ]
}
