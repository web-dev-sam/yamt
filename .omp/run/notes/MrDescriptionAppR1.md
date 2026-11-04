# MrDescriptionAppR1

Agent output (`agent://MrDescriptionAppR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionAppR1.md), collected 2026-11-04T00:33:16.230Z.

{
  "summary": "`description_reply` now records what it offers only through a new `offer_described`, which sits next to `offer` in `merge_requests.rs`. It takes the description's pages, then its uploads, and never holds both locks at once. `is_picture_name` now calls the crate's `UploadKey::is_key`, and the shell's `UPLOAD_KEY_PREFIX` is deleted. `asked`/`is_not_found` now live once in `tests.rs`. `run_with_fakes_in` takes a scenario folder by path. All 210 yamt-app tests pass against the scenario's move to gitlab.com (#2288 included).",
  "files_changed": [
    "src-tauri/src/merge_requests.rs",
    "src-tauri/src/merge_requests/description.rs",
    "src-tauri/src/merge_requests/pictures.rs",
    "src-tauri/src/merge_requests/tests.rs",
    "src-tauri/src/merge_requests/tests/description.rs",
    "src-tauri/src/merge_requests/tests/picture_scheme.rs"
  ],
  "tests_added": [
    {
      "name": "(none new) description::a_described_page_is_offered_before_the_reply",
      "proves": "Updated for #2288: ISSUE_PAGE is now https://gitlab.com/taskboard/taskboard/-/issues/12, the page the scenario now resolves `#12` to."
    },
    {
      "name": "(none new) description::an_upload_the_api_does_not_know_is_served_from_its_web_path",
      "proves": "Updated for #2288: the web-path argv is now `api https://gitlab.com/-/project/7/uploads/<B>/old.png`."
    },
    {
      "name": "(none new) picture_scheme::an_avatar_and_an_upload_share_the_four_fetches_at_once",
      "proves": "Updated for #2288: the temp scenario links mr-description's gitlab.com project.json (id 7) so uploads are offered, and it runs through run_with_fakes_in(&Path)."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo nextest run -p yamt-app --no-fail-fast",
      "observed": "Summary [  11.110s] 210 tests run: 210 passed, 32 skipped"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings; cargo fmt --all --check; just arch-check",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 35.00s / fmt-ok / arch-check: ok"
    },
    {
      "command": "cargo run -q -p yamt-app --features bindings --bin export-bindings -- target/bindings-r1.ts && diff -u frontend/src/ipc/bindings.ts target/bindings-r1.ts && echo bindings-identical",
      "observed": "bindings-identical"
    },
    {
      "command": "just mutants HEAD",
      "observed": "Found 5 mutants to test; ok Unmutated baseline in 85s build + 12s test; 5 mutants tested in 3m: 4 caught, 1 unviable; mutants: no TypeScript changes since HEAD"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 5 mutants: 4 caught, 1 unviable, 0 missed",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "`asked`/`is_not_found` (with their `Response`/`StatusCode`/`picture_answer` imports) went into tests.rs's `#[cfg(unix)] mod through_glab` as pub(super), next to `open`/`opened_log`, not at the top level next to `invoke`. Every module that uses them is cfg(unix), so at the top level they would be dead code on a non-unix build. tests.rs is now 422 lines (it was 408 before this round).",
    "merge_requests.rs is now 396 lines (RS6: 400) after `offer_described` and the import line.",
    "Docs keeper: src-tauri/AGENTS.md and project-map state.md say `offer` is the one writer path of `pages`. They should also name `offer_described` (description.rs: pages, then uploads through `Pictures::offer_uploads`). These files are not in Owned, so I left them."
  ],
  "open_risks": [
    {
      "location": "src-tauri/src/merge_requests.rs:104-108",
      "risk": "`offer` and `offer_described` are two siblings that follow the same lock-one-then-the-other rule. A third offering shape would add a third sibling unless `offer` is widened."
    }
  ]
}
