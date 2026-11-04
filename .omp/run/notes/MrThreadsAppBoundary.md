# MrThreadsAppBoundary

Agent output (`agent://MrThreadsAppBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsAppBoundary.md), collected 2026-11-04T14:36:43.606Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all touched files are in Owned. tests/description.rs unchanged (new `size` field misses its JSON), accepted. bindings.ts is the orchestrator's (PM4).",
    "Contract: five commands with the brief's signatures, registered after `links::read_links` (commands.rs:90-94). No GitLab project gives `Failed { NO_PROJECT }` for all three reply types (thread.rs:18,36,52).",
    "RK41/RK53 order: thread_reply offers pages, uploads (`offer_described`), then pictures (`Pictures::offer`), one lock at a time, before the reply, as description.rs and people.rs:21. Writes offer nothing.",
    "Growth: thread.rs has one job, mirrors description.rs/links.rs; `written` has 3 callers and matches `rerequested` naming. No new state, no new edges (PM1).",
    "Docs: AGENTS.md names the five commands, offers and one-write rule. MergeRequestState doc names thread and preview pages. Hand-off of architecture §4, ipc-contract, tree.md accepted.",
    "Deviation reviewed: `#[path]` and the `std::thread` re-imports come from the module name `thread` (finding 1). Scratch-dir open risk accepted (bash-guard blocked rm)."
  ],
  "findings": [
    {
      "file": "src-tauri/src/merge_requests/tests.rs",
      "line": 142,
      "severity": "should",
      "rule_id": "principles §2",
      "problem": "Module `thread` clashes with `std::thread`. That forced the repo's first `#[path]` (file thread.rs, module thread_commands, mismatch in 7 test-name strings), a tests.rs:3 import that only feeds resolve.rs's glob, and a bare `sleep` at merge_requests.rs:4. Future glob users hit the same trap.",
      "fix": "Rename the shell module and test to `discussion_thread.rs`, as the crate already names it (bindings unchanged), with a plain `mod`, and restore `use std::thread;` in merge_requests.rs. The docs keeper updates the RK41/RK53 detector path."
    },
    {
      "file": "src-tauri/src/merge_requests/tests/thread.rs",
      "line": 80,
      "severity": "should",
      "problem": "`opens_each` is a third copy of the open-and-check-the-opener-log loop and its macOS comment, already inline in tests/description.rs:79-84 and tests/links.rs:42-47. Every new page-offering command's test will copy it again.",
      "fix": "Move `opens_each` (with its macOS guard) into `through_glab` beside `log_after`, and call it from thread.rs, description.rs and links.rs."
    },
    {
      "file": ".omp/skills/project-map/state.md",
      "line": 65,
      "severity": "should",
      "problem": "Rows 65 (`pages`) and 67 (`pictures.offered`) list every writer but miss `thread_reply`/`preview_reply` (via `offer_described`) and thread_reply's direct `Pictures::offer`. Neither the deviations nor design §3.3 hands these rows to the docs keeper, so \"what can change X?\" gets a wrong answer.",
      "fix": "Add a deviations line for the docs keeper: rows 65 and 67 gain `thread_reply` and `preview_reply` (`merge_requests/thread.rs`) as writers, each before its reply is returned."
    }
  ]
}
