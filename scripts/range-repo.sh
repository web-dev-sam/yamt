#!/usr/bin/env bash
# Usage: scripts/range-repo.sh <dir>
# Builds the range window's smoke repository (plan §2 #103, #105): `main` holds the demo project at the fork point
# (scripts/demo/base) and a few extra files; `feature` branches off it and changes one file of every shape the
# window decides on: board.ts edited (long), src/board/reminders.ts added, src/api/mockBoards.ts deleted,
# docs/shortcuts.md renamed to docs/keys.md with an edit, public/logo.png changed (binary), tools/build.sh made
# executable only, the gitlink vendor/ui moved to another commit, data/big.txt added at 8 MiB + 1, the Latin-1
# docs/legacy.txt edited, the CRLF tools/setup.cmd edited, the link docs/current.md retargeted, config turned from a
# file into a link, tools/deploy.sh made executable and edited. `main` then moves on (README.md), so main..feature
# lists README.md and main...feature does not. Names and dates are fixed, so the commit ids never change:
# tests/glab and crates/review/tests pin them, so any change to this script or to scripts/demo updates both.
# A fake GitLab serves the project (plan §2 #128–#135): the bare `.git/fake-gitlab.git`, a clone of the repository
# holding merge request !12's head (`feature`) and !13's (`feature` + "Snooze a reminder", a commit only the fake
# GitLab has), reached as `origin` https://gitlab.example/taskboard/taskboard.git through `url.<bare>.insteadOf`;
# nothing is fetched, so there is no `refs/remotes`. crates/merge-requests/tests and tests/glab pin !13's id.
# Prints the command that opens the review. Uses no user or system git config (risk RK19).
set -euo pipefail
# shellcheck source=scripts/git-sandbox.sh
source "$(dirname "$0")/git-sandbox.sh"

