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
        missing+=("$file")
    fi
done < <(
    git ls-files -- 'frontend/src/*.ts' 'frontend/src/*.vue' 'frontend/scripts/*.ts' 'scripts/*' 'crates/merge-core/src/*.rs' |
        grep -v -e '\.test\.ts$' -e '^frontend/src/ipc/bindings\.ts$'
)

if [ "${#missing[@]}" -gt 0 ]; then
    echo "map-check: not named in $MAP:" >&2
    printf '  %s\n' "${missing[@]}" >&2
    exit 1
fi
echo "map-check: ok"
