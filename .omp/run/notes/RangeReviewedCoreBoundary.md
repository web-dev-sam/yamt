# RangeReviewedCoreBoundary

Agent output (`agent://RangeReviewedCoreBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedCoreBoundary.md), collected 2026-11-19T09:23:46.872Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all changed files are in Owned (range/**, reviewed/**, src-tauri dep line, arch-check.sh) plus generated Cargo.lock. The orchestrator added the root Cargo.toml lines.",
    "PM1: yamt-reviewed depends only on range, gitio (Oid::parse) and merge-core (compare). arch-check has its own block and the app list includes it. Failing path shown in notes.",
    "One source: repo_key is used by both PairLock::take and Range::repo_key. right_text reuses decide/read_sides/decoded and no compare (load.rs:32-42). yamt-range still only reads.",
    "write_atomically (stored.rs:273), third copy, accepted: no shared home without a new crate (merge-core has no std::fs; compare may use merge-core only, PM1). Fixed .tmp safe under lock.",
    "Accepted deviations: NoText if unmarked; RangeEntryKind Deserialize (format_1.rs precedent); sides/right_text; no write without folder; unsorted or foreign id is Broken; test modules.",
    "Open risks accepted: a swept text gives a ReadFailed by name, fixed by reopen (decision 2); 4 git calls per open; 18.5 KB and 2.26 ms. All design §4 core test names present."
  ],
  "findings": [
    {
      "file": "src-tauri/Cargo.toml",
      "line": 33,
      "severity": "should",
      "rule_id": "promote",
      "problem": "`yamt-reviewed = { path = \"../crates/reviewed\" }` repeats a path that root `[workspace.dependencies]` already declares, while every sibling uses `.workspace = true`. Moving the crate means editing two lines; nothing else gets harder.",
      "fix": "Replace the line with `yamt-reviewed.workspace = true`, as was later done for `yamt-review`'s line."
    },
    {
      "file": "crates/reviewed/src/store.rs",
      "line": 162,
      "severity": "should",
      "rule_id": "RS16",
      "problem": "`listed_marks` sounds like a pure read, but it rewrites `reviewed.json` and deletes files in `texts/`. A reader looking for what `open` writes has to open the function to find out. As more callers appear, a hidden write is easy to call twice.",
      "fix": "Rename it for its effect (for example `pruned_marks` or `drop_unlisted_and_sweep`) so the call site in `open` shows that it writes."
    },
    {
      "file": "crates/range/src/side_names.rs",
      "line": 35,
      "severity": "nit",
      "problem": "The private `side_name(repo, typed) -> Result<SideName>` has the same name as `spec.rs:71` `side_name(typed) -> String` in the same crate, so a grep returns two unrelated functions. Nothing else gets harder.",
      "fix": "Rename it to `side_name_now` or `named_side`."
    }
  ]
}
