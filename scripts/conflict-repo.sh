#!/usr/bin/env bash
# Usage: scripts/conflict-repo.sh <dir>
# Builds a git repo in <dir> left mid-merge (local merging remote) for the desktop smoke test: three golden
# cases (.ts, .vue, .tsx) at their original paths, a CRLF file, an add/add file, a binary file and a file
# deleted on one side. Prints the conflicted paths. Uses no user or system git config (risk RK19).
set -euo pipefail
source "$(dirname "$0")/git-sandbox.sh"

[ $# -eq 1 ] || die "usage: $0 <dir>"
dir=$1
golden_dir="$(cd "$(dirname "$0")/.." && pwd)/tests/golden"
golden_cases=(vue-core-compiler-von vue-core-playground-app tanstack-query-persist-provider)
expected_conflicts=$((${#golden_cases[@]} + 4))

require_empty_dir "$dir"
isolate_git_config

# $1: side (base, local or remote). Copies that side of every golden case to the case's original path;
# an empty base means add/add, so the file does not exist there.
put_golden() {
    local name case_dir path ext
    for name in "${golden_cases[@]}"; do
        case_dir="$golden_dir/$name"
        path=$(golden_file_path "$case_dir")
        ext=${path##*.}
        [ -f "$case_dir/$1.$ext" ] || die "missing $case_dir/$1.$ext"
        if [ -s "$case_dir/$1.$ext" ]; then
            mkdir -p "$(dirname "$dir/$path")"
            cp "$case_dir/$1.$ext" "$dir/$path"
            repo_git add -- "$path"
        fi
    done
}

mkdir -p "$dir"
git -c init.defaultBranch=main init -q "$dir"

put_golden base
write notes/crlf.txt 'line one\r\nline two\r\nline three\r\n'
write assets/logo.bin 'BIN\0base\n'
write docs/removed.md '# Removed\n\nbase text\n'
repo_git commit -q -m base

repo_git checkout -q -b local
put_golden local
write notes/crlf.txt 'line one\r\nline two, local\r\nline three\r\n'
write src/added.ts 'export const answer = 1;\n'
write assets/logo.bin 'BIN\0local\n'
write docs/removed.md '# Removed\n\nlocal text\n'
repo_git commit -q -m local

repo_git checkout -q -b remote main
put_golden remote
write notes/crlf.txt 'line one\r\nline two, remote\r\nline three\r\n'
write src/added.ts 'export const answer = 2;\n'
write assets/logo.bin 'BIN\0remote\n'
repo_git rm -q -- docs/removed.md
repo_git commit -q -m remote

repo_git checkout -q local
if repo_git merge -q --no-edit remote >/dev/null; then
    die "merging remote into local was clean; expected conflicts"
fi
conflicted=$(require_conflicts "$expected_conflicts")
echo "conflict-repo: $dir is mid-merge; conflicted files:"
echo "$conflicted"
