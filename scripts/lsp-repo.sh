#!/usr/bin/env bash
# Usage: scripts/lsp-repo.sh [--servers] <dir>
# Builds a git repo in <dir> left mid-merge (local merging remote) for the language-server smoke test, with three
# conflicted files. The project folder web/ has package.json, .oxlintrc.json, .oxfmtrc.json, tsconfig.json and
# pnpm-lock.yaml, and two conflicted .ts files; outside the conflicts, math.ts has one problem for each server: a
# `debugger;` (oxlint), a string given to a number (TypeScript) and a badly formatted line (oxfmt formats it on
# Save). The Python part sits at the root: pyproject.toml (ruff checks its F rules) and api/stats.py, conflicted;
# outside the conflict, an unused import (ruff's lint) and a badly formatted line (ruff formats it on Save).
# After the merge, web/node_modules gets links into this checkout's frontend/node_modules: oxlint, oxfmt and
# typescript (5.9) with their .bin entries. typescript's package.json is a copy: yamt's project_files reads
# nothing whose real path is outside the repository (crates/lsp-host/src/files.rs), and detection reads the
# version there. Without --servers there is no typescript-language-server and no .venv/bin/ruff: TypeScript shows
# "Not installed" with its install hint, and ruff cannot start. With it, typescript-language-server and ruff
# (pinned below) are installed once into the user's cache (npm, python3 -m venv; the network is needed the first
# time) and linked into web/node_modules/.bin and .venv/bin. yamt finds ruff only as a server added by hand, so
# --servers also adds `.venv/bin/ruff server` for py/pyi to the yamt settings file in use (jq), unless it is
# there. Prints the conflicted paths. Uses no user or system git config (risk RK19).
set -euo pipefail
source "$(dirname "$0")/git-sandbox.sh"

with_servers=false
if [ "${1:-}" = "--servers" ]; then
    with_servers=true
    shift
