# Sourced by scripts/conflict-repo.sh, golden-repo.sh, lsp-repo.sh and lsp-servers.sh: the shared prelude for building a
# scripted repository in "$dir" without any user or system git config (risk RK19).
# GIT_CONFIG_GLOBAL needs git >= 2.32 (git-config(1), ENVIRONMENT).

sandbox_name=$(basename "$0" .sh)

die() {
    echo "$sandbox_name: $*" >&2
    exit 1
}

# $1: the directory for the repository; refuses one that exists and is not empty.
require_empty_dir() {
    if [ -e "$1" ] && [ -n "$(ls -A "$1")" ]; then
        die "refusing to overwrite $1: it exists and is not empty"
    fi
}

# $1: a golden case directory. Prints the path its README.md names on the `- File: <path>` line.
golden_file_path() {
    local path
    path=$(sed -n 's/^- File: //p' "$1/README.md")
    [ -n "$path" ] || die "$1/README.md has no '- File: <path>' line"
    echo "$path"
}

isolate_git_config() {
    local git_version git_major git_minor
    git_version=$(git version | sed -n 's/^git version \([0-9]*\)\.\([0-9]*\).*/\1 \2/p')
    read -r git_major git_minor <<<"$git_version"
    if [ -z "$git_version" ] || [ "$git_major" -lt 2 ] || { [ "$git_major" -eq 2 ] && [ "$git_minor" -lt 32 ]; }; then
        die "git >= 2.32 is required (GIT_CONFIG_GLOBAL); found: $(git version)"
    fi
    export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
    unset GIT_CONFIG_PARAMETERS GIT_CONFIG_COUNT
}

repo_git() {
    git -C "$dir" -c user.name=yamt -c user.email=yamt@example.invalid \
        -c commit.gpgsign=false -c core.autocrlf=false \
        -c core.attributesFile=/dev/null -c core.excludesFile=/dev/null "$@"
}
