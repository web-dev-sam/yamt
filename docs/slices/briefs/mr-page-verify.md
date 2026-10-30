# Final run MrPageVerify — a merge request's row opens its GitLab page

Board "Merge-request row opens in the browser" row 3. Owner #1981; `docs/plan.md` §2 #137. Tree at HEAD (feature base
`88086cb`; commits `4389bbb`, `7bde4c5`, `0b71c37`, `fc89cbf`, docs after). Final pass (VF11): no mutation run.

## Steps

1. `just check` (includes `map-check`).
2. Every smoke step of `docs/slices/briefs/mr-page-smoke.md` (fixture page in WebKit, real app with the fake glab and
   fake opener), with these two changes after the fix round: the title button's tooltip and accessible name are
   `Open !N on GitLab: <title>` (no inner element carries a `title`); on a row without a pipeline, a click on the empty
   CI slot opens that row's page.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts.
