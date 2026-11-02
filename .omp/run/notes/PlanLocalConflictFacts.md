# PlanLocalConflictFacts — measured by the orchestrator, 2026-11-02 (git 2.56.0, this workstation)

Facts for `docs/slices/request-local-conflict-check.md` "To be measured". Each line: what was run, what it showed.

## git merge-tree (throwaway repo in a temp dir: base, `x` conflicting with `main`, `y` clean)

- `git merge-tree --write-tree --quiet main x` → exit 1; `git merge-tree --write-tree --quiet main y` → exit 0.
  `git count-objects` before and after both: 12 objects, unchanged. **`--quiet` writes no objects.**
- Without `--quiet`: clean merge 12 → 13 objects, conflicting merge 13 → 15 objects (unreferenced tree/blobs).
- `--stdin` (one process, one `<branch1> <branch2>` per line) works: per merge a NUL-separated record whose first
  field is `1` clean / `0` conflict, then the tree id, conflicted stages, messages; it writes objects like the plain form.
- `--stdin --quiet` → exit 128 (refused). So: either one `--quiet` process per pair (no objects) or one `--stdin`
  process for all pairs (unreferenced objects). The design picks and justifies.
- `--quiet` is in git-scm.com's `git-merge-tree` docs for 2.50.0 (web search); the exact first version is for the design to pin.
- `git merge-tree -h` lists `--merge-base <tree-ish>`, `-X <option>`, `--allow-unrelated-histories`.

## git fetch

- `git fetch -h` (2.56) lists `--[no-]write-fetch-head`, `--refmap`, `--[no-]auto-maintenance`, `--refetch`.
- `crates/gitio/src/fetch.rs:10-34`: `Repo::fetch_without_refs(remote, refspecs, timeout)` already runs
  `fetch --no-tags --no-write-fetch-head --no-recurse-submodules --no-auto-maintenance --refmap= --quiet
  --end-of-options <remote> <refspecs>` with no prompts and a deadline (`FETCH_TIMEOUT` 120 s); refspecs without a
  destination write no ref. `fetch_branches` (:39-54) is the other one, writing `refs/remotes/<remote>/<b>` (the
  resolve flow, plan #139/#142). `open.rs` (#132) uses `fetch_without_refs`. Rule 6's fetch = the existing
  `fetch_without_refs`; no new fetch rule.

## git ls-remote against gitlab.com

- `git ls-remote https://gitlab.com/gitlab-org/gitlab-runner.git refs/heads/main 'refs/merge-requests/600*/head'`
  → 1.1 s wall, printed `refs/heads/main` and `refs/merge-requests/6008/head`, `.../6009/head`: GitLab advertises
  merge-request head refs to `ls-remote`, and one call can carry branch and glob patterns together.

## How list results reach the page today

- `src-tauri/src/merge_requests.rs:7,81-100,222-227`: the list command takes a `tauri::ipc::Channel<ListMessage>` and
  sends each page as it arrives (`forward_page`, `send`). Late local results can travel on the same channel.
- `docs/architecture.md` §3.9: `yamt-merge-requests` has "no `Mutex`, nothing cached"; the run-long per-pair memory
  (rule 7) needs a home that respects that, or the design states the amendment.

## Cost of one merge-tree on a mid-size repository

- Pending: a bare clone of gitlab-runner, `--quiet` merges of two merge requests and of a two-year-old commit
  against `main`; appended below when it finishes.
