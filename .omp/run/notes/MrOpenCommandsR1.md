# MrOpenCommandsR1

Agent output (`agent://MrOpenCommandsR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrOpenCommandsR1.md), collected 2026-10-30T15:05:18.890Z.

{
  "summary": "Fix round 1 is in. The second window's argv comes from a pure `range_window::arguments`, tested by parsing it back with `args::parse`. The two integration tests share one `tests/fake_glab/mod.rs`. `lib.rs::from_start_dir` decides every window's start folder. Detection keeps only GitLab remotes, which `remote_for` searches. The AppImage choice is proven in a child process. Opener and Windows flags are named consts with cfg tests. A target branch holding `:` → `Failed` (!17). The opener runs in its own process group on Unix.",
  "files_changed": [
    "crates/merge-requests/src/detect.rs",
    "crates/merge-requests/src/remote.rs",
    "crates/merge-requests/src/open.rs",
    "crates/merge-requests/src/job_page.rs",
    "crates/merge-requests/tests/fake_glab/mod.rs",
    "crates/merge-requests/tests/list.rs",
    "crates/merge-requests/tests/open.rs",
    "crates/merge-requests/AGENTS.md",
    "src-tauri/src/range_window.rs",
    "src-tauri/src/lib.rs",
    "src-tauri/src/window.rs",
    "tests/glab/merge-requests/graphql-merge-request-17.json",
    "tests/glab/README.md"
  ],
  "tests_added": [
    {
      "name": "range_window::tests::the_second_yamt_is_asked_for_the_range_in_its_repository_without_ai",
      "proves": "#1944: args::parse(arguments(range)) == Invocation::Range{spec, repo: root, ai: Off}; with `--raw=` it fails (\"unknown argument --raw=…\")"
    },
    {
      "name": "range_window::tests::inside_an_appimage::a_second_yamt_starts_from_the_appimage_file_its_variables_name (+ ignored the_program_is_the_appimage_file)",
      "proves": "#1950: a child process with APPIMAGE set and APPDIR = current_exe's folder chooses $APPIMAGE; fails if running_appimage returns None"
    },
    {
      "name": "remote::tests::a_mirror_off_gitlab_first_in_config_order_is_not_the_project_s_remote",
      "proves": "#1949: gitlab_remotes drops a github.com mirror listed first, so remote_for picks origin"
    },
    {
      "name": "tests/open.rs a_mirror_off_gitlab_listed_first_is_not_fetched_from",
      "proves": "#1949 end to end: with a github mirror first in config, !13 opens. On round-1 code it fails with FetchFailed '/nonexistent/github.git'"
    },
    {
      "name": "tests/open.rs a_target_branch_naming_a_ref_to_write_is_refused_before_any_fetch",
      "proves": "#1952: !17 (target main:refs/heads/x) → Failed, refs/status/HEAD unchanged, head not fetched. With the guard disabled it returned Ok"
    },
    {
      "name": "job_page::tests::a_detached_opener_leads_a_process_group_of_its_own",
      "proves": "#1953: detach puts the opener in a process group of its own (pgid == pid); killed the `detach → ()` mutant"
    },
    {
      "name": "job_page::tests::{macos_opens_a_page_with_open, windows_opens_a_page_with_the_url_protocol_handler, other_systems_open_a_page_with_xdg_open}",
      "proves": "#1951: opener program and args per system, cfg-gated (macOS and Windows run in CI)"
    },
    {
      "name": "range_window::tests::the_detach_flags_are_detached_process_and_a_new_process_group (cfg windows)",
      "proves": "#1951: DETACH_FLAGS == 0x208 (DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)"
    },
    {
      "name": "tests::outside_an_appimage_a_window_s_folder_stays_as_given (lib.rs)",
      "proves": "#1946: from_start_dir keeps '.' and 'sub' outside an AppImage. Replaces window.rs's deleted compare_start_folder test"
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo test -p yamt-merge-requests --test open (round-1 src, new tests only)",
      "observed": "a_mirror_off_gitlab_listed_first_is_not_fetched_from ... FAILED  left: Err(FetchFailed { message: \"fatal: '/nonexistent/github.git' does not appear to be a git repository\" })"
    },
    {
      "command": "same, guard changed to `if false && …` (temporary)",
      "observed": "a_target_branch_naming_a_ref_to_write_is_refused_before_any_fetch ... FAILED  left: Ok(RangeToOpen { … }) right: Err(Failed { message: \"GitLab sent \\\"main:refs/heads/x\\\" as a branch name\" })"
    },
    {
      "command": "cargo test -p yamt-app --lib -- range_window (temporarily `--raw=` and running_appimage → None)",
      "observed": "the_second_yamt_is_asked… FAILED left: Err(\"unknown argument --raw=…\"); inside_an_appimage::… FAILED left: \".../target/debug/deps/yamt_app-…\" right: \"/home/sam/yamt.AppImage\". Code restored afterwards"
    },
    {
      "command": "cargo test --workspace",
      "observed": "exit=0, 99 'test result: ok' lines, no FAILED"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "Finished `dev` profile … (no warnings)"
    },
    {
      "command": "cargo fmt --check",
      "observed": "FMT-OK"
    },
    {
      "command": "scripts/arch-check.sh",
      "observed": "arch-check: ok"
    },
    {
      "command": "just bindings-check",
      "observed": "diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts → empty diff (bindings unchanged)"
    },
    {
      "command": "cargo clippy -p yamt-merge-requests --all-targets --target {x86_64-pc-windows-msvc,aarch64-apple-darwin} -- -D warnings; cargo clippy -p yamt-app --lib --tests --target x86_64-pc-windows-msvc -- -D warnings",
      "observed": "Finished, no errors (each run). The cfg(windows)/cfg(macos) tests compile"
    },
    {
      "command": "just mutants HEAD",
      "observed": "21 mutants tested in 2m: 4 missed, 9 caught, 8 unviable. All 4 misses are in cfg(windows) code"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 21 mutants: 9 caught, 8 unviable, 4 missed (all cfg(windows), not compiled on Linux)",
    "survivors": [
      "src-tauri/src/range_window.rs:75 replace | with ^ in DETACH_FLAGS — equivalent: 0x8 and 0x200 share no bit, so ^ == |",
      "src-tauri/src/range_window.rs:75 replace | with & — gate-covered: platform-only; killed by cfg(windows) the_detach_flags_are_… in CI rust job on windows-2025 (`just test`)",
      "src-tauri/src/range_window.rs:79 replace detach with () (windows) — wiring: platform-only; std's Command has no getter for creation_flags, so no test can see it; the flags themselves are pinned by the windows-2025 test",
      "crates/merge-requests/src/job_page.rs:73 windows opener → Default — gate-covered: platform-only; killed by cfg(windows) windows_opens_a_page_with_the_url_protocol_handler in CI rust job on windows-2025"
    ]
  },
  "acceptance_not_run": [
    "cfg(windows) and cfg(macos) tests were compiled here (clippy on the Windows target for both crates, macOS for yamt-merge-requests) but not run. They run in CI's rust job on windows-2025 and macos-14. src-tauri could not be checked for macOS: objc2-exception-helper needs a C cross-compiler",
    "#1945 and #1946 are refactors with no new behaviour, so no test fails on round 1. #1945 is a test-only move. #1946 keeps window.rs's deleted folder test as lib.rs's from_start_dir test"
  ],
  "deviations_from_brief": [
    "#1946: lib.rs now has one `from_start_dir`, used by all three arms (compare, merge, range). It replaces the three repeated `#[cfg(linux)] appimage::repo_from_start_dir` blocks. COMPARE_FOLDER \".\" in lib.rs repeats args.rs's private CURRENT_DIR. args.rs is read-only. A cleaner diff for its owner: make args.rs `CURRENT_DIR` pub(crate), or let `Invocation::Compare` carry `folder: PathBuf`",
    "#1949: instead of re-checking the host inside remote_for, detection keeps only the GitLab remotes (`detect::gitlab_remotes`; the field is renamed `gitlab_remotes`). The host rule exists once and remote_for searches only those remotes. A tests/open.rs integration test was added beside the remote.rs unit test",
    "range_window tests: REAP_WAIT/POLL and the Instant import moved inside the Linux-only reap test. Round-1 code left them unused on Windows (clippy -D warnings failed for the Windows target)",
    "crates/merge-requests/AGENTS.md (owned) updated for the GitLab remotes, the opener's process group, the shared fake and the new tests"
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/job_page.rs:78 and src-tauri/src/range_window.rs:62",
      "risk": "The Unix `detach` (process_group(0)) and its pgid test now exist in both crates, as #1953's fix asked. Sharing them would need an API outside both modules' jobs"
    },
    {
      "location": "src-tauri/src/range_window.rs:79",
      "risk": "Windows detach is not observable in any test. Only the flag value is pinned"
    },
    {
      "location": "src-tauri/src/lib.rs:45",
      "risk": "COMPARE_FOLDER \".\" repeats args.rs CURRENT_DIR (read-only here)"
    }
  ]
}
