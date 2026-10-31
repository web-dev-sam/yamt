# Slice MrDiffStats — row size from `diffStats`, so GitLab reports the true merge status

Found on the owner's GitLab playground (gitlab.com, `samubr/glab-yamt-playground`, filled by
`scripts/gitlab-playground.sh`) on 2026-10-31: every open merge request that merges clean showed "Has conflicts" and a
Resolve button. Measured with `glab api graphql` on that project (plan §2 #138):

- In a `project.mergeRequests` list, asking for `diffStatsSummary` (any of its fields, before or after) makes GitLab
  answer `detailedMergeStatus: "CONFLICT"` for merge requests that are `MERGEABLE` (`conflicts: false`,
  `mergeStatusEnum: CAN_BE_MERGED`). Without `diffStatsSummary` the same query answers `MERGEABLE`. A single
  `mergeRequest(iid:)` query is not affected.
- `diffStats { additions deletions }` (one entry per changed file) in the same list does not change the status, and
  the query's complexity score drops (27 → 25 on that project).

## Target

Owned: `crates/merge-requests/**`; the recorded answers `tests/glab/merge-requests/graphql-page-{1,2}.json`,
`tests/glab/merge-requests-timeout/graphql-page-1.json`, `tests/glab/mr-conflicts/graphql-page-1.json`;
`tests/glab/README.md` if it names the field. Read-only: everything else. No contract change: `ChangeSize`,
`MergeRequestRow.size` and the bindings stay as they are (`just bindings-check`).

## Change

1. The list query asks `diffStats { additions deletions }` instead of `diffStatsSummary { … }`.
2. `size` = the sums of `additions` and `deletions` over the entries, `files` = the number of entries (each saturating
   into `u32`, a negative count read as 0, as today). `diffStats` null or empty → `size: None`: GitLab sends no
   entries while it has not computed the diff yet, and unknown counts show nothing (request rule 1).
3. The four recorded pages answer `diffStats` lists that give the same sizes they give today (so every existing size
   assertion keeps its numbers); `!27` in `mr-conflicts` keeps no size (null or empty).
4. A test that pins the regression's cause: the list query text holds `diffStats` and not `diffStatsSummary`, with a
   comment citing this measurement (GitLab answers a wrong `detailedMergeStatus` beside `diffStatsSummary` in a list).
5. `AGENTS.md` of the crate: the field and why.

## Acceptance

- Unit tests: sums and file count over several entries; null and empty → `None`; a negative count → 0; the scenario
  pages parse to the same sizes as before.
- `cargo nextest run -p yamt-merge-requests` (hermetic prefix), `cargo clippy -p yamt-merge-requests --all-targets --
  -D warnings`, `cargo fmt --check`, `cargo nextest run -p yamt-app merge_requests`, `just bindings-check`: summary
  lines.
- One real run against GitLab: from `../glab-yamt-playground` (glab is logged in), run the crate's list query text
  with `glab api graphql` and paste each node's `iid detailedMergeStatus conflicts` and the size yamt computes: !2
  and !3 `MERGEABLE`, !1 `CONFLICT`, !4 `DRAFT_STATUS`.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://risk-register` (RK40), `skill://verification`.
