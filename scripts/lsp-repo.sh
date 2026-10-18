#!/usr/bin/env bash
# Usage: scripts/lsp-repo.sh [--servers] <dir>
# Builds a git repo in <dir> left mid-merge (local merging remote) for the real-app check of yamt's language servers
# (docs/plan.md §2 #70, #72): one project per ecosystem, each with one conflicted file (web/ has three). Outside the
# conflicts each file but web/src/greet.ts holds one problem per server that serves it and, where a formatter runs, one
# badly formatted line; every seed is reported while typing, without saving. greet.ts is conflicted and has no seeds.
# - web/: package.json, .oxlintrc.json, .oxfmtrc.json, tsconfig.json, pnpm-lock.yaml. src/math.ts: a `debugger;`
#   (oxlint), a string given to a number (TypeScript), a badly formatted line (oxfmt); src/greet.ts; src/App.vue
#   (`<script setup lang="ts">`): a `debugger;` (oxlint), a string given to a number (TypeScript through
#   @vue/typescript-plugin), a badly formatted line (oxfmt).
# - biome/: package.json, biome.json. src/index.js: a `debugger;` (Biome's noDebugger), a badly formatted line.
# - py/: pyproject.toml with [tool.ruff.lint], [tool.ty], [tool.basedpyright]. api/stats.py: an unused import (ruff),
#   a string given to an int (ty and basedpyright), a badly formatted line (ruff).
# - rs/: a Cargo workspace of core and app. core/src/lib.rs: a call with one argument too few (rust-analyzer's own
#   diagnostic; it runs without `cargo check`), a badly formatted line (rustfmt).
# - go/: go.mod, package calc. calc/calc.go: a string given to an int (gopls), a badly formatted line (gofmt).
# - php/: composer.json, phpstan.neon, phpcs.xml (PSR12). src/Stats.php: an undefined function (Intelephense, and
#   PHPStan through Phpactor), a badly formatted line (phpcs through Phpactor).
# - c/: compile_commands.json (absolute paths of <dir>), .clang-format. src/main.c: `int count = "three";` (clangd),
#   a badly formatted line (clang-format through clangd).
# After the merge, web/node_modules gets links into this checkout's frontend/node_modules: oxlint, oxfmt, typescript
# (5.9) and vue, with their .bin entries. The package.json files are copies: yamt reads nothing whose real path is
# outside the repository (crates/lsp-host/src/files.rs), and detection reads versions there.
# Without --servers nothing is installed: biome/node_modules, py/.venv, php/vendor and web's @vue/typescript-plugin
# are missing. A server whose program is in none of those folders and not on PATH then shows "not installed" with its
# hint, or is not detected when the program is its only sign. With --servers, scripts/lsp-servers.sh installs the
# pinned servers once into the user's cache (the network is needed the first time) and prints the PATH line to launch
# yamt with; this script then links @vue/typescript-plugin into web/node_modules and Biome into
# biome/node_modules/.bin, makes py/.venv (uv) with ruff, ty and basedpyright, and, when PHP runs, copies PHPStan and
# phpcs into php/vendor.
# Prints the conflicted paths. Uses no user or system git config (risk RK19).
set -euo pipefail
# shellcheck source=scripts/git-sandbox.sh
source "$(dirname "$0")/git-sandbox.sh"
# shellcheck source=scripts/lsp-servers.sh
source "$(dirname "$0")/lsp-servers.sh"

with_servers=false
if [ "${1:-}" = "--servers" ]; then
    with_servers=true
    shift
