#!/usr/bin/env bash
# Usage: scripts/golden-repo.sh <case> <dir>
# Builds a git repo in <dir> with tests/golden/<case> left mid-merge (local merging remote).
set -euo pipefail

die() {
    echo "golden-repo: $*" >&2
    exit 1
}

[ $# -eq 2 ] || die "usage: $0 <case> <dir>"
case_name=$1
dir=$2
case_dir="$(cd "$(dirname "$0")/.." && pwd)/tests/golden/$case_name"

[ -f "$case_dir/README.md" ] || die "no such case: $case_dir"
if [ -e "$dir" ] && [ -n "$(ls -A "$dir")" ]; then
    die "refusing to overwrite $dir: it exists and is not empty"
fi

path=$(sed -n 's/^- File: //p' "$case_dir/README.md")
[ -n "$path" ] || die "$case_dir/README.md has no '- File: <path>' line"
ext=${path##*.}
for side in base local remote; do
    [ -f "$case_dir/$side.$ext" ] || die "missing $case_dir/$side.$ext"
done

git_version=$(git version | sed -n 's/^git version \([0-9]*\)\.\([0-9]*\).*/\1 \2/p')
read -r git_major git_minor <<<"$git_version"
if [ -z "$git_version" ] || [ "$git_major" -lt 2 ] || { [ "$git_major" -eq 2 ] && [ "$git_minor" -lt 32 ]; }; then
    die "git >= 2.32 is required (GIT_CONFIG_GLOBAL); found: $(git version)"
fi

export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
unset GIT_CONFIG_PARAMETERS GIT_CONFIG_COUNT
repo_git() {
    git -C "$dir" -c user.name=yamt -c user.email=yamt@example.invalid \
        -c commit.gpgsign=false -c core.autocrlf=false \
        -c core.attributesFile=/dev/null -c core.excludesFile=/dev/null "$@"
}
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
