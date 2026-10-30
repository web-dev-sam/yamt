# MrOpenCommandsBoundary

Agent output (`agent://MrOpenCommandsBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrOpenCommandsBoundary.md), collected 2026-10-30T14:48:12.676Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: all files in Owned, plus granted review.rs, Cargo.lock, bindings.ts. Edges: src-tauri→merge-requests, merge-requests→yamt-range, yamt-review dev-dep only (arch-check.sh:72-83)",
    "Flags: Glab re-export copies yamt_review's (lib.rs:26), keeps src-tauri off gitio (PM1), accepted. graphql_data<D> has two uses, page Data and open DetailsData (RS2), one first-error rule: accepted",
    "State: job_pages has one writer (forward_page), filled before send; managed once per window (window.rs compare, range.rs:61); range_dir uses shared range_folder",
    "Deviations accepted: first stderr line (row 132 is silent), timeout argument, &Path manage, bare-repo plumbing commit, ':' refusal (cites git-fetch(1)), scenarios 14-16. No plan #128-#135 contradiction",
    "Comments: ssh(1), git-fetch(1), git-config(1), MS Learn, setpgid(2), proc(5), tauri channel.rs are CP1 external facts; PoisonError/tauri-macros patterns match ai/review/compare.rs",
    "Contract: bindings.ts:70-77 has the four commands, ListMessage, kind-tagged camelCase; fake glab already routes iid= to graphql-merge-request-<n> (fake-glab/glab:124-130)"
  ],
  "findings": [
    {
      "file": "src-tauri/src/range_window.rs",
      "line": 20,
      "severity": "block",
      "rule_id": "RS13",
      "problem": "The child's argv repeats args.rs's CLI spelling (`--diff=` RANGE_FLAG, `--repo`) and no test checks the copy: a flag rename (#101 already renamed `--raw`) leaves open_merge_request answering `opened` while the child exits with a usage error.",
      "fix": "Extract a pure `fn arguments(range: &RangeToOpen) -> Vec<OsString>` used by `start`, and unit-test that `crate::args::parse(arguments(&range))` gives `Invocation::Range { spec, repo: root, ai: Ai::Off }`."
    },
    {
      "file": "crates/merge-requests/tests/open.rs",
      "line": 31,
      "severity": "should",
      "problem": "`Fake` and `in_this_repository` copy tests/list.rs:28-61 verbatim, so a glab.env or log layout change is made twice in one crate. Sharing is already done in-repo (crates/agent/tests/common/mod.rs), so 'share no module' is not a constraint.",
      "fix": "Move both into `crates/merge-requests/tests/fake_glab/mod.rs` (named for what it owns, RS12) and `mod fake_glab;` from list.rs and open.rs."
    },
    {
      "file": "src-tauri/src/window.rs",
      "line": 104,
      "severity": "should",
      "problem": "The compare window's start folder is decided in window.rs (its own START_FOLDER \".\" plus repo_from_start_dir). Merge and range resolve theirs in lib.rs::run from args.rs CURRENT_DIR, so 'where does a window's folder come from' has two answers.",
      "fix": "Resolve it at dispatch: in lib.rs's `Invocation::Compare` arm apply `appimage::repo_from_start_dir` and pass the folder to `window::run_compare(folder)`; drop START_FOLDER and compare_start_folder."
    },
    {
      "file": "src-tauri/src/merge_requests/tests.rs",
      "line": 97,
      "severity": "nit",
      "problem": "The test helper `list(window)` shadows the production `list(state, glab, channel)` that `use super::*` imports, so a reader must work out which `list` each call means. Nothing gets harder as the app grows.",
      "fix": "Rename the helper `listed_messages`."
    },
    {
      "file": "src-tauri/src/range_window.rs",
      "line": 99,
      "severity": "nit",
      "problem": "`outside_an_appimage_a_second_yamt_starts_from_this_binary` only asserts the cfg wrapper `running_appimage()` is None, repeating appimage.rs's `a_test_run_is_not_inside_an_appimage`, and its name claims more. Nothing gets harder as the app grows.",
      "fix": "Delete it; `program`'s unit test and appimage.rs's test cover both facts."
    }
  ]
}
