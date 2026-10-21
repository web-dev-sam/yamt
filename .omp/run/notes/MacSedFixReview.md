# MacSedFixReview - correctness review of 90361db

Output verbatim.

```json
{
  "lens": "correctness-reviewer",
  "patch": "90361db (.omp/run/patches/MacSedFix.patch)",
  "brief": "docs/slices/briefs/release-0.4.2-macos-sed.md",
  "verdict": "pass",
  "findings": [],
  "checked": [
    "(1) Argument parsing, BSD sed: the getopt option `i:` takes a required argument, so the attached `-i.orig` sets the suffix `.orig`. The two `-e` options are then read as scripts and the todo path as the only file. This is the exact failure the brief diagnosed, and the attached suffix removes it.",
    "(1) Argument parsing, GNU sed (Linux, Git for Windows): the suffix in `-i[SUFFIX]` is optional and must be attached, so `-i.orig` makes the same backup and the same in-place edit.",
    "(1) Quoting: `sed_sequence_editor` (operation.rs:100-106) returns one `-c` argv element with literal single quotes inside it. git reads `sequence.editor` as shell text: the value contains a space or a quote, so git runs it as `sh -c '<value> \"$@\"' <value> <todo>`. Each script is in POSIX single quotes, so the space and the `[0-9a-f]*` glob in `3s/^pick [0-9a-f]*/fixup <oid>/` stay inside one word. A hex oid cannot hold a quote, and no script holds a `'`, `$` or `\\`. Both shells involved are POSIX sh (bash 3.2 as sh on macOS, MSYS sh on Windows), so the quoting cannot behave differently on macOS.",
    "(1) A wrong value here cannot pass silently: `interactive`/`stopped`, `edit_stop_repo`'s `git_ok`, `conflicted` and `git_ok(--edit-todo)` all fail when git cannot start the rebase. Replacing the function body with a default value would make every RebaseInteractive, RebaseSquash and edit-stop test fail.",
    "(2) edit_stop.rs:152: the scripts `2s/^pick/reword/` and `3d` are the same as the old `REWORD_STEP_TWO_DROP_THREE`. The test meaning is unchanged: the todo is empty at step 2 (line 163) and `editor_steps_ahead` is true.",
    "(2) edit_stop.rs:22-29: the scripts `2s/^pick/{chain_step}/` and `3s/^pick [0-9a-f]*/fixup {local}/` are the same as before, and the second one was already single-quoted before the patch.",
    "(2) operations.rs:421: `/^reword/d` is unchanged, and the test still asserts that `editor_steps_ahead` flips while the stop id stays the same.",
    "(2) operation.rs:71-74 and 109-116: the scripts `3s/^pick/reword/`, `2s/^pick/squash/` and `1s/^pick/edit/` are the same as before, and the `interactive`/`edit_stop_repo` argv are unchanged apart from the value.",
    "(2) scripts/operations-repo.sh:118: only `-i` changed to `-i.orig`, as Change 4 asks. The script is unquoted, but `^` and `/` are not special in sh.",
    "(3) gitio reads `rebase-merge/` only through named files: `git_paths(STATE_PATHS)` for presence (operation.rs:8,136), then `git-rebase-todo` (201), `current-fixups` (204), and `done`/`amend` through `read_if_present`/`exists`. No crate calls `read_dir` on git state; the only `read_dir` is run.rs:254 on `/proc/self/task`. `Stop::id()` (operation.rs:24) is computed from the `Stop` fields, not from listing the directory or from mtimes. So `git-rebase-todo.orig` cannot change a stop, an id or `editor_steps_ahead`.",
    "(3) Tests that look inside `rebase-merge/` read named paths only: edit_stop.rs:138 `amend`, 163 `git-rebase-todo`, 184 `done`; operations.rs:119 swaps the whole directory for a symlink. merge/tests.rs:418 asserts the directory is gone after an abort, and git's abort removes the directory recursively, the backup with it.",
    "(4) A grep for `\\bsed\\b` over crates, src-tauri, scripts, justfile and .github finds in-place sed only in `sed_sequence_editor` and operations-repo.sh:118, both with `-i.orig`. The other uses are `sed -n`/`sed 's…'` in git-sandbox.sh, map-check.sh and annotate.sh, and none of them edits in place. The Acceptance pattern `sed -i( |\")` matches nothing.",
    "(4) Shell in test code is POSIX: hook scripts `#!/bin/sh` (session/tests/operations.rs:330; src-tauri merge/tests.rs:27 with `$((…))` and `sleep 0.05`, which macOS sleep accepts), `kill -0`, and `env -u` in the `hermetic_git` prefix (BSD env has `-u`). No Rust test runs anything under `scripts/`: a grep for `scripts/` and `.sh\"` in crates and src-tauri finds nothing.",
    "(4) The GNU-only constructs left (`find -printf` in demo-repo.sh:56, `readlink -f` in lsp-servers.sh:212, `mktemp --suffix` and `date +%N` in test-screen.sh) are in dev-only scripts. None is run by `just test` or ci.yml, which runs `just test`, `cargo tauri build` and `pnpm test`.",
    "The deviation where the consts became locals or inline calls is accepted: a `const` cannot call a non-const fn, and each value has one user. The `push_str(&format!)` open risk is accepted: `format_push_string` is in clippy's restriction group, and the workspace enables only pedantic.",
    "The `.orig` backup open risk is accepted: see (3).",
    "Contract: the signature `sed_sequence_editor(scripts: &[&str]) -> String`, the re-export in lib.rs:12-15 next to `edit_stop_repo`, the doc comment explaining the attached suffix, and the AGENTS.md entry all match the brief.",
    "Risk register: none of RK1–RK27 has its owner touched by this patch. No product code changed (gitio/src and session/src are untouched).",
    "Tests run by me (targeted, hermetic prefix): `cargo nextest run -p yamt-gitio --test edit_stop --test operations` → 32 run, 32 passed, GNU sed only.",
    "Mutation survivors: the assignment gave no survivor list, so I triaged none. A body-replacement mutant of `sed_sequence_editor` would be killed by the rebase fixtures, as noted under (1)."
  ],
  "residual_risk": "BSD sed (macOS) could not be run here; I checked its argument parsing by reading it. Only the `rust (macos-14)` CI job after the owner's push proves the two failing tests now pass there. The chain test also depends on the runner's git writing `current-fixups` and `done` the way git 2.56 does; the other 580 tests already pass on that runner, so a sed failure would not hide such a difference."
}
```