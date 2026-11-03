#!/usr/bin/env bash
# Usage: scripts/gitlab-playground.sh [--reset] <dir>
# Fills a real GitLab project for trying yamt's merge-request page by hand. <dir> is a clone of that project
# (origin = the GitLab project, glab logged in). The project gets the Taskboard history of scripts/mr-conflict-repo.sh
# (fixed names and dates, so the commit ids never change) and six open merge requests into main:
#   "Due dates on cards"   feature/due-dates  conflicts with main (Resolve conflicts, Abort, Push)
#   "Card labels"          feature/clean      merges clean
#   "Notes on priorities"  feature/merged     already contains main
#   "Draft: Develop notes" develop            a draft
#   "Empty change"         feature/empty      main's tip: changes nothing ("+0 −0")
#   "Failing CI"           feature/failing-ci adds a .gitlab-ci.yml whose jobs phpunit (a collapsed section, a "\r"
#                                             progress line, colours) and long-log (about 600 KB, past the 500 KB
#                                             tail GitLab's job page shows) fail: their logs, opened with Shift
# Branches GitLab already has are left alone and merge requests that are open are not made again, so a second run
# only fills what is missing. --reset also force-pushes the six branches back to their first commits (main is never
# forced) and puts <dir> back on a clean main: a merge in progress is aborted, yamt's record of it removed, local
# changes, untracked files and every local branch but main deleted. Only for a playground.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
die() {
    echo "gitlab-playground: $*" >&2
    exit 2
}

reset=false
if [ "${1-}" = --reset ]; then
    reset=true
    shift
fi
[ $# -eq 1 ] || die "usage: $0 [--reset] <dir>"
[ -d "$1" ] || die "$1 is not a directory"
dir=$(cd "$1" && pwd)
git -C "$dir" rev-parse --git-dir > /dev/null 2>&1 || die "$dir is not a git repository"
origin=$(git -C "$dir" remote get-url origin 2> /dev/null) || die "$dir has no remote named origin"
command -v glab > /dev/null || die "glab is not installed"

seed=$(mktemp -d "${TMPDIR:-/tmp}/yamt-gitlab-seed.XXXXXX")
trap 'rm -rf "$seed"' EXIT
"$here/mr-conflict-repo.sh" "$seed/repo" > /dev/null
bare="$seed/repo/.git/fake-gitlab.git"

# feature/failing-ci: main and one commit built as mr-conflict-repo.sh's commits, so its id is fixed too.
(
    . "$here/git-sandbox.sh"
    isolate_git_config
    dir="$seed/repo"
    repo_git checkout -q -b feature/failing-ci main
    cat > "$dir/.gitlab-ci.yml" << 'YAML'
image: alpine:3.20

phpunit:
  stage: test
  script:
    - |
      printf '\033[0Ksection_start:%d:%s[collapsed=true]\r\033[0K%s\n' "$(date +%s)" prepare_tests 'Preparing the tests'
      printf 'composer install\n'
      printf '\033[0Ksection_end:%d:%s\r\033[0K\n' "$(date +%s)" prepare_tests
      printf 'Downloading 10%%\rDownloading 55%%\rDownloading 100%%\n'
      printf '\033[1;31mbold red\033[0m \033[3mitalic\033[0m \033[4munderlined\033[0m \033[38;5;208morange\033[0m \033[41mred background\033[0m\n'
      printf '<b>not bold</b> & <script>x</script>\n'
      printf 'FAILURES!\nTests: 12, Assertions: 30, Failures: 2.\n'
      exit 1

long-log:
  stage: test
  script:
    - |
      for i in $(seq 1 8500); do
        printf '\033[32mline %05d\033[0m of a long log, padded to about six hundred kilobytes\n' "$i"
      done
      exit 1
YAML
    repo_git add .gitlab-ci.yml
    commit_at 2026-10-08T10:00:00+02:00 "CI: two failing jobs"
    repo_git push -q "$bare" refs/heads/feature/failing-ci
)

# Runs "$@" and shows its output only when it fails (GitLab's "To create a merge request …" lines are noise here).
quiet() {
    local out
    if ! out=$("$@" 2>&1); then
        echo "$out" >&2
        die "failed: $*"
    fi
}

on_gitlab() {
    [ -n "$(git -C "$dir" ls-remote --heads origin "refs/heads/$1")" ]
}

# main first, so GitLab has its default branch before any merge request names it.
if on_gitlab main; then
    echo "main: already on GitLab"
else
    quiet git --git-dir="$bare" push "$origin" refs/heads/main:refs/heads/main
    echo "main: pushed"
fi

# $1: the branch on GitLab, $2: the seed's commit it starts at.
push_branch() {
    local branch=$1 source=$2
    if $reset; then
        quiet git --git-dir="$bare" push --force "$origin" "$source:refs/heads/$branch"
        echo "$branch: pushed back to its first commits"
    elif on_gitlab "$branch"; then
        echo "$branch: already on GitLab"
    else
        quiet git --git-dir="$bare" push "$origin" "$source:refs/heads/$branch"
        echo "$branch: pushed"
    fi
}
for branch in develop feature/due-dates feature/clean feature/merged; do
    push_branch "$branch" "refs/heads/$branch"
done
push_branch feature/empty refs/heads/main
push_branch feature/failing-ci refs/heads/feature/failing-ci

git -C "$dir" fetch -q --prune origin
if $reset; then
    if git -C "$dir" rev-parse -q --verify MERGE_HEAD > /dev/null; then
        git -C "$dir" merge --abort
    fi
    rm -f "$(git -C "$dir" rev-parse --git-path yamt-merge-request.json)"
    git -C "$dir" checkout -q -f -B main origin/main
    git -C "$dir" clean -q -fd
    git -C "$dir" for-each-ref --format='%(refname:short)' refs/heads |
        while read -r branch; do
            [ "$branch" = main ] || git -C "$dir" branch -q -D "$branch"
        done
    echo "$dir: on a clean main"
elif ! git -C "$dir" rev-parse -q --verify HEAD > /dev/null; then
    git -C "$dir" checkout -q -B main origin/main
    echo "$dir: main checked out"
fi
git -C "$dir" branch -q --set-upstream-to=origin/main main

# $1: source branch, $2: title, rest: more `glab mr create` flags.
open_merge_request() {
    local branch=$1 title=$2
    shift 2
    if (cd "$dir" && glab mr list --source-branch "$branch" --output json) | grep -q '"iid"'; then
        echo "\"$title\": already open"
        return
    fi
    (cd "$dir" && quiet glab mr create --source-branch "$branch" --target-branch main --title "$title" \
        --description "Made by yamt's scripts/gitlab-playground.sh." --remove-source-branch=false \
        --push=false --yes "$@")
    echo "\"$title\": opened"
}
open_merge_request feature/due-dates "Due dates on cards"
open_merge_request feature/clean "Card labels"
open_merge_request feature/merged "Notes on priorities"
open_merge_request develop "Develop notes" --draft
open_merge_request feature/empty "Empty change"
open_merge_request feature/failing-ci "Failing CI"
