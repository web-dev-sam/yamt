set shell := ["bash", "-euo", "pipefail", "-c"]

check: fmt-check clippy test deny bindings-check fixtures-check web-lint web-typecheck web-test web-unused arch-check golden sfc-order hooks-test

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

fixtures: (fixtures-into "frontend/fixtures/golden")

fixtures-check: (fixtures-into "target/fixtures-check")
    diff -ru frontend/fixtures/golden target/fixtures-check

[private]
fixtures-into dir:
    rm -rf {{ dir }} && mkdir -p {{ dir }}
    cargo build --quiet -p yamt-cli
    for case in tests/golden/*/; do target/debug/yamt-cli fixture "$case" > "{{ dir }}/$(basename "$case").json"; done

web-lint: (frontend "lint")

web-typecheck: (frontend "typecheck")

web-test: (frontend "test")

web-unused: (frontend "unused")

arch-check:
    scripts/arch-check.sh

sfc-order: (frontend "sfc-order")

hooks-test:
    pnpm -C frontend exec tsx --test ../.omp/hooks/test/hooks.test.ts

dev-web:
    VITE_CHUNK_SOURCE=fixture {{ just_executable() }} frontend vite

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

[positional-arguments]
[private]
frontend *args:
    pnpm -C frontend "$@"