fi
[ $# -eq 1 ] || die "usage: $0 [--servers] <dir>"
dir=$1
expected_conflicts=9

require_frontend_tools
[ -e "$frontend_modules/vue/package.json" ] || die "missing $frontend_modules/vue; run pnpm -C frontend install"
if $with_servers; then
    command -v uv >/dev/null || die "uv is needed to make py/.venv; see https://docs.astral.sh/uv/"
fi
require_empty_dir "$dir"
isolate_git_config

if $with_servers; then
    install_servers
fi

# $1: path in the repo; the content comes on standard input.
write() {
    mkdir -p "$(dirname "$dir/$1")"
    cat >"$dir/$1"
    repo_git add -- "$1"
}

write_web_project() {
    local plugin_dependency=""
    if $with_servers; then
        plugin_dependency=",
    \"@vue/typescript-plugin\": \"$vue_plugin_version\""
    fi
    write web/package.json <<EOF
{
  "name": "lsp-smoke",
  "private": true,
  "dependencies": {
    "vue": "*"
  },
  "devDependencies": {
    "oxfmt": "*",
    "oxlint": "*",
    "typescript": "5.9.3"$plugin_dependency
  }
}
EOF
    printf "lockfileVersion: '9.0'\n" | write web/pnpm-lock.yaml
    write web/.oxlintrc.json <<'EOF'
{
  "rules": { "no-debugger": "error" }
}
EOF
    write web/.oxfmtrc.json <<'EOF'
{
  "printWidth": 100
}
EOF
    write web/tsconfig.json <<'EOF'
{
  "compilerOptions": { "strict": true, "noEmit": true },
  "include": ["src", "src/**/*.vue"]
}
EOF
}

write_other_projects() {
    write biome/package.json <<EOF
{
  "name": "biome-smoke",
  "private": true,
  "devDependencies": {
    "@biomejs/biome": "$biome_version"
  }
}
EOF
    write biome/biome.json <<'EOF'
{
  "formatter": { "indentStyle": "space" },
  "linter": { "rules": { "recommended": true } }
}
EOF
    write py/pyproject.toml <<'EOF'
[project]
name = "lsp-smoke"
version = "0.1.0"
requires-python = ">=3.9"

[tool.ruff.lint]
select = ["F"]

[tool.ty]

[tool.basedpyright]
typeCheckingMode = "standard"
EOF
    write rs/Cargo.toml <<'EOF'
[workspace]
members = ["core", "app"]
resolver = "2"
EOF
    write rs/core/Cargo.toml <<'EOF'
[package]
name = "smoke-core"
version = "0.1.0"
edition = "2021"
EOF
    write rs/app/Cargo.toml <<'EOF'
[package]
name = "smoke-app"
version = "0.1.0"
edition = "2021"

[dependencies]
smoke-core = { path = "../core" }
EOF
    write rs/app/src/main.rs <<'EOF'
fn main() {
    println!("{}", smoke_core::add(1, 2));
}
EOF
    write go/go.mod <<'EOF'
module example.com/smoke

go 1.22
EOF
    write php/composer.json <<EOF
{
    "name": "yamt/lsp-smoke",
    "require": {
        "php": ">=8.2"
    },
    "require-dev": {
        "phpstan/phpstan": "$phpstan_version",
        "squizlabs/php_codesniffer": "$phpcs_version"
    }
}
EOF
    write php/phpstan.neon <<'EOF'
parameters:
    level: 5
    paths:
        - src
EOF
    write php/phpcs.xml <<'EOF'
<?xml version="1.0"?>
<ruleset name="smoke">
    <rule ref="PSR12"/>
    <file>src</file>
</ruleset>
EOF
    write c/.clang-format <<'EOF'
BasedOnStyle: LLVM
EOF
    write c/compile_commands.json <<EOF
[
  {
    "directory": "$root/c",
    "file": "$root/c/src/main.c",
    "arguments": ["cc", "-std=c17", "-c", "src/main.c"]
  }
]
EOF
}

# $1: side (base, local or remote). The web/ sources, each with a change on that side in the middle.
put_web_sources() {
    write web/src/math.ts <<EOF
export function add(a: number, b: number): number {
  return a + b;
}

export const LIMIT = "$1";

export function twice(n: number): number {
  debugger;
  return add(n, n);
}

export const   spaced={a:1,b:2}

export const count: number = "three";
EOF
    write web/src/greet.ts <<EOF
import { LIMIT } from "./math";

export function greet(name: string): string {
  return \`hello \${name} ($1)\`;
}

export const shown = greet(LIMIT);
EOF
    write web/src/App.vue <<EOF
<script setup lang="ts">
const label = "$1";

const count: number = "three";

debugger;

const   totals={a:1,b:2}
</script>

<template>
  <p>{{ label }} {{ count }} {{ totals.a }}</p>
</template>
EOF
}

# $1: side (base, local or remote). One source per other project, each with a change on that side in the middle.
put_other_sources() {
    write biome/src/index.js <<EOF
export const LIMIT = "$1";

export function twice(n) {
  debugger;
  return n * 2;
}

export const   spaced={a:1,b:2}
EOF
    write py/api/stats.py <<EOF
import os


def mean(values: list[float]) -> float:
    return sum(values) / len(values)


LIMIT = "$1"


count: int = "three"

totals={"a":1,"b":2}
EOF
    write rs/core/src/lib.rs <<EOF
pub const LIMIT: &str = "$1";

pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

pub fn twice(n: i32) -> i32 {
    add(n)
}

pub fn spaced()->i32{1}
EOF
    write go/calc/calc.go <<EOF
package calc

const Limit = "$1"

func Add(a int, b int) int {
	return a + b
}

var count int = "three"

var   spaced = map[string]int{"a":1,"b":2}
EOF
    write php/src/Stats.php <<EOF
<?php

declare(strict_types=1);

namespace Smoke;

const LIMIT = "$1";

function mean(array \$values): float
{
    return array_sum(\$values) / count(\$values);
}

function shown(): string
{
    return undefined_helper(LIMIT);
}

function spaced( \$a,\$b ) { return \$a+\$b; }
EOF
    write c/src/main.c <<EOF
#include <stdio.h>

static const char *limit = "$1";

int add(int a, int b) { return a + b; }

int   spaced(int a,int b){return a+b;}

int main(void) {
  int count = "three";
  printf("%s %d\n", limit, count + add(1, 2) + spaced(1, 2));
  return 0;
}
EOF
}

# $1: side (base, local or remote).
put_sources() {
    put_web_sources "$1"
    put_other_sources "$1"
}

link_web_modules() {
    link_frontend_tools "$dir/web/node_modules"
    link_package "$frontend_modules/vue" "$dir/web/node_modules/vue"
}

put_project_programs() {
    link_package "$vue_plugin_home/node_modules/@vue/typescript-plugin" \
        "$dir/web/node_modules/@vue/typescript-plugin"
    mkdir -p "$dir/biome/node_modules/.bin"
    ln -s "$biome_home/node_modules/.bin/biome" "$dir/biome/node_modules/.bin/biome"
    install_python_tools "$dir/py/.venv"
    if $php_runs; then
        cp -a "$php_tools_home/vendor" "$dir/php/vendor"
    fi
}

mkdir -p "$dir"
root=$(cd "$dir" && pwd)
git -c init.defaultBranch=main init -q "$dir"

write_web_project
write_other_projects
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
conflicted=$(require_conflicts "$expected_conflicts")

link_web_modules
if $with_servers; then
    put_project_programs
fi
printf 'node_modules/\n' >"$dir/web/.gitignore"
printf 'node_modules/\n' >"$dir/biome/.gitignore"
printf '.venv/\n' >"$dir/py/.gitignore"
printf 'target/\n' >"$dir/rs/.gitignore"
printf 'vendor/\n' >"$dir/php/.gitignore"

echo "lsp-repo: $dir is mid-merge; conflicted files:"
echo "$conflicted"
