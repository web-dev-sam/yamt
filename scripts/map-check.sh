#!/usr/bin/env bash
# Fails when a source file a reader must find is not named in skill://project-map (PM6).
set -euo pipefail

readonly MAP=.omp/skills/project-map/SKILL.md

missing=()
while IFS= read -r file; do
    name=${file##*/}
    name=${name%.d.ts}
    name=${name%.*}
    if ! grep -qw -- "$name" "$MAP"; then
        missing+=("$file (not in $MAP)")
    fi
done < <(
    git ls-files -- 'frontend/src/*.ts' 'frontend/src/*.vue' 'frontend/scripts/*.ts' 'scripts/*' 'crates/merge-core/src/*.rs' |
        grep -v -e '\.test\.ts$' -e '^frontend/src/ipc/bindings\.ts$'
)

readonly ARCH=docs/architecture.md
readonly IPC=.omp/skills/ipc-contract/SKILL.md

# Every app command must be named in architecture and the ipc-contract skill.
while IFS= read -r command; do
    for doc in "$ARCH" "$IPC"; do
        grep -qw -- "$command" "$doc" || missing+=("command $command (not in $doc)")
    done
done < <(awk '/#\[tauri::command/ { pending = 1 } pending && match($0, /fn [a-z_]+/) { print substr($0, RSTART + 3, RLENGTH - 3); pending = 0 }' src-tauri/src/*.rs)

# Every window data-source method must be named in architecture (the merge, compare and range windows').
for source in ChunkSource CompareSource RangeSource; do
    while IFS= read -r method; do
        grep -qw -- "$method" "$ARCH" || missing+=("$source.$method (not in $ARCH)")
    done < <(sed -n 's/^  \([a-zA-Z]*\)(.*/\1/p' "frontend/src/ipc/$source.ts")
done

if [ "${#missing[@]}" -gt 0 ]; then
    echo "map-check: missing:" >&2
    printf '  %s\n' "${missing[@]}" >&2
    exit 1
fi
echo "map-check: ok"
