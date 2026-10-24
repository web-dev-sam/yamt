```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "nit",
      "file": "crates/cli/tests/range.rs",
      "line": 104,
      "rule_id": null,
      "problem": "The test's comment says it catches 'printing a half document', but `nope..HEAD` fails in `Resolved::resolve` before anything is listed or loaded. A range.rs that printed `start` before loading the files would still pass, so the comment claims more than the test shows; nothing gets harder as the app grows.",
      "fix": "Shorten the comment to 'Catches a range git cannot resolve exiting 1 like a read failure.'"
    }
  ],
  "checked": [
    "Contract, index = id: range.rs:8-17 loads `entry.id` for each entry in `start.files`, in list order. The crate numbers ids 0.. in list order (lib.rs `RangeFileId` doc; entries are sorted by `sort_by_display_path` before ids are assigned). review.json lists ids 0..12 in order. The cli test `range_prints_the_start_and_every_file_at_its_id` pins ids 0,1,2 to a.txt, b.txt and c.bin, plus each file's content (a text pair, a deleted file with right \"\", `{kind: binary}`). A reordered or wrongly indexed `files` would fail it.",
    "Contract, exit codes: lib.rs `exit_code` maps `Error::Usage | Error::Range(_)` to 2 and everything else to FAILURE. A `SpecError` goes through `usage()` (args.rs `parse_range`), so stderr gets its message plus USAGE. Output is printed only after every load has succeeded, so a failed load prints nothing to stdout. The three tests on failing paths pin code 2, empty stdout and the exact stderr. A `Range` error mapped to 1, or a spec parsed after resolve (the temp dir is not a repo, so the stderr prefix would differ), would fail them.",
    "JSON shape: `{start, files}` uses the crate's own Serialize, so the field names match the IPC. `short_id`/`old_path` are snake_case in bindings.ts:320,344 as well, and rangeDomain.ts:41,46 converts them. The committed cases are parsed by row 8's fixtureRange.test.ts:163 ('review lists 13 files of every kind, empty none').",
    "#105 shapes, checked by hand on the existing target/range-repo with `git diff --raw -M main...feature`: config 100644→120000 T (kindChanged); data/big.txt A; docs/current.md 120000→120000 M (link retargeted → texts with the target paths 'shortcuts.md'→'keys.md'); shortcuts.md→keys.md R090; legacy.txt M (Latin-1 → notUtf8 both); logo.png M (binary, numstat notCounted); mockBoards.ts D (texts, right \"\"); board.ts M; reminders.ts A (left \"\"); build.sh 100644→100755 with the same blob (modeOnly file→executable); deploy.sh 100644→100755 with a new blob (texts, mode changed); setup.cmd M (CRLF kept, `\\r\\n` in review.json:449,453); vendor/ui 160000 1111…→2222… (submodule). Each result in review.json matches design §7's order: submodule → kind → mode only → binary → >8 MiB (limit 8388608, file 8 MiB + 1) → not UTF-8 → texts.",
    "Two dots vs three dots: README.md changes only on main after the fork (commit 4378055, 2026-10-07). It is absent from the main...feature list, whose left label is mergeBase{main, feature} at 531ea52 (the fork commit, review.json:619-627). The implementer's main..feature run lists README.md first.",
    "Commit ids are stable: `git log --all` on target/range-repo shows author and committer yamt / yamt@example.invalid with the fixed dates 2026-10-01…07T10:00:00+02:00. So the env prefix on the `repo_git` function call does reach `git commit`, and the five ids equal the pasted ones. Every file in scripts/demo is 100644, so `cp` adds no mode that depends on the machine. `core.autocrlf=false` and `core.attributesFile=/dev/null` hold through `repo_git`, the config is isolated by `isolate_git_config`, and the explicit offset makes the dates independent of TZ. short_id length comes from git's auto-abbrev over a fixed set of objects; core.abbrev is now isolated by the justfile's `{{ hermetic_git }}` on both range lines (commit 8b07afa, working tree clean).",
    "Script: refuses a non-empty dir (`require_empty_dir`), sources git-sandbox.sh, `write`'s printf format gives the Latin-1 `\\xe9` bytes and CRLF, and no text uses `%`. It prints the open command with an absolute repo path. reminders.ts is written inline and scripts/demo has no second copy of it.",
    "fixtures-check: regenerates the repository into target/range-repo (on disk, RK27) and diffs it against frontend/fixtures/range. Together with fixtureRange.test.ts's count of 13 files across every kind, a lost shape or a drifting id is caught.",
    "Implementer deviations accepted: the `write` printf format, one fixed author, made-up gitlink ids (diff-tree reads no submodule), `Error::Range` → 2 as the Contract says. Open risks accepted: Linux-only links and exec bit (fixtures-check is not in CI), the 43 KB review.json.",
    "Mutation survivors: none (19 mutants: 12 caught, 7 unviable), so there was nothing to triage under VF7.",
    "Not repeated: hermetic justfile lines, the cli test's own `git()` isolation, the copied put/commit_at helpers (boundary review).",
    "Outside the brief, noted only: RangeDesign real-app step 5 lists `main..unrelated`, and the smoke repository has no `unrelated` branch. That step therefore exercises UnknownName, not NoMergeBase. The brief's Change list does not ask for such a branch (RV5).",
    "No test file was run; no block depends on one."
  ]
}
```