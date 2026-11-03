# MrPeopleRustR1

Agent output (`agent://MrPeopleRustR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleRustR1.md), collected 2026-11-03T22:52:27.107Z.

{
  "summary": "Fixed #2253, #2256, #2257 and #2259. tests/people.rs now checks the whole glab argv for the change cases. The row types moved to crates/merge-requests/src/row.rs and the list code to src-tauri/src/merge_requests/list.rs; both are re-exported, so callers and bindings are unchanged. lib.rs is 227 lines, merge_requests.rs 389. NO_MERGE_REQUEST now lives in page.rs. The Pictures::offer doc names all four ways pictures are offered. Bindings are byte-identical.",
  "files_changed": [
    "crates/merge-requests/src/lib.rs",
    "crates/merge-requests/src/row.rs",
    "crates/merge-requests/src/page.rs",
    "crates/merge-requests/src/rerequest.rs",
    "crates/merge-requests/src/people_change.rs",
    "crates/merge-requests/tests/people.rs",
    "crates/merge-requests/AGENTS.md",
    "src-tauri/src/merge_requests.rs",
    "src-tauri/src/merge_requests/list.rs",
    "src-tauri/src/merge_requests/pictures.rs"
  ],
  "tests_added": [
    {
      "name": "people::adding_an_assignee_sends_one_append_with_the_exact_body (amended)",
      "proves": "The whole argv is exactly auth status, api projects/:fullpath, api graphql --input -. A read before the write, REST included, fails the test."
    },
    {
      "name": "people::removing_sends_one_remove_of_one_username (amended)",
      "proves": "Two changes log CHANGE_ARGV twice and nothing else. Nothing is read before either write."
    }
  ],
  "smoke_evidence": [
    {
      "command": "wc -l crates/merge-requests/src/lib.rs src-tauri/src/merge_requests.rs",
      "observed": "227 crates/merge-requests/src/lib.rs\n389 src-tauri/src/merge_requests.rs (was 410 / 446). New: row.rs 192, merge_requests/list.rs 69."
    },
    {
      "command": "<hermetic_git> cargo nextest run -p yamt-merge-requests",
      "observed": "Summary [   2.146s] 189 tests run: 189 passed, 1 skipped"
    },
    {
      "command": "<hermetic_git> cargo nextest run -p yamt-app merge_requests",
      "observed": "Summary [   6.147s] 27 tests run: 27 passed, 197 skipped"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 39.72s (no warnings)"
    },
    {
      "command": "cargo fmt --all --check && just arch-check",
      "observed": "fmt-ok; arch-check: ok"
    },
    {
      "command": "sh -n scripts/fake-glab/glab",
      "observed": "no output (sh-ok)"
    },
    {
      "command": "cargo run -p yamt-app --features bindings --bin export-bindings -- target/b.ts && diff frontend/src/ipc/bindings.ts target/b.ts",
      "observed": "no diff output (bindings-identical)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 6 mutants tested in 2m: 5 caught, 1 unviable; no TypeScript changes",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Docs outside this slice's files need the docs keeper. In .omp/skills/project-map/tree.md, the merge-requests row still lists CiStatus, FailedJob, Pipeline, ChangeSize, Readiness, BlockedReason, MergeRequestRow, MergeRequestPage and CheckedRow under `lib`; they now live in `row.rs`.",
    "tree.md's src-tauri merge_requests row and src-tauri/AGENTS.md should name merge_requests/list.rs (ListMessage, row_pages, forward_page, send, list). docs/architecture.md and state.md still name forward_page/list without a file; the names are unchanged.",
    "crates/merge-requests/AGENTS.md (owned) was updated: lib.rs/row.rs split, NO_MERGE_REQUEST in page.rs. The tests/people.rs paragraph (line 7) was left as is: its 'nothing else asked' still holds."
  ],
  "open_risks": [
    {
      "location": "src-tauri/src/merge_requests.rs:1-389",
      "risk": "Only 11 lines below RS6's 400. The next command will likely push it over again. resolve/continue/wait_for_window_claim could move to their own submodule then."
    }
  ]
}
