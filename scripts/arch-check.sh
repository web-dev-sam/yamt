#!/usr/bin/env bash
set -euo pipefail

normal_deps() {
    cargo tree --package "$1" --edges normal --target all --all-features --prefix none | cut -d' ' -f1 | sort -u
}

failed=0

gitio_deps=$(normal_deps yamt-gitio)
if grep -qx 'yamt-merge-core' <<<"$gitio_deps"; then
    echo "arch-check: yamt-gitio must not depend on yamt-merge-core" >&2
    failed=1
fi

core_deps=$(normal_deps yamt-merge-core)
forbidden_in_core=$(grep -E '^(serde_json|tokio|tauri)(-|$)' <<<"$core_deps" || true)
if [ -n "$forbidden_in_core" ]; then
    echo "arch-check: yamt-merge-core must not depend on:" $forbidden_in_core >&2
    failed=1
fi

if grep -rnE 'std::(fs|process)' crates/merge-core/src >&2; then
    echo "arch-check: yamt-merge-core must not use std::fs or std::process" >&2
    failed=1
fi

root_threshold=$(grep '^too-many-lines-threshold' clippy.toml)
core_threshold=$(grep '^too-many-lines-threshold' crates/merge-core/clippy.toml)
if [ "$root_threshold" != "$core_threshold" ]; then
    echo "arch-check: too-many-lines-threshold differs between clippy.toml and crates/merge-core/clippy.toml" >&2
    failed=1
fi

# The one allowed `unsafe` is the NVIDIA start-up guard (plan §2 #43): one block, in graphics.rs only.
readonly UNSAFE_HOME=src-tauri/src/graphics.rs
if grep -rnw --include='*.rs' 'unsafe' crates src-tauri/src | grep -v "^$UNSAFE_HOME:" >&2; then
    echo "arch-check: \`unsafe\` is allowed only in $UNSAFE_HOME" >&2
    failed=1
fi
if [ -f "$UNSAFE_HOME" ] && [ "$(grep -cw 'unsafe' "$UNSAFE_HOME")" -gt 1 ]; then
    echo "arch-check: $UNSAFE_HOME may hold one \`unsafe\` block" >&2
    failed=1
fi

if [ "$failed" -eq 0 ]; then
    echo "arch-check: ok"
fi
exit "$failed"
