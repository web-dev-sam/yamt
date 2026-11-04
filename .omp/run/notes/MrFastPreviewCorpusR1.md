# MrFastPreviewCorpusR1

Agent output (`agent://MrFastPreviewCorpusR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewCorpusR1.md), collected 2026-11-04T21:51:25.828Z.

{
  "summary": "Finding 2431 is fixed. A new test reads the raw recorded `html` of every `local: true` corpus entry. It fails, naming the entry and the marker found, when that html holds `<gl-emoji`, `js-render-math`, `js-render-mermaid`, `data-reference-type`, or an `<a ` tag without `class=\"anchor\"`. The checking is done by a helper, `first_remote_markup`, in the same file.",
  "files_changed": [
    "crates/merge-requests/src/description/tests/corpus.rs"
  ],
  "tests_added": [
    {
      "name": "description::tests::corpus::a_local_entry_html_holds_no_emoji_math_diagram_reference_or_link",
      "proves": "No local entry's raw GitLab html holds an emoji, math, mermaid, a reference, or a link other than a heading anchor. The failure lists (entry name, marker) pairs."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo nextest run -p yamt-merge-requests a_local_entry_html  (throwaway: filter `entry.local || entry.name == \"mention\"`)",
      "observed": "panicked at corpus.rs:188:5 … left: [(\"mention\", \"data-reference-type\")] right: [] — 0 passed, 1 failed"
    },
    {
      "command": "cargo nextest run -p yamt-merge-requests a_local_entry_html  (throwaway: every entry treated as local)",
      "observed": "left: [(\"fenced_mermaid\", \"js-render-mermaid\"), (\"unicode\", \"<gl-emoji\"), (\"mention\", \"data-reference-type\"), (\"emoji\", \"<gl-emoji\"), (\"url\", \"<a\"), (\"link\", \"<a\"), (\"math_inline\", \"js-render-math\")] — heading anchors on local entries (setext etc.) not flagged"
    },
    {
      "command": "cargo fmt -p yamt-merge-requests --check && cargo clippy -p yamt-merge-requests --all-targets -- -D warnings && cargo nextest run -p yamt-merge-requests (filter restored)",
      "observed": "fmt silent; clippy `Finished dev profile` with no warnings; `Summary [2.417s] 321 tests run: 321 passed, 1 skipped`"
    },
    {
      "command": "just mutants HEAD",
      "observed": "mutants: no Rust changes since HEAD / mutants: no TypeScript changes since HEAD (the change is test-only code, so there are no mutants to run)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → \"no Rust changes since HEAD\": the only change is #[cfg(test)] code, which cargo-mutants does not mutate. 0 mutants.",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The throwaway flip went into the test's filter in corpus.rs (`entry.local || entry.name == \"mention\"`), not into the fixture JSON. The fixture is outside Owned. The filter was restored afterwards."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/description/tests/corpus.rs:163",
      "risk": "`ref_issue` (`see #12`) was recorded unlinked, so its html holds no marker. Flipping it to local would pass this test. Only a re-record with a real linked issue would let the html check catch it."
    },
    {
      "location": "crates/merge-requests/src/description/tests/corpus.rs:172",
      "risk": "Links are found by the literal text `<a ` (with a space). A bare `<a>` with no attributes would not be caught. GitLab's sanitizer always emits attributes on links [INFERENCE]."
    }
  ]
}
