# MrLinksRustR1

Agent output (`agent://MrLinksRustR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksRustR1.md), collected 2026-11-04T01:55:03.673Z.

{
  "summary": "`links/target.rs` now uses the same same-origin check as `description/address.rs`. `Server` holds a `url::Origin` parsed from `Project.web_origin` in `Server::of`, and `target_of` compares `url.origin() != server.origin`. A `web_url` with an upper-case host or an explicit `:443` now keeps every link. Line 1 of `crates/merge-requests/AGENTS.md` now lists `LinksReply` and reading links in project.rs's `From<NoProject>` and prelude lists, and the links lookup (`links_args`, `part_name`) in query.rs's list. The links paragraph states the Origin rule and names the new test.",
  "files_changed": [
    "crates/merge-requests/src/links/target.rs",
    "crates/merge-requests/src/links/tests.rs",
    "crates/merge-requests/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "links::tests::a_web_url_with_an_upper_case_host_or_port_443_keeps_every_link",
      "proves": "With a Server built from web_origin `https://GitLab.Example` or `https://gitlab.example:443`, every counted item address on `https://gitlab.example` still resolves to its Target."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo fmt -p yamt-merge-requests && cargo clippy -p yamt-merge-requests --all-targets -- -D warnings",
      "observed": "Checking yamt-merge-requests v0.6.7 … Finished `dev` profile [unoptimized + debuginfo] target(s) in 7.56s (no warnings)"
    },
    {
      "command": "cargo nextest run -p yamt-merge-requests",
      "observed": "Summary [   2.311s] 267 tests run: 267 passed, 1 skipped"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 5 mutants to test; 5 mutants tested in 31s: 3 caught, 2 unviable; no TypeScript changes since HEAD",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Picked the stored `url::Origin` in `Server`, not a helper shared with address.rs: it adds no new function and the comparison reads the same as address.rs:128.",
    "The new test was not run against the old code (that would mean reverting the field type). It fails there [INFERENCE]: the old check compared the page's serialised origin `https://gitlab.example` with the raw string `https://GitLab.Example` or `https://gitlab.example:443`, so the two never matched.",
    "AGENTS.md query.rs list: besides `links_args` I named `part_name` (the part-alias helper links_args and lookup.rs share). I left alone other entries that list was already missing from earlier slices (description_args, discussions_args), because they are outside the links slice."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/links/target.rs:76",
      "risk": "If `web_origin` parses but is not a tuple origin, `origin()` is opaque and never equals a page's origin, so nothing would be listed. Today `web_origin` is always built as `https://<authority>`, so this cannot happen."
    }
  ]
}