[ $# -eq 1 ] || die "usage: $0 <dir>"
dir=$1
files="$(cd "$(dirname "$0")" && pwd)/demo"
big_bytes=$((8 * 1024 * 1024 + 1))
ui_at_fork=1111111111111111111111111111111111111111
ui_on_feature=2222222222222222222222222222222222222222

require_empty_dir "$dir"
isolate_git_config

# $1: the path in the repo, $2: the link's target. Stages the link.
link() {
    rm -f "$dir/$1"
    ln -s "$2" "$dir/$1"
    repo_git add -- "$1"
}

# $1: the path in the repo. Stages the file as executable.
executable() {
    chmod +x "$dir/$1"
    repo_git add -- "$1"
}

# $1: the gitlink's path, $2: the commit id it records.
gitlink() {
    repo_git update-index --add --cacheinfo "160000,$2,$1"
}

# $1: date, $2: message. Commits what is staged with fixed names, so the commit id depends only on the script.
commit_at() {
    GIT_AUTHOR_NAME=yamt GIT_AUTHOR_EMAIL=yamt@example.invalid GIT_AUTHOR_DATE=$1 \
        GIT_COMMITTER_NAME=yamt GIT_COMMITTER_EMAIL=yamt@example.invalid GIT_COMMITTER_DATE=$1 \
        repo_git commit -q -m "$2"
}

mkdir -p "$dir"
git -c init.defaultBranch=main init -q "$dir"

put base package.json tsconfig.json .oxlintrc.json .oxfmtrc.json .gitignore index.html README.md \
    src/board/types.ts src/board/card.ts src/board/board.ts src/board/storage.ts src/ui/cardView.ts src/styles.css \
    src/api/client.ts src/api/mockBoards.ts src/main.ts public/logo.png docs/shortcuts.md
commit_at 2026-10-01T10:00:00+02:00 "Taskboard: board model, API client and the logo"

write tools/build.sh '#!/bin/sh\npnpm build\n'
write tools/deploy.sh '#!/bin/sh\nrsync -a dist/ staging:/srv/taskboard/\n'
write tools/setup.cmd '@echo off\r\npnpm install\r\n'
write docs/legacy.txt 'Caf\xe9 board: the first Taskboard, written in 2019.\n'
write env/staging.env 'API=https://staging.taskboard.example\n'
write config 'API=http://localhost:5173\n'
link docs/current.md shortcuts.md
gitlink vendor/ui "$ui_at_fork"
commit_at 2026-10-02T10:00:00+02:00 "Build tools, the old notes and the vendored UI kit"

repo_git checkout -q -b feature
put feature src/board/board.ts
write src/board/reminders.ts 'import type { Card } from "./types";\n\nconst MINUTE_MS = 60_000;\n\n/** When to remind the assignee of a card, or null when it has no due time or reminder. */\nexport function reminderAt(card: Card): Date | null {\n  if (card.dueAt === undefined || card.remindBefore === undefined) {\n    return null;\n  }\n  return new Date(Date.parse(card.dueAt) - card.remindBefore * MINUTE_MS);\n}\n'
repo_git rm -q -- src/api/mockBoards.ts
repo_git mv -- docs/shortcuts.md docs/keys.md
cp "$files/feature/docs/shortcuts.md" "$dir/docs/keys.md"
repo_git add -- docs/keys.md
commit_at 2026-10-05T10:00:00+02:00 "Reminders before a card is due"

put feature public/logo.png
executable tools/build.sh
gitlink vendor/ui "$ui_on_feature"
mkdir -p "$dir/data"
head -c "$big_bytes" /dev/zero | tr '\0' x >"$dir/data/big.txt"
repo_git add -- data/big.txt
write docs/legacy.txt 'Caf\xe9 board: the first Taskboard, written in 2019.\nR\xe9sum\xe9: reminders arrive in 2026.\n'
write tools/setup.cmd '@echo off\r\npnpm install\r\npnpm build\r\n'
link docs/current.md keys.md
rm "$dir/config"
link config env/staging.env
write tools/deploy.sh '#!/bin/sh\nset -e\nrsync -a dist/ staging:/srv/taskboard/\n'
executable tools/deploy.sh
commit_at 2026-10-06T10:00:00+02:00 "New logo, staging config and release tools"

repo_git checkout -q main
put main README.md
commit_at 2026-10-07T10:00:00+02:00 "README: swimlanes"

gitlab_url=https://gitlab.example/taskboard/taskboard.git
bare="$(cd "$dir" && pwd)/.git/fake-gitlab.git"
git clone -q --bare "$dir" "$bare"
# The commit is built with plumbing inside the bare repository alone, so the repository in $dir never has it.
snooze_blob=$({
    repo_git show feature:src/board/reminders.ts
    printf '\n/** The reminder put off by `minutes`. */\nexport function snoozed(remindAt: Date, minutes: number): Date {\n  return new Date(remindAt.getTime() + minutes * MINUTE_MS);\n}\n'
} | repo_git --git-dir="$bare" hash-object -w --stdin)
export GIT_INDEX_FILE="$bare/mr-13.index"
repo_git --git-dir="$bare" read-tree feature
repo_git --git-dir="$bare" update-index --cacheinfo "100644,$snooze_blob,src/board/reminders.ts"
snooze_tree=$(repo_git --git-dir="$bare" write-tree)
rm "$GIT_INDEX_FILE"
unset GIT_INDEX_FILE
snooze_date=2026-10-08T10:00:00+02:00
mr13_head=$(GIT_AUTHOR_NAME=yamt GIT_AUTHOR_EMAIL=yamt@example.invalid GIT_AUTHOR_DATE=$snooze_date \
    GIT_COMMITTER_NAME=yamt GIT_COMMITTER_EMAIL=yamt@example.invalid GIT_COMMITTER_DATE=$snooze_date \
    repo_git --git-dir="$bare" commit-tree -p feature -m "Snooze a reminder" "$snooze_tree")
repo_git --git-dir="$bare" update-ref refs/merge-requests/12/head feature
repo_git --git-dir="$bare" update-ref refs/merge-requests/13/head "$mr13_head"
repo_git remote add origin "$gitlab_url"
repo_git config "url.$bare.insteadOf" "$gitlab_url"

echo "range-repo: $dir holds main and feature; review it with:"
echo "yamt --diff=main...feature --repo $(cd "$dir" && pwd)"
