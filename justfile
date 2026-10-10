set shell := ["bash", "-euo", "pipefail", "-c"]

check: fmt-check clippy test deny bindings-check fixtures-check web-lint web-typecheck web-test web-unused arch-check map-check golden sfc-order hooks-test

fmt-check: (frontend "fmt:check")
    cargo fmt --all --check

clippy:
    cargo clippy --workspace --all-targets -- -D warnings

test:
    cargo nextest run --workspace

deny:
    cargo deny check --warn unmaintained

bindings:
    cargo run --quiet -p yamt-app --bin export-bindings

bindings-check:
    cargo run --quiet -p yamt-app --bin export-bindings -- target/bindings-check.ts
    diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts

fixtures: (fixtures-into "frontend/fixtures")

fixtures-check: (fixtures-into "target/fixtures-check")
    diff -ru frontend/fixtures/golden target/fixtures-check/golden
    diff -ru frontend/fixtures/showcase target/fixtures-check/showcase

# Window fixtures: the 10 goldens, plus hand-written demo cases in tests/showcase/ (not goldens).
[private]
fixtures-into dir:
    rm -rf {{ dir }}/golden {{ dir }}/showcase && mkdir -p {{ dir }}/golden {{ dir }}/showcase
    cargo build --quiet -p yamt-cli
    for case in tests/golden/*/; do target/debug/yamt-cli fixture "$case" > "{{ dir }}/golden/$(basename "$case").json"; done
    for case in tests/showcase/*/; do target/debug/yamt-cli fixture "$case" > "{{ dir }}/showcase/$(basename "$case").json"; done

web-lint: (frontend "lint")

web-typecheck: (frontend "typecheck")

web-test: (frontend "test")

web-unused: (frontend "unused")

arch-check:
    scripts/arch-check.sh

map-check:
    scripts/map-check.sh

sfc-order: (frontend "sfc-order")

hooks-test:
    pnpm -C frontend exec tsx --test ../.omp/hooks/test/hooks.test.ts

dev-web:
    {{ just_executable() }} frontend vite

# WebKit WebDriver for smoke tests. Its windows open on the owner's Samsung screen, never on the ASUS one
# (owner, 2026-10-10; KWin rule kept by scripts/test-screen.sh); without a Samsung screen they open on a
# private virtual display instead.
webdriver port="4445":
    #!/usr/bin/env bash
    set -euo pipefail
    if scripts/test-screen.sh place; then
        exec WebKitWebDriver --port={{ port }}
    fi
    echo "webdriver: no Samsung screen, using a private virtual display" >&2
    exec xvfb-run -a -s "-screen 0 1700x1000x24" env -u WAYLAND_DISPLAY GDK_BACKEND=x11 WebKitWebDriver --port={{ port }}

# Fails when an open test window is anywhere but the Samsung screen; run it after opening a test session.
test-window-check:
    scripts/test-screen.sh check

dev-app:
    cargo tauri dev

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

# Mutation testing of the lines changed since <base> (not in `check`; the verifier runs it per wave).
mutants base:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p target/mutants
    git diff --no-color --no-ext-diff --src-prefix=a/ --dst-prefix=b/ {{ base }} -- '*.rs' > target/mutants/rust.diff
    if [ -s target/mutants/rust.diff ]; then
        status=0
        cargo mutants --in-diff target/mutants/rust.diff --test-workspace=false --output target/mutants || status=$?
        if [ "$status" -ne 0 ] && [ "$status" -ne 2 ] && [ "$status" -ne 3 ]; then exit "$status"; fi
    else
        echo "mutants: no Rust changes since {{ base }}"
    fi
    web_files=$(git diff --name-only --diff-filter=AM {{ base }} -- 'frontend/src/ipc/*.ts' 'frontend/src/ui/*.ts' 'frontend/src/model/*.ts' 'frontend/src/connectors/*.ts' 'frontend/scripts/*.ts' | grep -v -e '\.test\.ts$' -e '/bindings\.ts$' | sed 's|^frontend/||' | paste -sd, -) || true
    if [ -n "$web_files" ]; then
        pnpm -C frontend exec stryker run --plugins @stryker-mutator/vitest-runner --testRunner vitest --mutate "$web_files" --reporters clear-text --tempDirName ../target/stryker-tmp
    else
        echo "mutants: no TypeScript changes since {{ base }}"
    fi

[positional-arguments]
[private]
frontend *args:
    pnpm -C frontend "$@"
