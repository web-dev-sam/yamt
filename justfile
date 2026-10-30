set shell := ["bash", "-euo", "pipefail", "-c"]

# Git without the user's or system config (RK19): yamt reads it, the test repositories are merged without it.
hermetic_git := "env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent"

# One test binary may use at most 4 GB: a mutant can loop while allocating and take the whole desktop with it (#574).
capped_tests := "CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUNNER='systemd-run --user --scope --quiet -p MemoryMax=4G -p MemorySwapMax=0'"

check: fmt-check clippy test deny bindings-check fixtures-check web-lint web-typecheck web-test web-unused arch-check map-check golden sfc-order hooks-test

fmt-check: (frontend "fmt:check")
    cargo fmt --all --check

clippy:
    cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings

# Rust tests, without the user's git config (RK19).
test:
    {{ hermetic_git }} cargo nextest run --workspace

deny:
    cargo deny check --warn unmaintained

bindings:
    cargo run --quiet -p yamt-app --features bindings --bin export-bindings

bindings-check:
    cargo run --quiet -p yamt-app --features bindings --bin export-bindings -- target/bindings-check.ts
    diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts

fixtures: (fixtures-into "frontend/fixtures")

fixtures-check: (fixtures-into "target/fixtures-check")
    diff -ru frontend/fixtures/golden target/fixtures-check/golden
    diff -ru frontend/fixtures/showcase target/fixtures-check/showcase
    diff -ru frontend/fixtures/compare target/fixtures-check/compare
    diff -ru frontend/fixtures/range target/fixtures-check/range

