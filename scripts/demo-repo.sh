#!/usr/bin/env bash
# Usage: scripts/demo-repo.sh <dir>
# Builds the demo project the VS Code buttons "conflict", "yamt" and "WebStorm" make and open, and the README
# screenshot shows: Taskboard, a small kanban web app in TypeScript (Vite, oxlint, oxfmt), stopped in the middle of
# `git merge feature/reminders` on main. Its files live under scripts/demo/ as plain files, so the code stays readable
# and editable: base/ is the project at the fork point, main/ the files Maya Lindqvist changed on main (swimlanes by
# person), feature/ the files Tomás Herrera changed on feature/reminders (due times instead of days, reminders).
# Seven files conflict: src/board/board.ts (the long file: changes on both sides all through it, one conflict in
# moveCard), src/board/card.ts, src/ui/cardView.ts, src/api/client.ts, src/api/mockBoards.ts (deleted on
# feature/reminders, changed on main), docs/shortcuts.md and public/logo.png (changed on both sides).
# The merge causes one TypeScript error: feature/reminders renames Card.dueDate to dueAt (src/board/types.ts merges
# cleanly), and main's new lanesOf in board.ts still reads card.dueDate. Main also leaves an unused variable in
# searchCards (oxlint's no-unused-vars warning). Both show in yamt's Result once main's changes there are applied.
# After the merge, node_modules gets links into this checkout's frontend/node_modules: oxlint, oxfmt and typescript,
# with their .bin entries. The package.json files are copies: yamt reads nothing whose real path is outside the
# repository (crates/lsp-host/src/files.rs). typescript-language-server comes from scripts/lsp-servers.sh into the
# user's cache (the network is needed the first time); the PATH line to launch yamt with is printed.
# Prints the conflicted paths. Uses no user or system git config (risk RK19).
set -euo pipefail
# shellcheck source=scripts/git-sandbox.sh
source "$(dirname "$0")/git-sandbox.sh"
# shellcheck source=scripts/lsp-servers.sh
source "$(dirname "$0")/lsp-servers.sh"

[ $# -eq 1 ] || die "usage: $0 <dir>"
dir=$1
checkout="$(cd "$(dirname "$0")/.." && pwd)"
files="$checkout/scripts/demo"
modules="$checkout/frontend/node_modules"
expected_conflicts=7

for tool in oxlint oxfmt tsc; do
    [ -x "$modules/.bin/$tool" ] || die "missing $modules/.bin/$tool; run pnpm -C frontend install"
done
require_empty_dir "$dir"
isolate_git_config
install_typescript_server

# $1: the layer under scripts/demo (base, main or feature), then the paths to copy from it into the repo.
put() {
    local layer=$1 path
    shift
    for path in "$@"; do
        mkdir -p "$(dirname "$dir/$path")"
        cp "$files/$layer/$path" "$dir/$path"
        repo_git add -- "$path"
    done
}

# $1: author ("Name <email>"), $2: date, $3: message. Commits what is staged as that person.
commit_as() {
    local name=${1% <*} email=${1#*<}
    email=${email%>}
    GIT_AUTHOR_NAME=$name GIT_AUTHOR_EMAIL=$email GIT_AUTHOR_DATE=$2 \
        GIT_COMMITTER_NAME=$name GIT_COMMITTER_EMAIL=$email GIT_COMMITTER_DATE=$2 \
        repo_git commit -q -m "$3"
}

# $1: a package folder, $2: its place in the repo. Links every entry but package.json, which is copied.
link_package() {
    mkdir -p "$2"
    for entry in "$1"/*; do
        ln -s "$(readlink -f "$entry")" "$2/$(basename "$entry")"
    done
    rm "$2/package.json"
    cp "$1/package.json" "$2/package.json"
}

link_modules() {
    mkdir -p "$dir/node_modules/.bin"
    for package in oxlint oxfmt; do
        ln -s "$modules/$package" "$dir/node_modules/$package"
    done
    link_package "$modules/typescript" "$dir/node_modules/typescript"
    for tool in oxlint oxfmt tsc; do
        ln -s "$modules/.bin/$tool" "$dir/node_modules/.bin/$tool"
    done
}

priya="Priya Nair <priya@taskboard.example>"
tomas="Tomás Herrera <tomas@taskboard.example>"
maya="Maya Lindqvist <maya@taskboard.example>"

mkdir -p "$dir"
git -c init.defaultBranch=main init -q "$dir"

put base package.json tsconfig.json .oxlintrc.json .oxfmtrc.json .gitignore index.html README.md
commit_as "$priya" 2026-09-28T10:12:00+02:00 "Set up Vite, TypeScript, oxlint and oxfmt"
put base src/board/types.ts src/board/card.ts src/board/board.ts src/board/storage.ts src/ui/cardView.ts \
    src/styles.css
commit_as "$priya" 2026-09-30T16:40:00+02:00 "Board model: columns, cards, labels and the activity feed"
put base src/api/client.ts src/api/mockBoards.ts src/main.ts
commit_as "$tomas" 2026-10-02T11:05:00+02:00 "Load boards from the API, with a mock board on localhost"
put base public/logo.png docs/shortcuts.md
commit_as "$maya" 2026-10-06T09:30:00+02:00 "Add the logo and the list of keyboard shortcuts"

repo_git checkout -q -b feature/reminders
put feature src/api/client.ts vite.config.ts README.md
repo_git rm -q -- src/api/mockBoards.ts
commit_as "$tomas" 2026-10-12T14:20:00+02:00 "Drop the mock board: pnpm dev proxies /api to staging"
put feature src/board/types.ts src/board/storage.ts src/board/card.ts src/ui/cardView.ts
commit_as "$tomas" 2026-10-14T10:02:00+02:00 "Store due times instead of days (dueDate → dueAt)"
put feature src/board/board.ts src/styles.css docs/shortcuts.md public/logo.png
commit_as "$tomas" 2026-10-16T17:45:00+02:00 "Reminders before a card is due"

repo_git checkout -q main
put main src/board/board.ts src/board/card.ts src/ui/cardView.ts src/styles.css docs/shortcuts.md README.md
commit_as "$maya" 2026-10-13T15:10:00+02:00 "Swimlanes: group a column's cards by person"
put main src/api/mockBoards.ts src/api/client.ts
commit_as "$maya" 2026-10-15T11:25:00+02:00 "Mock board: people on the cards, ?mocks on any host"
put main public/logo.png
commit_as "$maya" 2026-10-17T09:50:00+02:00 "Refresh the logo"

if repo_git merge -q --no-edit feature/reminders >/dev/null 2>&1; then
    die "merging feature/reminders into main was clean; expected conflicts"
fi
conflicted=$(repo_git ls-files -u | cut -f2 | sort -u)
count=$(grep -c . <<<"$conflicted" || true)
[ "$count" -eq "$expected_conflicts" ] || die "expected $expected_conflicts conflicted files, got $count: $conflicted"

link_modules

echo "demo-repo: $dir is mid-merge (main merging feature/reminders); conflicted files:"
echo "$conflicted"
