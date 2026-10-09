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

export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
g() {
    git -C "$dir" -c user.name=yamt -c user.email=yamt@example.invalid \
        -c commit.gpgsign=false -c core.autocrlf=false "$@"
}
put() {
    mkdir -p "$(dirname "$dir/$path")"
    cp "$case_dir/$1.$ext" "$dir/$path"
    g add -- "$path"
}

mkdir -p "$dir"
git -c init.defaultBranch=main init -q "$dir"
# An empty base means add/add: the file does not exist on main.
if [ -s "$case_dir/base.$ext" ]; then
    put base
fi
g commit -q --allow-empty -m base

g checkout -q -b local
put local
g commit -q -m local

g checkout -q -b remote main
put remote
g commit -q -m remote

g checkout -q local
if g merge -q --no-edit remote; then
    die "merging remote into local was clean; expected a conflict"
fi
echo "golden-repo: $dir is mid-merge; conflicted file: $path"