# Window fixtures: goldens, tests/showcase/ demo cases, tests/compare/ pairs (plan §2 #95), range cases over scripts/range-repo.sh (#103).
[private]
fixtures-into dir:
    rm -rf {{ dir }}/golden {{ dir }}/showcase {{ dir }}/compare {{ dir }}/range && mkdir -p {{ dir }}/golden {{ dir }}/showcase {{ dir }}/compare {{ dir }}/range
    cargo build --quiet -p yamt-cli
    for case in tests/golden/*/; do target/debug/yamt-cli fixture "$case" > "{{ dir }}/golden/$(basename "$case").json"; done
    for case in tests/showcase/*/; do target/debug/yamt-cli fixture "$case" > "{{ dir }}/showcase/$(basename "$case").json"; done
    for case in tests/compare/*/; do target/debug/yamt-cli compare "$case" > "{{ dir }}/compare/$(basename "$case").json"; done
    rm -rf target/range-repo && scripts/range-repo.sh target/range-repo > /dev/null
    {{ hermetic_git }} target/debug/yamt-cli range target/range-repo main...feature > "{{ dir }}/range/review.json"
    {{ hermetic_git }} target/debug/yamt-cli range target/range-repo feature..feature > "{{ dir }}/range/empty.json"

web-lint: (frontend "lint")

web-typecheck: (frontend "typecheck")

web-test: (frontend "test")

web-unused: (frontend "unused")

arch-check:
    scripts/arch-check.sh

map-check:
    scripts/map-check.sh

# Rewrites THIRD_PARTY_LICENSES.txt from the Rust and JS dependency trees; run after a dependency change.
third-party-licenses:
    scripts/third-party-licenses.sh

sfc-order: (frontend "sfc-order")

hooks-test:
    pnpm -C frontend exec tsx --test ../.omp/hooks/test/hooks.test.ts

dev-web:
    {{ just_executable() }} frontend vite

# WebKit WebDriver for smoke tests, always on a private virtual display: test windows never open on the owner's
# screens and always have the keyboard (owner 2026-10-30, plan §2 #136; on the owner's desktop an unfocused fixture
# page failed focus checks, #1738).
webdriver port="4445":
    #!/usr/bin/env bash
    set -euo pipefail
    exec xvfb-run -a -s "-screen 0 1700x1000x24" env -u WAYLAND_DISPLAY GDK_BACKEND=x11 WebKitWebDriver --port={{ port }}

# Drives the real app on a private display or the fixture page (`just app-session start-app --name s --fresh-repo`,
# then click/press/type/scroll/read/shot/colours, `stop`); see skill://verification.
[positional-arguments]
app-session *args:
    pnpm -C frontend exec tsx scripts/app-session.ts "$@"

# Desktop app in dev mode; arguments go to yamt (`just dev-app --repo /tmp/yamt-test-merge`).
dev-app *args:
    cargo tauri dev -- -- {{ args }}

# Desktop app as a debug build with the window's pages built in: no dev port, the published app's
# security settings (`just app --repo /tmp/yamt-test-merge`).
app *args:
    cargo tauri build --debug --no-bundle && target/debug/yamt {{ args }}

smoke-cli:
    cargo run --quiet -p yamt-cli -- classify frontend/fixtures/sample/{base,local,remote}.ts.txt

golden:
    cargo run --quiet -p yamt-cli -- golden run

golden-update:
    cargo run --quiet -p yamt-cli -- golden update

golden-show case:
    cargo run --quiet -p yamt-cli -- classify tests/golden/{{ case }}/base.* tests/golden/{{ case }}/local.* tests/golden/{{ case }}/remote.*

golden-repo case dir:
    scripts/golden-repo.sh {{ case }} {{ dir }}

# Mutation testing of the lines ONE patch changed since <base> (not in `check`). The implementer runs it in its
# worktree before finishing, <base> = HEAD there: uncommitted and new files count (VF7). A whole feature is refused:
# 791 Rust mutants ran at ~1.5 min each (#1630).
mutants base:
    #!/usr/bin/env bash
    set -euo pipefail
    # One patch's worth: the largest single-patch runs were 143 Rust mutants and 19 TypeScript files.
    max_rust_mutants=200
    max_web_files=30
    # cargo-mutants copies and builds the tree in TMPDIR, and the tests make temp repos there: on disk (/tmp is RAM
    # here) and outside any git work tree (tests need a plain directory) (#574, #578).
    mkdir -p target/mutants /var/tmp/yamt-mutants
    git diff --no-color --no-ext-diff --no-renames --src-prefix=a/ --dst-prefix=b/ {{ base }} -- '*.rs' > target/mutants/rust.diff
    # Files the patch adds and nobody committed yet (an implementer's worktree), diffed against nothing.
    git ls-files --others --exclude-standard -- '*.rs' | while IFS= read -r file; do
        git diff --no-color --no-ext-diff --src-prefix=a/ --dst-prefix=b/ --no-index /dev/null "$file" || true
    done >> target/mutants/rust.diff
    rust_mutants=0
    if [ -s target/mutants/rust.diff ]; then
        rust_mutants=$(cargo mutants --in-diff target/mutants/rust.diff --list | wc -l)
    fi
    web_globs=('frontend/src/ipc/*.ts' 'frontend/src/ui/*.ts' 'frontend/src/model/*.ts' 'frontend/src/connectors/*.ts' 'frontend/src/lsp/*.ts' 'frontend/src/lsp/internal/*.ts' 'frontend/src/jsonrpc/*.ts' 'frontend/src/jsonrpc/internal/*.ts' 'frontend/src/agent/*.ts' 'frontend/src/agent/internal/*.ts' 'frontend/src/search/*.ts' 'frontend/src/search/internal/*.ts' 'frontend/scripts/*.ts')
    web_files=$({ git diff --name-only --no-renames --diff-filter=AM {{ base }} -- "${web_globs[@]}"; git ls-files --others --exclude-standard -- "${web_globs[@]}"; } | grep -v -e '\.test\.ts$' -e '/bindings\.ts$' | sed 's|^frontend/||' | paste -sd, -) || true
    web_count=$(printf '%s' "$web_files" | tr ',' '\n' | grep -c . || true)
    if [ "$rust_mutants" -gt "$max_rust_mutants" ] || [ "$web_count" -gt "$max_web_files" ]; then
        echo "mutants: refused: {{ base }} covers $rust_mutants Rust mutants and $web_count TypeScript files," >&2
        echo "  more than one patch (at most $max_rust_mutants and $max_web_files). Mutate each patch on its own:" >&2
        echo "  just mutants <the commit before that patch>. A whole-feature run takes hours (#1630, VF7)." >&2
        exit 1
    fi
    if [ "$rust_mutants" -gt 0 ]; then
        status=0
        TMPDIR=/var/tmp/yamt-mutants {{ hermetic_git }} {{ capped_tests }} cargo mutants --in-diff target/mutants/rust.diff --test-workspace=false --output target/mutants || status=$?
        if [ "$status" -ne 0 ] && [ "$status" -ne 2 ] && [ "$status" -ne 3 ]; then exit "$status"; fi
    else
        echo "mutants: no Rust changes since {{ base }}"
    fi
    if [ -n "$web_files" ]; then
        # --ignoreStatic: module-level mutants are not re-evaluated under the vitest runner, so they survive
        # whatever the tests assert (#732: 134 false survivors).
        pnpm -C frontend exec stryker run --plugins @stryker-mutator/vitest-runner --testRunner vitest --mutate "$web_files" --reporters clear-text --tempDirName ../target/stryker-tmp --ignoreStatic
    else
        echo "mutants: no TypeScript changes since {{ base }}"
    fi

# The orchestrator's bookkeeping for one finished agent (skill://orchestrate §4): its note, patch copy, survivor list
# and findings with ids, then a short summary; `--commit "<message>"` commits the applied patch with them.
[positional-arguments]
collect *args:
    node .omp/tools/collect.ts collect "$@"

# Sets the triage of findings (OR12): `just triage 1725 1726 -- "promoted: <reason>"`.
[positional-arguments]
triage *args:
    node .omp/tools/collect.ts triage "$@"

# Prints findings by id from the main checkout's log, also inside an isolated worktree: `just findings 1725 1726`.
[positional-arguments]
findings *args:
    node .omp/tools/collect.ts findings "$@"

# Moves one closed `## ` section of docs/slices/SLICES.md to docs/slices/archive/board.md: `just archive-board "Search —"`.
[positional-arguments]
archive-board *args:
    node .omp/tools/collect.ts archive-board "$@"

[positional-arguments]
[private]
frontend *args:
    pnpm -C frontend "$@"
