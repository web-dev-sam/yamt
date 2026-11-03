# MrDescriptionDesign

Agent output (`agent://MrDescriptionDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionDesign.md), collected 2026-11-03T23:15:08.357Z.

{
  "options": [
    {
      "name": "A: GitLab's descriptionHtml reduced in Rust to a typed tree",
      "summary": "read_description asks descriptionHtml (10/200 measured). dom_query parses it; an allow-list walk builds Description blocks and inlines. Every http(s) link becomes a WebPage offered into the opener's list. Uploads become upload~<secret> keys, fetched with the login (REST, then the web path). Other https images load in the webview (CSP img-src https:). The window renders the tree by interpolation only: no href, no v-html.",
      "visions": [
        3,
        4,
        2,
        1
      ],
      "cost": "Two direct crates already compiled into the app (dom_query 0.28 via tauri-utils/wry, url 2.5 via tauri). Five slices; three glab runs per open; list +2 complexity (measured 12→14)."
    },
    {
      "name": "B: webview DOMParser parses the HTML, the window's core reduces it",
      "summary": "Rust returns the raw HTML. One ui file turns it into nodes with DOMParser, and the TS core builds the tree. New commands open any http(s) and fetch any upload path the window names.",
      "visions": [
        5,
        1
      ],
      "cost": "The adapter can't run in node tests or mutants (vite.config.ts:31-49). Rust no longer knows what GitLab listed, so RK41 and RK53 weaken to pattern checks. HTML strings in Vue state."
    },
    {
      "name": "C: raw description through yamt's own Markdown, extended",
      "summary": "Extend editor/markdownBlocks.ts with task lists, details and an HTML subset; resolve references with a second query (workItemsByReference, 16.7+) or leave them as text.",
      "visions": [
        5
      ],
      "cost": "Fails rule 3: labels, mentions, commits and (merged) suffixes are not as GitLab makes them; no reference links before 16.7. A second HTML parser anyway; about twice A's code."
    }
  ],
  "recommendation": "Option A. GitLab renders and Rust reduces to typed sums, so no HTML or attribute crosses the IPC (vision 3/4). The opener and picture scheme keep their allow-lists because Rust offers exactly the links and uploads GitLab answered. The tests run in nextest and mutants. The CSP stays a second wall: only img-src gains https:. request-mr-links reuses fetch_description. Cost: dom_query and url as direct deps (no new code built), the empty check at +2 list complexity and about 3 KB per row, three glab runs per open.",
  "design_doc": "docs/slices/briefs/mr-description-design.md",
  "briefs_written": [
    "docs/slices/briefs/mr-description-rust.md",
    "docs/slices/briefs/mr-description-look.md",
    "docs/slices/briefs/mr-description-app.md",
    "docs/slices/briefs/mr-description-state.md",
    "docs/slices/briefs/mr-description-page.md",
    "docs/slices/briefs/mr-description-verify.md"
  ],
  "slice_graph": "Before wave 1, the orchestrator adds dom_query/url to the root and crate Cargo.toml and refreshes the lock. Wave 1: rust (crate, fake glab, scenario) beside look (MarkdownView.showCode, useMarkdownCode, vue/no-v-html). Wave 2: app (needs rust). Then the orchestrator runs just bindings. Wave 3: state (needs app and bindings; first fixes the hasDescription literals). Wave 4: page (needs state and look; wires the window). Wave 5: docs keeper beside the verify smoke; verify's final pass after docs. Then the owner check.",
  "open_questions": []
}
