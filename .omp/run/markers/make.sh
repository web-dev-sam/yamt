#!/usr/bin/env bash
# Produces git's conflict-marker output for each conflict style, a custom marker size and CRLF,
# so the design can cite git's real bytes instead of memory.
set -euo pipefail
out=$1
mkdir -p "$out"
git --version > "$out/git-version.txt"

make_repo() {
  local dir=$1
  rm -rf "$dir"
  git init -q -b main "$dir"
  git -C "$dir" config user.name t
  git -C "$dir" config user.email t@t
}

# base / ours / theirs: a one-sided change (auto-merged by git), a conflict whose sides share a
# first and last line (zdiff3 moves those out), a legit ======= line, and a second conflict.
base=$'title\n=======\none\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\n'
ours=$'title\n=======\none\nTWO\nshared-a\nthree-ours\nshared-b\nfour\nfive\nsix\nseven\neight-ours\nnine\nten\n'
theirs=$'title\n=======\nONE\ntwo\nshared-a\nthree-theirs\nshared-b\nfour\nfive\nsix\nseven\neight-theirs\nnine\nten\n'

conflict() {
  local dir=$1 file=$2 b=$3 o=$4 t=$5
  printf '%s' "$b" > "$dir/$file"
  git -C "$dir" add -A && git -C "$dir" commit -qm base
  git -C "$dir" checkout -qb theirs
  printf '%s' "$t" > "$dir/$file"
  git -C "$dir" commit -qam theirs
  git -C "$dir" checkout -q main
  printf '%s' "$o" > "$dir/$file"
  git -C "$dir" commit -qam ours
  git -C "$dir" merge -q theirs >/dev/null 2>&1 || true
}

for style in merge diff3 zdiff3; do
  d=/tmp/yamt-markers/repo-$style
  make_repo "$d"
  git -C "$d" config merge.conflictStyle "$style"
  conflict "$d" f.txt "$base" "$ours" "$theirs"
  cp "$d/f.txt" "$out/style-$style.txt"
  git -C "$d" ls-files -u > "$out/style-$style.ls-files-u.txt"
done

d=/tmp/yamt-markers/repo-size
make_repo "$d"
printf 'f.txt conflict-marker-size=12\n' > "$d/.gitattributes"
conflict "$d" f.txt "$base" "$ours" "$theirs"
cp "$d/f.txt" "$out/marker-size-12.txt"
git -C "$d" check-attr conflict-marker-size -- f.txt > "$out/marker-size-12.check-attr.txt"

d=/tmp/yamt-markers/repo-crlf
make_repo "$d"
crlf() { printf '%s' "$1" | sed 's/$/\r/'; }
conflict "$d" f.txt "$(crlf "$base")"$'\n' "$(crlf "$ours")"$'\n' "$(crlf "$theirs")"$'\n'
cp "$d/f.txt" "$out/crlf.txt"

printf '%s' "$base" > "$out/base.txt"
printf '%s' "$ours" > "$out/ours.txt"
printf '%s' "$theirs" > "$out/theirs.txt"
