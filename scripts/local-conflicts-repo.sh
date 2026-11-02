#!/usr/bin/env bash
# Usage: scripts/local-conflicts-repo.sh <dir>
# Builds the smoke repository of the merge-request list's local conflict check (plan §2 #149): the repository of
# scripts/mr-conflict-repo.sh, whose fake GitLab (the bare `.git/fake-gitlab.git`) also holds
# `refs/merge-requests/<iid>/head` for !41–!48 of tests/glab/local-conflicts (none for !49; !44's points at
# feature/due-dates while GitLab names feature/clean, a push in flight), and !45's head: a commit from a fork, based on
# main's tip and adding src/board/colours.ts, made in a throwaway clone and pushed only to that ref, so no branch and
# not the checkout holds it. Names and dates are fixed, so the commit ids never change: tests/glab/local-conflicts
# uses them. Prints the command that opens the merge-request page. Uses no user or system git config (risk RK19).
set -euo pipefail
# shellcheck source=scripts/git-sandbox.sh
source "$(dirname "$0")/git-sandbox.sh"

[ $# -eq 1 ] || die "usage: $0 <dir>"

"$(dirname "$0")/mr-conflict-repo.sh" "$1" >/dev/null
isolate_git_config

bare="$(cd "$1" && pwd)/.git/fake-gitlab.git"
bare_git() {
    git --git-dir="$bare" "$@"
}

# $1: iid, $2: the branch its head ref points at.
head_ref() {
    bare_git update-ref "refs/merge-requests/$1/head" "refs/heads/$2"
}

head_ref 41 feature/clean
head_ref 42 feature/due-dates
head_ref 43 feature/merged
head_ref 44 feature/due-dates
head_ref 46 feature/clean
head_ref 47 feature/due-dates
head_ref 48 feature/clean

dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
git clone -q "$bare" "$dir"
write src/board/colours.ts 'export const COLOURS = ["red", "green", "blue"] as const;\n'
GIT_AUTHOR_NAME=yamt GIT_AUTHOR_EMAIL=yamt@example.invalid GIT_AUTHOR_DATE=2026-10-08T10:00:00+02:00 \
    GIT_COMMITTER_NAME=yamt GIT_COMMITTER_EMAIL=yamt@example.invalid GIT_COMMITTER_DATE=2026-10-08T10:00:00+02:00 \
    repo_git commit -q -m "Card colours"
repo_git push -q origin HEAD:refs/merge-requests/45/head

root=$(cd "$1" && pwd)
echo "local-conflicts-repo: $root is on develop; GitLab holds the head refs of !41–!48, !45's only there."
echo "Open its merge-request page with:"
echo "cd $root && yamt --diff"
