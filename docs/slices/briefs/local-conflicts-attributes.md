# Slice LocalConflictsAttributes — the local merge reads attributes from GitLab's commit, not the user's checkout

Bug (owner, session 57): "Conflicts disappear after refresh even though they are there." Log of the owner's load:
`3 rows: 0 merges, 0 refs fetched, 3 remembered, 0 moving, 0 kept`; GitLab's conflicts were shown, then replaced by
the local result. Feature: request `docs/slices/request-local-conflict-check.md` rules 4 and 6 ("GitLab's commits,
never the user's branches"; "no working tree"); plan §2 #149.

Measured by the orchestrator (git 2.56.1, throwaway repository; given, do not re-measure): `git merge-tree
--write-tree --quiet main side` on a same-line conflict exits 1; with an untracked `f merge=union` in the working
tree's `.gitattributes` it exits **0**; same with `.git/info/attributes`; same with `-c core.attributesFile=<file
holding f merge=union>`. `-c attr.tree=main` (and `--attr-source=main`, `GIT_ATTR_SOURCE=main`) restores exit 1 against
the working tree's file; a later `-c core.attributesFile=` (empty) restores exit 1 against the global file. So today
`Repo::merge_tree` decides a GitLab merge request's conflicts with the attributes of whatever branch the user has
checked out (and their global attributes file): a `merge=union`/`binary`/driver line there flips the answer.

## Target

Owned: `crates/gitio/src/merge_tree.rs`, `crates/gitio/tests/local_check.rs`.

Read-only: everything else; `crates/gitio/src/{run.rs,repo.rs,objects.rs}` (command builders),
`crates/conflict-repo/**` (fixtures). `crates/merge-requests/**` needs no change: the attributes come from the pair's
target commit, so `MergedPairs`' key stays right.

Non-goals: `$GIT_DIR/info/attributes` (git reads it first whatever the source; no switch exists — leave it, name it in
the doc comment); merge drivers named by the target commit's own `.gitattributes` and configured by the user; git
2.38–2.41 (older git ignores the unknown `attr.tree` key and keeps today's behaviour — name it in the doc comment, do not
gate on version); any other git call.

## Contract

Signatures unchanged. `Repo::merge_tree(first, second, run_kind, timeout)`: attributes are read from `first`'s tree
(`-c attr.tree=<first>`), never from the working tree; the user's global attributes file is not read
(`-c core.attributesFile=`), nor the system one (`GIT_ATTR_NOSYSTEM=1`). The doc comment states this and the two
exceptions above in one or two lines. The check passes the target tip as `first` (`check.rs:309`), so the attributes
are the target branch's on GitLab — the closest to GitLab's own merge, which reads no user checkout.

## Change

1. `merge_tree.rs`: add the two `-c` options before `merge-tree` (`self.command` takes git's leading args; reuse it,
   no second builder) and the env var; update the doc comment.
2. `tests/local_check.rs`: tests below, built on `diverged_repo` + `SAME_LINE`, every run `supported_runs` gives; the
   global file through the test's own `GIT_CONFIG_GLOBAL` only if the fixtures already isolate global config that way
   (RK19) — otherwise a `-c`-free route: write the global file path into the repository's own config
   (`core.attributesFile`), which the fix must override just the same.

## Acceptance

- Test: a same-line conflict stays `Conflicts` with `a.txt merge=union` in the working tree's `.gitattributes`
  (untracked) — fails before the fix.
- Test: same with `core.attributesFile` pointing at a file holding `a.txt merge=union`.
- Test: a `.gitattributes` with `a.txt merge=union` committed in `first`'s commit makes the merge `Clean` (the target's
  own attributes still apply).
- `cargo test -p yamt-gitio`, `cargo clippy -p yamt-gitio --all-targets` clean; `just mutants HEAD` survivors on
  changed lines killed or reasoned.

## Skills

`skill://risk-register` (RK19).