fi
[ $# -eq 1 ] || die "usage: $0 [--servers] <dir>"
dir=$1
modules="$(cd "$(dirname "$0")/.." && pwd)/frontend/node_modules"
expected_conflicts=3
tsls_version=6.0.2
tsls_home="${XDG_CACHE_HOME:-$HOME/.cache}/yamt/typescript-language-server-$tsls_version"
tsls_program="$tsls_home/node_modules/.bin/typescript-language-server"
ruff_version=0.17.0
ruff_home="${XDG_CACHE_HOME:-$HOME/.cache}/yamt/ruff-$ruff_version"
ruff_program="$ruff_home/bin/ruff"
# ruff as yamt's settings list it: a command with a slash is taken from the repository root.
ruff_server='{"command":[".venv/bin/ruff","server"],"fileTypes":["py","pyi"]}'

for tool in oxlint oxfmt tsc; do
    [ -x "$modules/.bin/$tool" ] || die "missing $modules/.bin/$tool; run pnpm -C frontend install"
done
require_empty_dir "$dir"
isolate_git_config

# Installs typescript-language-server $tsls_version into $tsls_home unless it is there already.
install_typescript_server() {
    [ -x "$tsls_program" ] && return
    command -v npm >/dev/null || die "npm is needed to install typescript-language-server"
    mkdir -p "$tsls_home"
    npm install --prefix "$tsls_home" --no-save --no-audit --no-fund --loglevel=error \
        "typescript-language-server@$tsls_version" >/dev/null ||
        die "could not install typescript-language-server $tsls_version into $tsls_home"
    [ -x "$tsls_program" ] || die "npm finished but $tsls_program is missing"
}

# Installs ruff $ruff_version into $ruff_home (a Python virtual environment) unless it is there already.
install_ruff() {
    [ -x "$ruff_program" ] && return
    command -v python3 >/dev/null || die "python3 is needed to install ruff"
    python3 -m venv "$ruff_home" || die "could not make a Python virtual environment in $ruff_home"
    "$ruff_home/bin/python" -m pip install --quiet --disable-pip-version-check "ruff==$ruff_version" ||
        die "could not install ruff $ruff_version into $ruff_home"
    [ -x "$ruff_program" ] || die "pip finished but $ruff_program is missing"
}

# Adds $ruff_server to the servers added by hand in the yamt settings file in use, unless it is there: the
# default file, or the one settings-location names (crates/settings/src/places.rs; the Linux config folder).
add_ruff_to_settings() {
    local folder="${XDG_CONFIG_HOME:-$HOME/.config}/yamt" file updated
    file="$folder/settings.json"
    if [ -f "$folder/settings-location" ]; then
        file=$(head -n 1 "$folder/settings-location")
        [[ "$file" = /* ]] || die "$folder/settings-location does not name an absolute path"
    fi
    if [ ! -e "$file" ]; then
        mkdir -p "$(dirname "$file")"
        printf '{}\n' >"$file"
    fi
    updated=$(jq --argjson server "$ruff_server" '
        .languageServers.repositories //= {}
        | .languageServers.added //= []
        | if any(.languageServers.added[]; . == $server) then . else .languageServers.added += [$server] end
    ' "$file") || die "could not read $file as JSON"
    if [ "$updated" != "$(jq . "$file")" ]; then
        printf '%s\n' "$updated" >"$file"
        echo "lsp-repo: added ruff (.venv/bin/ruff server, py/pyi) to the servers added by hand in $file"
    fi
}

if $with_servers; then
    command -v jq >/dev/null || die "jq is needed to add ruff to yamt's settings"
    install_typescript_server
    install_ruff
fi

# $1: path in the repo, $2: printf format giving the content.
write() {
    mkdir -p "$(dirname "$dir/$1")"
    printf "$2" >"$dir/$1"
    repo_git add -- "$1"
}

# $1: side (base, local or remote). The two .ts files and the .py file, each with a change on that side in the
# middle.
put_sources() {
    write web/src/math.ts "export function add(a: number, b: number): number {\n  return a + b;\n}\n\nexport const LIMIT = \"$1\";\n\nexport function twice(n: number): number {\n  debugger;\n  return add(n, n);\n}\n\nexport const   spaced={a:1,b:2}\n\nexport const count: number = \"three\";\n"
    write web/src/greet.ts "import { LIMIT } from \"./math\";\n\nexport function greet(name: string): string {\n  return \`hello \${name} ($1)\`;\n}\n\nexport const shown = greet(LIMIT);\n"
    write api/stats.py "import os\n\n\ndef mean(values: list[float]) -> float:\n    return sum(values) / len(values)\n\n\nLIMIT = \"$1\"\n\n\ntotals={\"a\":1,\"b\":2}\n"
}

mkdir -p "$dir"
git -c init.defaultBranch=main init -q "$dir"

tsls_dependency=""
if $with_servers; then
    tsls_dependency=",\n    \"typescript-language-server\": \"$tsls_version\""
fi
write web/package.json "{\n  \"name\": \"lsp-smoke\",\n  \"private\": true,\n  \"devDependencies\": {\n    \"oxfmt\": \"*\",\n    \"oxlint\": \"*\",\n    \"typescript\": \"5.9.3\"$tsls_dependency\n  }\n}\n"
write web/pnpm-lock.yaml "lockfileVersion: '9.0'\n"
write web/.oxlintrc.json '{\n  "rules": { "no-debugger": "error" }\n}\n'
write web/.oxfmtrc.json '{\n  "printWidth": 100\n}\n'
write web/tsconfig.json '{\n  "compilerOptions": { "strict": true, "noEmit": true },\n  "include": ["src"]\n}\n'
write pyproject.toml '[project]\nname = "lsp-smoke"\nversion = "0.1.0"\nrequires-python = ">=3.9"\n\n[tool.ruff.lint]\nselect = ["F"]\n'
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
if $with_servers; then
    ln -s "$tsls_program" "$dir/web/node_modules/.bin/typescript-language-server"
    mkdir -p "$dir/.venv/bin"
    ln -s "$ruff_program" "$dir/.venv/bin/ruff"
    add_ruff_to_settings
fi
printf 'node_modules/\n' >"$dir/web/.gitignore"
printf '.venv/\n' >"$dir/.gitignore"

echo "lsp-repo: $dir is mid-merge; conflicted files:"
echo "$conflicted"
