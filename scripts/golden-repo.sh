#!/usr/bin/env bash
# Usage: scripts/golden-repo.sh <case> <dir>
# Builds a git repo in <dir> with tests/golden/<case> left mid-merge (local merging remote).
set -euo pipefail
source "$(dirname "$0")/git-sandbox.sh"

[ $# -eq 2 ] || die "usage: $0 <case> <dir>"
case_name=$1
dir=$2
case_dir="$(cd "$(dirname "$0")/.." && pwd)/tests/golden/$case_name"

[ -f "$case_dir/README.md" ] || die "no such case: $case_dir"
require_empty_dir "$dir"

path=$(golden_file_path "$case_dir")
ext=${path##*.}
for side in base local remote; do
    [ -f "$case_dir/$side.$ext" ] || die "missing $case_dir/$side.$ext"
done

isolate_git_config

put() {
    mkdir -p "$(dirname "$dir/$path")"
    cp "$case_dir/$1.$ext" "$dir/$path"
    repo_git add -- "$path"
}

mkdir -p "$dir"
git -c init.defaultBranch=main init -q "$dir"
# An empty base means add/add: the file does not exist on main.
if [ -s "$case_dir/base.$ext" ]; then
    put base
fi
repo_git commit -q --allow-empty -m base

repo_git checkout -q -b local
put local
repo_git commit -q -m local

repo_git checkout -q -b remote main
put remote
repo_git commit -q -m remote

repo_git checkout -q local
if repo_git merge -q --no-edit remote; then
    die "merging remote into local was clean; expected a conflict"
fi
[ -n "$(repo_git ls-files -u)" ] || die "merge failed without leaving a conflict"
echo "golden-repo: $dir is mid-merge; conflicted file: $path"
