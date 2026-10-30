# MrPortableTestsBoundary

Agent output (`agent://MrPortableTestsBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrPortableTestsBoundary.md), collected 2026-10-30T18:45:19.755Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: only the 6 owned test files change. No product code, IPC, state, import edge or tree.md row changes, so PM1–PM10 and state.md are untouched.",
    "Item 1: detect.rs:52, list.rs:95, open.rs:111 canonicalize both sides (as gitio tests/repo.rs:302). On Windows CI, detect.rs:50 (git's string) passed, so tests.rs:57-70 holds.",
    "Product question: merge_requests.rs:37-44 keys state on gitlab_repository(folder), and project() is git's common dir. No start folder is compared with a git path, so 'no' is accepted.",
    "Item 2 accepted: the found test builds its repo with git init + remote add and runs on Windows. Script helpers moved into #[cfg(unix)] mod through_glab, with no whole-file gate (plan #59).",
    "Item 3 accepted: job_page.rs:9-10 starts /usr/bin/open by path and job_page.rs:167 pins it. The macOS early return follows the cfg! precedent (pipe lines.rs:214). Linux still asserts xdg-open's argv.",
    "Notes show symlinked-TMPDIR runs failing before and passing after; plain nextest, clippy and fmt pass; cross-checks are clean. The app's macOS check stopped in objc2's cc (brief allows); 0 mutants."
  ],
  "findings": [
    {
      "file": "crates/agent/tests/checkout.rs",
      "line": 318,
      "severity": "should",
      "problem": "Unix-only imports are fixed two new ways: the full path `yamt_agent::Error` (checkout.rs:318, 340) and a `use` inside the function (fetch.rs:155). The repository already gates such imports with a top-level `#[cfg(unix)] use …;` (session/tests/disk_is_truth.rs:4, take.rs:4, settings/tests/relocate.rs:14). The test suite would then have three forms for one problem.",
      "fix": "Add `#[cfg(unix)] use yamt_agent::Error;` to checkout.rs and `#[cfg(unix)] use std::time::Duration;` to the top of fetch.rs, and drop the inline forms."
    },
    {
      "file": "src-tauri/src/merge_requests/tests.rs",
      "line": 57,
      "severity": "should",
      "problem": "`common_dir` is a verbatim copy of crates/merge-requests/tests/detect.rs:29. The next test that expects git's common-dir string will copy it a third time, and the two expectations can drift apart. The product rule itself stays single, in gitio Repo::common_dir.",
      "fix": "Add `pub fn common_dir(root: &Path) -> Result<String>` to yamt_conflict_repo (outside Owned: the orchestrator grants the edit) and call it from both tests; otherwise accept the 3-line copy."
    },
    {
      "file": "crates/merge-requests/tests/detect.rs",
      "line": 41,
      "severity": "nit",
      "problem": "The patch adds `use std::fs;`, but line 41 still calls `std::fs::create_dir`, so the file uses two forms. Nothing gets harder as the app grows.",
      "fix": "Write `fs::create_dir(&subfolder)`."
    }
  ]
}
