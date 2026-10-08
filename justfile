set shell := ["bash", "-euo", "pipefail", "-c"]

check: fmt-check clippy test deny bindings-check web-lint web-typecheck web-test arch-check sfc-order

fmt-check: (frontend "oxfmt" "--check")
    cargo fmt --all --check

clippy:
    cargo clippy --workspace --all-targets -- -D warnings

test:
    cargo nextest run --workspace --no-tests=warn

deny:
    cargo deny check --warn unmaintained

bindings:
    cargo run --quiet -p yamt-app --bin export-bindings

bindings-check:
    cargo run --quiet -p yamt-app --bin export-bindings -- target/bindings-check.ts
    diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts

web-lint: (frontend "oxlint" "--type-aware") (frontend "eslint" "src/**/*.vue")

web-typecheck: (frontend "vue-tsc" "--noEmit")

web-test: (frontend "vitest" "run")

arch-check:
    scripts/arch-check.sh

sfc-order: (frontend "tsx" "scripts/check-sfc-order.ts")

dev-web:
    VITE_CHUNK_SOURCE=fixture {{ just_executable() }} frontend vite

dev-app:
    cargo tauri dev

smoke-cli:
    cargo run -p yamt-cli -- classify tests/golden/basic/{base,local,remote}.txt

golden-update:
    cargo run -p yamt-cli -- golden update

[positional-arguments]
[private]
frontend *args:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -f frontend/package.json ]; then
        echo "skipped: frontend/package.json not found (pnpm $*)"
        exit 0
    fi
    pnpm -C frontend "$@"
