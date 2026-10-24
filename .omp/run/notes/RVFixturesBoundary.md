```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "justfile",
      "line": 48,
      "rule_id": "RK19",
      "problem": "Lines 48–49 are the first fixture lines that run git, and they run `yamt-cli range` outside `{{ hermetic_git }}`. gitio's `Repo::command` (run.rs:52–59) sets only `LC_ALL`/`GIT_OPTIONAL_LOCKS`. `diff-tree --numstat` and the binary rule (#105: attributes) therefore read the user's `~/.config/git/attributes` and global `core.bigFileThreshold`. For example, a user with `core.bigFileThreshold=1m` gets data/big.txt as `binary` instead of `tooLarge`, because binary comes before the size check in #105's order. So `just fixtures-check`, which is part of `just check`, passes or fails depending on the machine.",
      "fix": "Prefix both `target/debug/yamt-cli range …` lines in `fixtures-into` with `{{ hermetic_git }}`, as `test` and `mutants` do. The script line already isolates itself."
    },
    {
      "severity": "block",
      "file": "crates/cli/tests/range.rs",
      "line": 14,
      "rule_id": "RK19",
      "problem": "`git()` makes a fourth copy of the test-repository git isolation, and a weaker one than `yamt_conflict_repo::isolated_git`. It does not set `core.attributesFile=/dev/null`, does not remove `GIT_CONFIG_PARAMETERS`/`GIT_CONFIG_COUNT`, and sets neither `init.defaultBranch` nor `LC_ALL`. Under a plain `cargo test`, a user's XDG attributes (e.g. `*.bin -binary`) or env-passed config changes what `two_commit_repo` commits. RK19's owner list does not name this copy. `yamt-conflict-repo` is already a dev-dependency of yamt-cli.",
      "fix": "Build the repo with `yamt_conflict_repo::diverged_repo(&[ConflictFile { … }])` and range `main..local`, as crates/range/tests/range.rs:36 does: a.txt changed, b.txt with `local: None`, c.bin added. Alternatively, replace `git()` with `yamt_conflict_repo::git_ok`. Then delete the local helper."
    },
    {
      "severity": "should",
      "file": "scripts/range-repo.sh",
      "line": 27,
      "rule_id": null,
      "problem": "`put` copies demo-repo.sh:39–49 word for word, comment included, minus the `was_put` bookkeeping, and `commit_at` copies demo-repo.sh's `commit_as`. Two scripts now read the scripts/demo layers through two diverging helpers, so a third reader would copy them again.",
      "fix": "In a docs/sandbox pass the orchestrator owns, move `put <layer> <paths…>` (with `files=` set by the caller) into git-sandbox.sh and have both scripts source it. demo-repo.sh keeps its `was_put` record through a wrapper."
    },
    {
      "severity": "should",
      "file": "scripts/git-sandbox.sh",
      "line": 1,
      "rule_id": "PM6",
      "problem": "Three docs no longer match the scripts. The header and the map's git-sandbox line list every sourcing script but not range-repo.sh. demo-repo.sh's header and the map's demo line do not say that range-repo.sh also reads scripts/demo/{base,main,feature}, so a reader editing a demo text for the screenshot does not know it changes review.json. The map's dependency diagram still shows cli on merge-core/session only.",
      "fix": "In the orchestrator's docs pass, add range-repo.sh to git-sandbox.sh:1 and the map's git-sandbox line. Add \"also read by range-repo.sh (the range fixtures)\" to the demo line and demo-repo.sh's header. Add `range ◄── cli` to the dependency diagram."
    },
    {
      "severity": "nit",
      "file": "crates/cli/src/lib.rs",
      "line": 68,
      "rule_id": null,
      "problem": "`USAGE_EXIT_CODE` now also covers `Error::Range` (unknown name, no merge base, git I/O), which are not usage errors. A reader of `exit_code` sees a range refusal described as a usage error. Nothing else gets harder.",
      "fix": "Rename the constant to `REFUSAL_EXIT_CODE` (exit 2: usage or a refused range)."
    },
    {
      "severity": "nit",
      "file": "scripts/range-repo.sh",
      "line": 57,
      "rule_id": null,
      "problem": "`GIT_AUTHOR_NAME`/`EMAIL` and `GIT_COMMITTER_NAME`/`EMAIL` repeat what `repo_git`'s `-c user.name=yamt -c user.email=yamt@example.invalid` already fixes. Only the two dates are new. Nothing gets harder.",
      "fix": "Set only `GIT_AUTHOR_DATE=$1 GIT_COMMITTER_DATE=$1` in `commit_at`."
    }
  ],
  "checked": [
    "Ownership: the patch touches crates/cli/{Cargo.toml,src/args.rs,src/lib.rs,src/range.rs,tests/range.rs}, scripts/range-repo.sh, frontend/fixtures/range/{review,empty}.json and Cargo.lock (lockfile follow-on). The justfile hunk matches the implementer's reported lines, applied by the orchestrator. The map is the orchestrator's docs pass, as the task states.",
    "Contract: `yamt-cli range <repo-dir> <range>` prints `{start, files}` with `files[i] = range.load(entry.id)` in list order (range.rs:11–13). Every yamt-range error exits 2 (lib.rs:68). A malformed range goes through `usage()`, so its message and the usage text go to stderr with exit 2 (args.rs parse_range).",
    "Acceptance evidence in the report: 13 path → kind lines covering every shape in the brief's Change 2 and RangeDesign §10. config kindChanged; big.txt tooLarge with limit 8388608; current.md link shown as target texts (#103/#105); keys.md rename; legacy notUtf8 both; logo binary; mockBoards deleted; board.ts texts; reminders added; build.sh modeOnly; deploy.sh texts with mode changed; setup.cmd CRLF texts; vendor/ui submodule. `main..feature` adds README. Two builds give identical commit ids (pasted). `cmp` shows review/empty identical. A cli test covers a malformed range: exit 2 with the usage line.",
    "Fixture bytes checked: review.json and empty.json start with `files`/`start`, in sorted serde_json key order, as compare fixtures are; empty.json has `files: []` with both sides at 9c1ba3f.",
    "Deviations accepted. git-sandbox.sh:44–49 `write` really does take a printf format, so the brief's fact was wrong, and reminders.ts has no `%`. One fixed author is enough for stable ids. Made-up gitlink ids work because diff-tree compares tree entries and `Submodule` reads no blob. `Error::Range` → exit 2 is what the Contract asks.",
    "Open risks accepted. The Linux-only script (links, exec bit) does not reach CI, because ci.yml runs `just test`, not fixtures-check. The 43 KB review.json comes from board.ts's two texts inlined. The cli tests' own git env is raised as a finding above.",
    "PM1: yamt-cli gaining yamt-range breaks no arch-check rule; scripts/arch-check.sh restricts yamt-range and yamt-app only, and range depends on gitio + merge-core.",
    "range.rs follows compare.rs's pattern: `json!` over `to_value`, `print` with a trailing newline. No second JSON-writing convention.",
    "The test comments `// Catches …` follow the existing convention in cli/tests/{commands,compare}.rs and gitio/session tests.",
    "The script header and per-function parameter comments are within CP4 (job, positional parameters). The script sources git-sandbox.sh and calls `require_empty_dir` and `isolate_git_config` (RK19 for the build itself). `repo_git` sets `core.autocrlf=false` and an attributes/excludes file of /dev/null.",
    "The printed open command `yamt --diff=main...feature --repo <abs>` matches RangeDesign's `--diff=a..b --repo p` form (RangeDesign.md:583).",
    "`.config/nextest`/`just test` runs these tests under `hermetic_git`, so the RK19 test finding concerns a plain `cargo test` and the copied rule, not `just test`.",
    "Mutation: no survivors (19 mutants: 12 caught, 7 unviable)."
  ]
}
```