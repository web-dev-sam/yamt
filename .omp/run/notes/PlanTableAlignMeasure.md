# Table alignment — what gitlab.com writes on a cell (orchestrator, 2026-11-05)

Read-only GraphQL through `glab api graphql` on gitlab.com.

- `POST /markdown` (preview): `align="left|center|right"` on every `th`/`td` (`PlanFastPreviewCorpus.json` `table_align`).
- `descriptionHtml` of issues: `align=` too. 1,500 recent issues of gitlab-org/gitlab, gitlab-com/www-gitlab-com and
  gitlab-org/gitlab-runner, 121 with a table; aligned cells in gitlab-org/gitlab#637995 (`<th align="center">`,
  `<td align="center">`), www-gitlab-com#35539/#35526/#34873 (`align="right"`), gitlab-runner#40235 (`right`),
  #39379 (`center`). No `style="text-align: …"` on any cell.
- `descriptionHtml` of merge requests: 800 recent gitlab-org/gitlab MRs, 241 with a table, none aligned; the
  playground `samubr/glab-yamt-playground` has no table. MR descriptions and note `bodyHtml` use the same rendering
  as issue descriptions `[INFERENCE]`.
- gitlab-org/gitlab !200000, !267727, !50000 (named as the sources of `tests/glab/mr-description/graphql-description-52.json`)
  hold no aligned cell: that file's `style="text-align: …"` cells were not measured.

Decision (vision 5, boring): the reducer reads the `align` attribute as GitLab writes it now and keeps reading the
`text-align` style GitLab's sanitizer allows (`sanitization_filter.rb` `TABLE_ALIGNMENT_PATTERN`, older or
self-managed renderings); the fake glab's !52 table takes the measured `align=` form.
