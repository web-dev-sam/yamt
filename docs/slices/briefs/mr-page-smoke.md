# Smoke pass MrPageSmoke — a merge request's row opens its GitLab page

Board "Merge-request row opens in the browser". Owner #1981; `docs/plan.md` §2 #137. Tree at `0b71c37` (Rust:
`4389bbb`, `7bde4c5`; window: `0b71c37`). Recipes only (VF11 smoke); no `just check`, no mutation run.

## Steps

1. **Fixture page, WebKit** (`just app-session start-fixture --name <n> --diff --mr list`), open the merge-request
   page, read the console log lines `mergeRequests.fixture_page`:
   a. click a row's title → one line with that row's `…/-/merge_requests/<iid>`;
   b. click a row's empty middle (right of the created time, left of the counts) → one line for that row;
   c. click the discussions or approvals count of a row → one line for that row (part of the entry);
   d. click a row's open-changes button → its fetching state, no `fixture_page` line; while it is still fetching
   (the fixture pauses), click the disabled button again → no `fixture_page` line;
   e. hover a CI icon, click a failed job in the box → only the job's page logged; click the CI icon itself → no line;
   f. Tab to a title, press Enter → that row's page logged once;
   g. hovered row screenshot: pointer cursor, hover background.
2. **Real app** (debug build): `scripts/range-repo.sh /tmp/yamt-mrsmoke-range`, then
   `just app-session start-app --name <n> --range main...feature --repo /tmp/yamt-mrsmoke-range --glab merge-requests`;
   open the merge-request page; click a row → `<session>/glab/opened.log` gains that row's
   `https://gitlab.example/…/-/merge_requests/<iid>`; a failed job click writes its job address; no problem line.
   Stop the session; remove `/tmp/yamt-mrsmoke-*`.

## Report

`smoke` per `skill://verification`: each step, observed lines verbatim, pass/fail.
