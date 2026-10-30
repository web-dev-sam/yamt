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

settings_deps=$(normal_deps yamt-settings)
forbidden_in_settings=$(grep -E '^(yamt-|tauri(-|$))' <<<"$settings_deps" | grep -vx 'yamt-settings' || true)
if [ -n "$forbidden_in_settings" ]; then
    echo "arch-check: yamt-settings must not depend on:" $forbidden_in_settings >&2
    failed=1
fi

pipe_deps=$(normal_deps yamt-pipe)
forbidden_in_pipe=$(grep -E '^(yamt-|tauri(-|$)|serde_json$)' <<<"$pipe_deps" | grep -vx 'yamt-pipe' || true)
if [ -n "$forbidden_in_pipe" ]; then
    echo "arch-check: yamt-pipe depends on no yamt crate, never on tauri or serde_json, not:" $forbidden_in_pipe >&2
    failed=1
fi

lsp_host_deps=$(normal_deps yamt-lsp-host)
forbidden_in_lsp_host=$(grep -E '^(yamt-|tauri(-|$)|serde_json$)' <<<"$lsp_host_deps" | grep -vxE 'yamt-(lsp-host|pipe)' || true)
if [ -n "$forbidden_in_lsp_host" ]; then
    echo "arch-check: yamt-lsp-host depends on yamt-pipe only among yamt crates, never on tauri or serde_json, not:" $forbidden_in_lsp_host >&2
    failed=1
fi

compare_deps=$(normal_deps yamt-compare)
forbidden_in_compare=$(grep -E '^(yamt-|tauri(-|$))' <<<"$compare_deps" | grep -vxE 'yamt-(compare|merge-core)' || true)
if [ -n "$forbidden_in_compare" ]; then
    echo "arch-check: yamt-compare depends on yamt-merge-core only among yamt crates, and never on tauri, not:" $forbidden_in_compare >&2
    failed=1
fi

range_deps=$(normal_deps yamt-range)
forbidden_in_range=$(grep -E '^(yamt-|tauri(-|$))' <<<"$range_deps" | grep -vxE 'yamt-(range|gitio|merge-core)' || true)
if [ -n "$forbidden_in_range" ]; then
    echo "arch-check: yamt-range depends on yamt-gitio and yamt-merge-core only among yamt crates, and never on tauri, not:" $forbidden_in_range >&2
    failed=1
fi

review_deps=$(normal_deps yamt-review)
forbidden_in_review=$(grep -E '^(yamt-|tauri(-|$))' <<<"$review_deps" | grep -vxE 'yamt-(review|range|gitio|merge-core)' || true)
if [ -n "$forbidden_in_review" ]; then
    echo "arch-check: yamt-review depends on yamt-range, yamt-gitio and yamt-merge-core only among yamt crates, and never on tauri, not:" $forbidden_in_review >&2
    failed=1
fi

agent_deps=$(normal_deps yamt-agent)
forbidden_in_agent=$(grep -E '^(yamt-|tauri(-|$)|serde_json$)' <<<"$agent_deps" | grep -vxE 'yamt-(agent|gitio|pipe|range|merge-core)' || true)
if [ -n "$forbidden_in_agent" ]; then
    echo "arch-check: yamt-agent depends on yamt-gitio, yamt-pipe and yamt-range (with its yamt-merge-core) only among yamt crates, never on tauri or serde_json, not:" $forbidden_in_agent >&2
    failed=1
fi

merge_requests_deps=$(normal_deps yamt-merge-requests)
forbidden_in_merge_requests=$(grep -E '^(yamt-|tauri(-|$))' <<<"$merge_requests_deps" | grep -vxE 'yamt-(merge-requests|range|gitio|merge-core)' || true)
if [ -n "$forbidden_in_merge_requests" ]; then
    echo "arch-check: yamt-merge-requests depends on yamt-range, yamt-gitio and yamt-merge-core only among yamt crates, and never on tauri, not:" $forbidden_in_merge_requests >&2
    failed=1
fi

local_merge_deps=$(normal_deps yamt-local-merge)
forbidden_in_local_merge=$(grep -E '^(yamt-|tauri(-|$))' <<<"$local_merge_deps" | grep -vxE 'yamt-(local-merge|gitio)' || true)
if [ -n "$forbidden_in_local_merge" ]; then
    echo "arch-check: yamt-local-merge depends on yamt-gitio only among yamt crates, and never on tauri, not:" $forbidden_in_local_merge >&2
    failed=1
fi

app_deps=$(cargo tree --package yamt-app --edges normal --depth 1 --prefix none | cut -d' ' -f1 | sort -u)
forbidden_in_app=$(grep -E '^yamt-' <<<"$app_deps" | grep -vxE 'yamt-(app|session|settings|lsp-host|compare|range|review|agent|merge-requests|local-merge)' || true)
if [ -n "$forbidden_in_app" ]; then
    echo "arch-check: yamt-app depends on yamt-session, yamt-settings, yamt-lsp-host, yamt-compare, yamt-range, yamt-review, yamt-agent, yamt-merge-requests and yamt-local-merge only, not:" $forbidden_in_app >&2
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
