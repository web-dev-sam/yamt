#!/usr/bin/env bash
# Usage: scripts/lsp-repo.sh <dir>
# Builds a git repo in <dir> left mid-merge (local merging remote) for the language-server smoke test: the
# project folder web/ has package.json, .oxlintrc.json, .oxfmtrc.json, tsconfig.json and pnpm-lock.yaml, and
# two conflicted .ts files. After the merge, web/node_modules gets links into this checkout's
# frontend/node_modules: oxlint, oxfmt and typescript (5.9) with their .bin entries, and no
# typescript-language-server. typescript's package.json is a copy: yamt's project_files reads nothing whose
# real path is outside the repository (crates/lsp-host/src/files.rs), and detection reads the version there.
# Prints the conflicted paths. Uses no user or system git config (risk RK19).
set -euo pipefail
source "$(dirname "$0")/git-sandbox.sh"

[ $# -eq 1 ] || die "usage: $0 <dir>"
dir=$1
modules="$(cd "$(dirname "$0")/.." && pwd)/frontend/node_modules"
expected_conflicts=2

for tool in oxlint oxfmt tsc; do
    [ -x "$modules/.bin/$tool" ] || die "missing $modules/.bin/$tool; run pnpm -C frontend install"
done
require_empty_dir "$dir"
isolate_git_config

# $1: path in the repo, $2: printf format giving the content.
write() {
    mkdir -p "$(dirname "$dir/$1")"
    printf "$2" >"$dir/$1"
    repo_git add -- "$1"
}

# $1: side (base, local or remote). The two .ts files, each with a change on that side in the middle.
put_sources() {
    write web/src/math.ts "export function add(a: number, b: number): number {\n  return a + b;\n}\n\nexport const LIMIT = \"$1\";\n\nexport function twice(n: number): number {\n  return add(n, n);\n}\n\nexport const   spaced={a:1,b:2}\n"
    write web/src/greet.ts "import { LIMIT } from \"./math\";\n\nexport function greet(name: string): string {\n  return \`hello \${name} ($1)\`;\n}\n\nexport const shown = greet(LIMIT);\n"
}

mkdir -p "$dir"
git -c init.defaultBranch=main init -q "$dir"

write web/package.json '{\n  "name": "lsp-smoke",\n  "private": true,\n  "devDependencies": {\n    "oxfmt": "*",\n    "oxlint": "*",\n    "typescript": "5.9.3"\n  }\n}\n'
write web/pnpm-lock.yaml "lockfileVersion: '9.0'\n"
write web/.oxlintrc.json '{\n  "rules": { "no-debugger": "error" }\n}\n'
write web/.oxfmtrc.json '{\n  "printWidth": 100\n}\n'
write web/tsconfig.json '{\n  "compilerOptions": { "strict": true, "noEmit": true },\n  "include": ["src"]\n}\n'
put_sources base
repo_git commit -q -m base

repo_git checkout -q -b local
put_sources local
repo_git commit -q -m local

repo_git checkout -q -b remote main
put_sources remote
repo_git commit -q -m remote

repo_git checkout -q local
if repo_git merge -q --no-edit remote >/dev/null; then
    die "merging remote into local was clean; expected conflicts"
fi
conflicted=$(repo_git ls-files -u | cut -f2 | sort -u)
count=$(grep -c . <<<"$conflicted" || true)
[ "$count" -eq "$expected_conflicts" ] || die "expected $expected_conflicts conflicted files, got $count: $conflicted"

mkdir -p "$dir/web/node_modules/.bin" "$dir/web/node_modules/typescript"
for package in oxlint oxfmt; do
    ln -s "$modules/$package" "$dir/web/node_modules/$package"
done
for entry in "$modules"/typescript/*; do
    ln -s "$(readlink -f "$entry")" "$dir/web/node_modules/typescript/$(basename "$entry")"
done
rm "$dir/web/node_modules/typescript/package.json"
cp "$modules/typescript/package.json" "$dir/web/node_modules/typescript/package.json"
for tool in oxlint oxfmt tsc; do
    ln -s "$modules/.bin/$tool" "$dir/web/node_modules/.bin/$tool"
done
printf 'node_modules/\n' >"$dir/web/.gitignore"

echo "lsp-repo: $dir is mid-merge; conflicted files:"
echo "$conflicted"
