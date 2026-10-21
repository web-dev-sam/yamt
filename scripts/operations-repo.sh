#!/usr/bin/env bash
# Usage: scripts/operations-repo.sh <run> <dir>
# Builds a git repo in <dir> stopped on conflicts by one git operation, for the real-app runs of plan §2 #85-#91.
# <run>: merge, squash, rebase, rebase-apply, rebase-interactive, cherry-pick, revert, am, stash-pop, rerere, hook.
# The sequence runs (rebase*, cherry-pick, am) replay 3 own commits of `feature` onto `main`: commit 1 conflicts in
# a text file, a binary file and a file `main` deleted; commit 2 in another text file; commit 3 applies cleanly.
# Prints the conflicted paths. Uses no user or system git config while building (risk RK19); the repo's own config
# names a committer and turns signing off, so yamt's Continue (run with the user's config) can commit.
set -euo pipefail
source "$(dirname "$0")/git-sandbox.sh"

[ $# -eq 2 ] || die "usage: $0 <run> <dir>"
run=$1
dir=$2

require_empty_dir "$dir"
isolate_git_config

# $1: the commit message.
commit() {
    repo_git commit -q -m "$1"
}

# $@: the git command that must stop on conflicts.
stops() {
    if repo_git "$@" >/dev/null 2>&1; then
        die "git $* finished; expected it to stop on conflicts"
    fi
}

init_repo() {
    mkdir -p "$dir"
    git -c init.defaultBranch=main init -q "$dir"
    repo_git config user.name yamt
    repo_git config user.email yamt@example.invalid
    repo_git config commit.gpgsign false
}

# main and feature diverged from base; feature holds the 3 own commits.
sequence_repo() {
    init_repo
    write src/board.ts 'export const columns = ["todo", "done"];\n'
    write src/card.ts 'export const title = "Card";\n'
    write assets/logo.bin 'LOGO\0base\n'
    write docs/notes.md '# Notes\n\nbase notes\n'
    commit base

    repo_git checkout -q -b feature
    write src/board.ts 'export const columns = ["todo", "doing", "done"];\n'
    write assets/logo.bin 'LOGO\0feature\n'
    write docs/notes.md '# Notes\n\nfeature notes\n'
    repo_git commit -q -m "feature: board columns, logo and notes" -m "The board gets a doing column."
    write src/card.ts 'export const title = "Reminder card";\n'
    commit "feature: card title"
    write src/reminders.ts 'export const reminders = [];\n'
    commit "feature: reminders"

    repo_git checkout -q main
    write src/board.ts 'export const columns = ["backlog", "todo", "done"];\n'
    write src/card.ts 'export const title = "Task";\n'
    write assets/logo.bin 'LOGO\0main\n'
    repo_git rm -q -- docs/notes.md
    commit "main: backlog, task title, new logo; notes removed"
}

# a.txt and b.txt set by the commits a range revert undoes, then changed again on top.
revert_repo() {
    init_repo
    write a.txt 'a0\n'
    write b.txt 'b0\n'
    commit base
    write a.txt 'a1\n'
    commit "set a"
    write b.txt 'b1\n'
    commit "set b"
    write a.txt 'a2\n'
    commit "change a again"
    write b.txt 'b2\n'
    commit "change b again"
}

# main and topic change src/board.ts differently.
two_branch_repo() {
    init_repo
    write src/board.ts 'export const columns = ["todo", "done"];\n'
    commit base
    repo_git checkout -q -b topic
    write src/board.ts 'export const columns = ["todo", "doing", "done"];\n'
    commit "topic: doing column"
    repo_git checkout -q main
    write src/board.ts 'export const columns = ["backlog", "todo", "done"];\n'
    commit "main: backlog column"
}

case "$run" in
merge)
    sequence_repo
    stops merge --no-edit feature
    expected=4
    ;;
squash)
    sequence_repo
    stops merge --squash feature
    expected=4
    ;;
rebase)
    sequence_repo
    stops rebase main feature
    expected=3
    ;;
rebase-apply)
    sequence_repo
    stops rebase --apply main feature
    expected=3
    ;;
rebase-interactive)
    sequence_repo
    stops -c "sequence.editor=sed -i -e 3s/^pick/reword/" rebase -i main feature
    expected=3
    ;;
cherry-pick)
    sequence_repo
    stops cherry-pick main..feature
    expected=3
    ;;
revert)
    revert_repo
    stops revert --no-edit HEAD~4..HEAD~2
    expected=1
    ;;
am)
    sequence_repo
    repo_git format-patch -q -o "$dir/.git/patches" main..feature >/dev/null
    stops am -3 "$dir"/.git/patches/*.patch
    expected=3
    ;;
stash-pop)
    two_branch_repo
    printf 'export const columns = ["todo", "review", "done"];\n' >"$dir/src/board.ts"
    repo_git stash -q
    repo_git checkout -q topic
    stops stash pop
    expected=1
    ;;
rerere)
    two_branch_repo
    repo_git config rerere.enabled true
    repo_git config rerere.autoUpdate false
    stops merge --no-edit topic
    write src/board.ts 'export const columns = ["backlog", "todo", "doing", "done"];\n'
    repo_git commit -q --no-edit
    repo_git reset -q --hard HEAD^
    stops merge --no-edit topic
    expected=1
    ;;
hook)
    two_branch_repo
    repo_git config core.hooksPath .git/hooks
    mkdir -p "$dir/.git/hooks"
    printf '#!/bin/sh\necho "hook says no" >&2\nexit 1\n' >"$dir/.git/hooks/pre-commit"
    chmod +x "$dir/.git/hooks/pre-commit"
    stops merge --no-edit topic
    expected=1
    ;;
*)
    die "unknown run '$run'; one of: merge squash rebase rebase-apply rebase-interactive cherry-pick revert am stash-pop rerere hook"
    ;;
esac

conflicted=$(require_conflicts "$expected")
echo "operations-repo: $dir stopped in $run; conflicted files:"
echo "$conflicted"
