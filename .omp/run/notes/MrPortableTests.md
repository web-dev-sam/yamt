# MrPortableTests

Agent output (`agent://MrPortableTests`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrPortableTests.md), collected 2026-10-30T18:41:30.445Z.

{
  "summary": "All four items of the brief are fixed. Only test files changed; product code needed no change. Path asserts now compare `fs::canonicalize` of both sides. The app's find test builds its own GitLab repository with `git init` and `remote add`, so it runs on Windows without `range-repo.sh`. The helpers that need the script moved into `#[cfg(unix)] mod through_glab`. On macOS the job-page test stops before the real `/usr/bin/open` would run. The two imports used only by Unix tests are now scoped to those tests. Product question: no.",
  "files_changed": [
    "crates/merge-requests/tests/detect.rs",
    "crates/merge-requests/tests/list.rs",
    "crates/merge-requests/tests/open.rs",
    "src-tauri/src/merge_requests/tests.rs",
    "crates/agent/tests/checkout.rs",
    "crates/gitio/tests/fetch.rs"
  ],
  "tests_added": [
    {
      "name": "merge_requests::tests::a_repository_with_a_gitlab_remote_is_found_and_one_without_is_none (changed)",
      "proves": "find_gitlab_project answers git's own absolute common dir string for a repo with a gitlab.example origin, and none otherwise; it no longer needs range-repo.sh, so it runs on Windows too"
    },
    {
      "name": "through_glab::job_pages_on_path_s_opener (changed)",
      "proves": "on every Unix a job page is not offered before a list or when unlisted, and the opener log stays empty; outside macOS the listed page reaches PATH's fake xdg-open with argv"
    }
  ],
  "smoke_evidence": [
    {
      "command": "mkdir -p /tmp/mrpt-real && ln -sfn /tmp/mrpt-real /tmp/mrpt-link && TMPDIR=/tmp/mrpt-link cargo nextest run -p yamt-merge-requests --no-fail-fast (BEFORE)",
      "observed": "detect.rs:51 left: \"/tmp/mrpt-real/.tmpKj669g\" right: \"/tmp/mrpt-link/.tmpKj669g\"; list.rs:95 same form; open.rs:110 left \"/tmp/mrpt-real/.tmpG2dMaq/rr\" right \"/tmp/mrpt-link/...\"; Summary [2.101s] 43 tests run: 40 passed, 3 failed, 1 skipped (the same 3 tests that fail on macOS CI)"
    },
    {
      "command": "TMPDIR=/tmp/mrpt-link cargo nextest run -p yamt-app --no-fail-fast -E 'test(/^merge_requests::/)' (BEFORE)",
      "observed": "FAIL merge_requests::tests::a_repository_with_a_gitlab_remote_is_found_and_one_without_is_none at tests.rs:69: left \"repository\": \"/tmp/mrpt-real/.tmpGGvSJ7/.git\" right \"/tmp/mrpt-link/.tmpGGvSJ7/.git\"; Summary 3 tests run: 2 passed, 1 failed, 153 skipped"
    },
    {
      "command": "same two commands with TMPDIR=/tmp/mrpt-link (AFTER)",
      "observed": "Summary [2.103s] 43 tests run: 43 passed, 1 skipped; Summary [0.496s] 3 tests run: 3 passed, 153 skipped"
    },
    {
      "command": "cargo nextest run -p yamt-merge-requests -p yamt-agent -p yamt-gitio --no-fail-fast; cargo nextest run -p yamt-app -E 'test(/^merge_requests::/)' (plain env)",
      "observed": "Summary [3.132s] 239 tests run: 239 passed, 15 skipped; Summary [0.653s] 3 tests run: 3 passed, 153 skipped"
    },
    {
      "command": "cargo fmt --all --check && echo FMT-OK; just clippy; just clippy 2>&1 | grep -cE '^(warning|error)'",
      "observed": "FMT-OK; clippy: Finished `dev` profile ... in 34.57s; warning/error count 0"
    },
    {
      "command": "cargo check --tests -p yamt-merge-requests -p yamt-agent -p yamt-gitio --target x86_64-pc-windows-msvc (and --target aarch64-apple-darwin)",
      "observed": "Windows: Finished `dev` profile [unoptimized + debuginfo] target(s) in 5.33s, no warning (the checkout.rs:9 `Error` and fetch.rs:4 `Duration` warnings are gone). macOS: Finished ... in 7.71s, no warning"
    },
    {
      "command": "cargo check --tests -p yamt-app --target x86_64-pc-windows-msvc",
      "observed": "warning: yamt-app@0.6.1: GNU compiler is not supported for this target (x2, a build-script warning, not in owned files); Finished `dev` profile ... in 31.11s"
    },
    {
      "command": "cargo check --tests -p yamt-app --target aarch64-apple-darwin",
      "observed": "stops in the dependency objc2-exception-helper's cc build: `cc: error: unrecognized command-line option '-arch'` (no Apple C compiler here); yamt-app's own code was not reached"
    },
    {
      "command": "product question: read crates/merge-requests/src/detect.rs:36-46, crates/gitio/src/repo.rs:86-89,244-248, crates/range/src/lock.rs:25-32,73-78,108-118, crates/merge-requests/src/open.rs:62-77,159-164, frontend/src/ui/mergeRequests.ts:251-252",
      "observed": "NO. Every path key comes from git alone: `git rev-parse --path-format=absolute` (common dir) and `--show-toplevel` (root), which git prints resolved, so every start folder gives one form. Keys checked: the remembered filters (key = GitLabProject.repository = Repo::common_dir), \"already open\" (PairLock::take hashes Repo::common_dir of Resolved::resolve(root)), the sweep (pair_folders only lists range_dir). No start folder is compared with git's answer."
    },
    {
      "command": "just mutants HEAD",
      "observed": "INFO No mutants to filter / mutants: no Rust changes since HEAD / mutants: no TypeScript changes since HEAD"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → \"no Rust changes since HEAD\": only test files changed, so there are 0 mutants",
    "survivors": []
  },
  "acceptance_not_run": [
    "`cargo check --tests -p yamt-app --target aarch64-apple-darwin` did not reach yamt-app. It stops in the dependency objc2-exception-helper's C build because there is no Apple cc here. The app's Windows check passed, and the macOS check of the three library crates passed."
  ],
  "deviations_from_brief": [
    "Item 2: no gate was needed. The found half of the app's find test now uses `git init` plus a gitlab.example `origin` instead of range-repo.sh, so the whole test runs on Windows. The script helpers moved into `#[cfg(unix)] mod through_glab`, as in review/tests.rs. The expected value is git's own `--git-common-dir` answer, as in detect.rs.",
    "Item 3: on macOS the product starts `/usr/bin/open` by absolute path (job_page.rs:9-10), so a fake in PATH cannot replace it; scripts/fake-open is unchanged. On macOS the job-page test now ends after pinning not-offered and an empty log (`if cfg!(target_os = \"macos\")`). The unit test `macos_opens_a_page_with_open` already pins `/usr/bin/open <url>`. Linux still uses the fake."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/tests/detect.rs:52-55, list.rs:95, open.rs:111-114",
      "risk": "[INFERENCE] I could not run on Windows. I assume `fs::canonicalize` maps git's `C:/Users/runneradmin/...` and the short name `RUNNER~1` to the same `\\\\?\\C:\\...` path. crates/gitio/tests/repo.rs:302 already relies on this and passes on Windows CI."
    },
    {
      "location": "src-tauri/src/merge_requests/tests.rs:63-70",
      "risk": "[INFERENCE] I assume the found half now passes on Windows: git_ok init/remote add already ran there in the none half, and detect.rs:50-51 already compares the same git common_dir string on Windows CI."
    }
  ]
}
