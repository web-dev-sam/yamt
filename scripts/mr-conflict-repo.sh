#!/usr/bin/env bash
# Usage: scripts/mr-conflict-repo.sh <dir>
# Builds the smoke repository of resolving a merge request's conflicts in the user's own checkout (plan §2 #138–#143):
# `main` holds a small project (README.md, src/board/card.ts) and later changes card.ts and adds
# src/board/priority.ts; `develop` branches from main's tip with docs/develop.md and is checked out at the end;
# `feature/due-dates` branches from main's first commit and, in two commits, adds src/board/dueDates.ts and then
# changes the lines of card.ts main changes (a conflict); `feature/clean` adds only src/board/labels.ts, a file main
# never touches; `feature/merged` branches from main's tip. A fake GitLab serves the project: the bare
# `.git/fake-gitlab.git` holds main, develop and the three feature branches, reached as `origin`
# https://gitlab.example/taskboard/taskboard.git through `url.<bare>.insteadOf`; the checkout keeps only main and
# develop and has no `refs/remotes`. Names and dates are fixed, so the commit ids never change: crates/local-merge
# tests and tests/glab/mr-conflicts use these names. Prints the command that opens the merge-request page. Uses no
# user or system git config (risk RK19).
set -euo pipefail
# shellcheck source=scripts/git-sandbox.sh
source "$(dirname "$0")/git-sandbox.sh"

[ $# -eq 1 ] || die "usage: $0 <dir>"
dir=$1

require_empty_dir "$dir"
isolate_git_config

# $1: date, $2: message. Commits what is staged with fixed names, so the commit id depends only on the script.
commit_at() {
    GIT_AUTHOR_NAME=yamt GIT_AUTHOR_EMAIL=yamt@example.invalid GIT_AUTHOR_DATE=$1 \
        GIT_COMMITTER_NAME=yamt GIT_COMMITTER_EMAIL=yamt@example.invalid GIT_COMMITTER_DATE=$1 \
        repo_git commit -q -m "$2"
}

mkdir -p "$dir"
git -c init.defaultBranch=main init -q "$dir"

write README.md '# Taskboard\n\nCards on a board.\n'
write src/board/card.ts 'export interface Card {\n  id: string;\n  title: string;\n}\n\nexport function label(card: Card): string {\n  return card.title;\n}\n'
commit_at 2026-10-01T10:00:00+02:00 "Taskboard: cards"

repo_git checkout -q -b feature/due-dates
write src/board/dueDates.ts 'const DAY_MS = 86_400_000;\n\n/** Whole days from `now` until `dueAt`, negative when overdue. */\nexport function daysLeft(dueAt: string, now: Date): number {\n  return Math.floor((Date.parse(dueAt) - now.getTime()) / DAY_MS);\n}\n'
commit_at 2026-10-02T10:00:00+02:00 "Due dates: days left"
write src/board/card.ts 'export interface Card {\n  id: string;\n  title: string;\n  dueAt?: string;\n}\n\nexport function label(card: Card): string {\n  return card.dueAt === undefined ? card.title : `${card.title} (due ${card.dueAt})`;\n}\n'
commit_at 2026-10-03T10:00:00+02:00 "Due dates on cards"

repo_git checkout -q -b feature/clean main
write src/board/labels.ts 'export const LABELS = ["bug", "feature", "chore"] as const;\n'
commit_at 2026-10-04T10:00:00+02:00 "Card labels"

repo_git checkout -q main
write src/board/card.ts 'export interface Card {\n  id: string;\n  title: string;\n  priority: number;\n}\n\nexport function label(card: Card): string {\n  return `${card.title} (P${card.priority})`;\n}\n'
write src/board/priority.ts 'export const HIGHEST_PRIORITY = 1;\n'
commit_at 2026-10-05T10:00:00+02:00 "Priorities on cards"

repo_git checkout -q -b feature/merged
write docs/merged.md 'Priorities are merged.\n'
commit_at 2026-10-06T10:00:00+02:00 "Notes on priorities"

repo_git checkout -q -b develop main
write docs/develop.md 'Work in progress lands here first.\n'
commit_at 2026-10-07T10:00:00+02:00 "Develop: notes"

gitlab_url=https://gitlab.example/taskboard/taskboard.git
bare="$(cd "$dir" && pwd)/.git/fake-gitlab.git"
git clone -q --bare "$dir" "$bare"
repo_git --git-dir="$bare" symbolic-ref HEAD refs/heads/main
repo_git branch -q -D feature/due-dates feature/clean feature/merged
repo_git remote add origin "$gitlab_url"
repo_git config "url.$bare.insteadOf" "$gitlab_url"
# git merge and git commit need an identity, and the sandbox reads no user config.
repo_git config user.name yamt
repo_git config user.email yamt@example.invalid

echo "mr-conflict-repo: $dir is on develop; GitLab holds main, develop, feature/due-dates, feature/clean and feature/merged."
echo "Open its merge-request page with:"
echo "cd $(cd "$dir" && pwd) && yamt --diff"
