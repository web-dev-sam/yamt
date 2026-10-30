# MrPortableTestsCorrectness

Agent output (`agent://MrPortableTestsCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrPortableTestsCorrectness.md), collected 2026-10-30T18:45:19.869Z.

{
  "verdict": "pass",
  "checked": [
    "macOS: detect.rs:52, list.rs:95 and open.rs:111 canonicalize both sides (/private/var). Each was its test's last failing assert (CI 124229187794-0). TMPDIR-symlink run: 3 fail before, 43/43 after.",
    "Windows: only detect.rs runs there (list.rs and open.rs are cfg(unix)). Both sides canonicalize to \\\\?\\C:\\Users\\runneradmin, as gitio repo.rs:302 does on Windows CI. detect.rs:50 (the git-string compare) passed on Windows CI.",
    "App find test (tests.rs:63): git init plus a gitlab origin, no range-repo.sh, so no os error 193 and no file gate. It expects git's common dir, as Repo::common_dir computes it, and fails on None, the root or the start folder.",
    "Job test: job_page.rs:9-10 starts /usr/bin/open by absolute path, so the macOS early return comes before any open; job_page.rs:165 pins open's argv. The Linux path is unchanged. cfg! avoids a dead_code warning. Deviation accepted.",
    "Linux pins nothing less: for plain temp paths canonical equality equals the old exact equality, and list.rs:92 still pins the cwd. The checkout.rs and fetch.rs imports moved into their unix-only tests (checkout.rs:318,340; fetch.rs:155).",
    "Mutants: tests only, so 0 mutants and no survivors to judge (VF7 n/a). Product answer 'no' accepted: the lock key (lock.rs:25-32) and the project key (detect.rs:36-46) both come from git's common dir. No tests run by me."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/tests/detect.rs",
      "line": 46,
      "severity": "nit",
      "problem": "The patch adds `use std::fs;`, but the same test still calls `std::fs::create_dir` by its full path, so the file now uses two forms; nothing gets harder as the app grows.",
      "fix": "Write `fs::create_dir(&subfolder).unwrap();`."
    }
  ]
}
