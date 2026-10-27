I found **3 block-level problems, so the verdict is fail**. I couldn't run git probes: the SP1 guard refused my `mktemp`, so every git behaviour below comes from git's documentation and source. The Windows long-path failure and the partial-clone failure are inferred, not observed.

- **Blocks:**
  1. A user with `clone.defaultRemoteName` set gets a remote that isn't `origin`, so "Ask AI" always fails.
  2. On Windows, paths over about 90 characters fail in the deep checkout folder.
  3. Nothing tests `--no-renames`, even though the status parser depends on it.
- **Shoulds:**
  1. A source that is a partial clone (`--filter=blob:none`) may make the checkout step fail.
  2. A source on a detached HEAD is untested.
  3. Files ignored only through the source's `.git/info/exclude` are listed as changes, which goes against #115.

The other points the task asked about are listed under `checked`: renames, quoted paths, untracked folders, ignored files, submodules, the detached HEAD, a source with no commits, alternates and `gc`, Windows paths, and test strength.

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "plan §2 #110",
      "file": "crates/gitio/src/checkout.rs",
      "line": 27,
      "problem": "The clone takes its remote's name from the user's own config: `clone.defaultRemoteName` (git ≥ 2.30, listed by `git help --config` on 2.56) names it, for example `upstream`. The agent's `make` then calls `remove_remote(\"origin\")` (crates/agent/src/checkout.rs:46), git answers `No such remote: 'origin'`, and for that user every \"Ask AI\" fails and the partial folder is deleted.",
      "fix": "Add `\"--origin\", \"origin\"` to the clone's argv; `-o` beats the config, as `git clone -h` shows. Add a test that sets `GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=clone.defaultRemoteName`, `GIT_CONFIG_VALUE_0=upstream` through `yamt_conflict_repo::run_ignored_in_child` and checks that `remove_remote(\"origin\")` succeeds and `git remote` prints nothing."
    },
    {
      "severity": "block",
      "rule_id": null,
      "file": "crates/gitio/src/checkout.rs",
      "line": 25,
      "problem": "[INFERENCE, not run on Windows] The clone and `checkout --detach` run in a folder like `C:\\Users\\<name>\\AppData\\Roaming\\yamt\\range\\<repo>-<16 hex>\\<40 hex>-<40 hex>\\checkout.partial\\`, which is about 165 characters, so with Git for Windows' default `core.longpaths=false` only about 90 characters remain for a tracked path before MAX_PATH (260). In the user's own repository the same path works: their checkout sits higher up, and a repository-level `core.longpaths` is never copied into a clone. On Windows, a Java, .NET or monorepo tree then fails the checkout with `Filename too long`, and the AI can never start there.",
      "fix": "Clone with `--config core.longpaths=true`. That writes the setting into the clone's own config for the first checkout and for the AI's later git runs; git outside Windows ignores it. Add a `#[cfg(windows)]` test whose source tracks a path long enough to go past 260 under the test's checkout folder."
    },
    {
      "severity": "block",
      "rule_id": "review-protocol block (2): a rule other code relies on left untested",
      "file": "crates/gitio/tests/checkout.rs",
      "line": 98,
      "problem": "`parse_status` is correct only because `--no-renames` is passed (its comment says so at checkout.rs:110-111), and #110 lists the status flags without it. If the flag is dropped, a staged rename (the AI's `git mv a.txt b.txt`) prints `R  b.txt\\0a.txt\\0`. The second record then fails as `UnexpectedOutput`, so `look` reports the checkout as Unreadable. An old path like `ab c.txt` is misread instead, as letters `ab` and path `c.txt`. Every test still passes without the flag: the status test has no index rename.",
      "fix": "Add a `git mv` of a tracked file in the status test, for example `git mv staged.txt moved.txt` on a fresh tracked file, and expect both entries: `D ` for the old path and `A ` for the new one."
    },
    {
      "severity": "should",
      "rule_id": "risk-register (new row)",
      "file": "crates/gitio/src/checkout.rs",
      "line": 27,
      "problem": "[INFERENCE, not run] When the source is a partial clone (`--filter=blob:none`), the shared clone borrows only the blobs the source already fetched, and the clone is not a promisor repository. A local clone also skips the connectivity check. So `checkout --detach <right>` fails with `unable to read <blob>` for every unchanged file whose version at the right commit the user never checked out. That is the usual case for a merge request not rebased on the user's checkout. This makes it harder to grow because the failure looks like a generic git error, with no rule that names it.",
      "fix": "The orchestrator records the case in #110 and the risk register. Then either refuse early in `clone_shared_into` with an error that names the partial clone (when the source's `extensions.partialClone` is set), or let the source fetch the right commit's blobs before the clone; add a test for whichever is chosen."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "crates/gitio/tests/checkout.rs",
      "line": 74,
      "problem": "Every test clones a source that has HEAD on branch `local`. Two paths are never run: a source on a detached HEAD (a review started mid-rebase or after `git checkout <sha>`), where `for-each-ref` finds no branch and `update-ref --stdin` gets empty input; and a source with no commits, the `None` early return at checkout.rs:70. A change that makes either fail would break \"Ask AI\" for a detached source, and no test would notice. Nothing else gets harder as the app grows.",
      "fix": "Add `a_clone_of_a_source_on_a_detached_head_holds_no_branch_and_checks_out`: detach the source with `git checkout --detach remote`, clone, then assert `for-each-ref refs/heads` is empty and `checkout_detached` works."
    },
    {
      "severity": "should",
      "rule_id": "plan §2 #115",
      "file": "crates/gitio/src/checkout.rs",
      "line": 51,
      "problem": "\"Ignored\" in the clone means ignored by the tree's `.gitignore` and the user's global excludes only. The source's `.git/info/exclude` and a repository-level `core.excludesFile` are not cloned. So build output the user ignores only that way is listed as `??`, the checkout counts as changed, and the close question is asked where #115 says it is removed silently. This errs on the safe side: nothing is lost, there is one extra question, and nothing gets harder as the app grows.",
      "fix": "In `clone_shared_into`, copy the source's `info/exclude` (from `git rev-parse --git-path info/exclude`) into the clone's `.git/info/exclude`. Add an exclude-only file in the source to the status test."
    }
  ],
  "checked": [
    "Plan-only (no slice registered for this agent): my git probes in /var/tmp were refused by the hook (SP1); every git behaviour below comes from git's own docs and source, and the two inferred failures say so. `git --version` (2.56.0), `git help --config`, `git clone -h` and `git status -h` were run read-only, to confirm that `clone.defaultRemoteName`, `--origin`, `--no-tags`, `--dissociate` and `status --no-renames` exist.",
    "checkout.rs, tests/checkout.rs and lib.rs are unchanged since 006c484 (`git log`), so I reviewed the code as it now is.",
    "-z parsing: records are `XY SP path NUL` and paths are never quoted under -z (core.quotepath does not matter). The pattern `[x, y, b' ', path @ ..]` keeps a leading space in a path, and the trailing empty record is skipped. Swapping X and Y is caught by the ` D`/`M ` cases; space, newline and non-UTF-8 bytes are covered by unit tests at checkout.rs:142-163.",
    "Porcelain v1 ignores `status.branch`, `status.relativePaths` and colours, because finalize_deferred_config skips them for porcelain and -z, so no `##` header line reaches the parser. Conflicted `UU`/`AA`/`DD` records and submodule ` M` records are still two letters and parse.",
    "Untracked folders: `--untracked-files=all` lists each file, and the status test's `new folder/untracked.txt` would fail under `normal` (which prints `new folder/`). A nested repository the AI makes is listed as `?? dir/` and counts as changed. An empty folder is not listed, and it holds nothing to keep.",
    "Ignored files (#115): status without `--ignored` never prints `!!`, and an ignored folder is not walked. The test would fail if `--ignored` were added (`ignored.txt` through info/exclude).",
    "Detached HEAD after the branch is deleted: `update-ref --no-deref HEAD <oid>` comes first, so the second transaction deletes a branch HEAD no longer names. If detaching were dropped, HEAD would be left unborn and `head_commit` would fail; test 2 asserts head_commit == local, so it would catch that. The for-each-ref listing, the `if !branch.is_empty()` guard (inverting it sends `delete \\n`, which git refuses) and `remove_remote` (`git remote` is empty) are each pinned by a test.",
    "Source with no commits or branches: `commit_named(\"HEAD\")` returns Ok(None) for an unborn HEAD (oid_unless_silent), so the clone succeeds and `checkout_detached` fails with GitFailed. A range needs commits, so this is acceptable. A source whose unborn HEAD sits beside existing branches leaves the clone with no local branch either. Tags remain: that is the boundary finding, not repeated.",
    "No-checkout clone + checkout: with no index file, git treats the checkout as an initial checkout (is_index_unborn). If an index were written first, twoway_merge would reject a.txt, which differs between local and remote, and test 1 would fail. That regression is therefore caught.",
    "Alternates and gc (design note AgentDesign.md:101 accepts it): the source's repack keeps the objects path, so the clone still reads it. A prune in the source can remove objects only the clone needs, once a right commit has been unreachable past gc.pruneExpire (2 weeks; a remote-tracking reflog goes with `fetch --prune`). That hits only checkouts kept long after the branch is gone: they turn Unreadable and are never removed unasked (#110), and worktree files survive. A gc in the clone repacks with -l and never touches the source. Test 5's `cat-file -e` check fails if the clone writes into the source's objects. The alternates path is resolved through get_common_dir, so a source that is a linked worktree or a submodule works. A shallow source makes git fall back from local cloning to a full copy, which costs time but works.",
    "Windows paths: `path_from_git` decodes lossily outside unix, and Git for Windows prints UTF-8. Test paths are compared as `PathBuf::from(\"new folder/untracked.txt\")` on both sides. The alternates path and the clone root are compared through `fs::canonicalize`, which resolves short names and `\\\\?\\`. The non-UTF-8 test is `#[cfg(unix)]`. Line endings are LF under `just test`'s hermetic_git; a bare `cargo test` with the system `core.autocrlf=true` would fail test 1, which RK19 already accepts.",
    "head_commit: `rev-parse --verify HEAD^{commit}` returns the full oid, and Oid::parse accepts 40 and 64 hex characters (SHA-256 repositories). A failure is GitFailed, which `look` shows as Unreadable (the safe side).",
    "text_differences: the limit is checked on each side separately. The test refuses limit+1 on each side, returns that byte count, and accepts exactly the limit. Swapping left and right would break `text_differences_equals_merge_core_compare`, because the line pairs are asymmetric.",
    "Mutation: the survivors file is empty. String-literal flags such as `--no-renames` are outside what cargo-mutants mutates, which is why block 3 comes from reading the code.",
    "Not repeated: `run_to_success` copying the failure handling, the second discover, tags, relative `into`, and the missing docs (all RVCheckoutReadsBoundary); the inherited GIT_DIR (RVAgentCrateCorrect finding 1). Accepted implementer open risks: a kill between the two ref updates leaves only `checkout.partial`, which the agent removes; tests running with the user's config is consistent with gitio's other tests and RK19."
  ]
}
```