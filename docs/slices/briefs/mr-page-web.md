# Slice MrPageWeb — click a merge request's row to open it on GitLab

Board "Merge-request row opens in the browser" row 2. Owner #1981: "in the MR list I want an entry to be clickable and
open the MR in the user's browser". Decision: `docs/plan.md` §2 #137 (read it; it amends #133). Your base contains the
committed `MrPageRust` patch and the regenerated `frontend/src/ipc/bindings.ts`: `JobPage` is now `WebPage`,
`JobOpened` is `PageOpened`, `openJobPage` is `openPage`, and `MergeRequestRow` has `page: WebPage | null` (read the
bindings; they are the contract). Until you finish, the frontend does not type-check: the rename is yours to carry
through every caller.

## Target

Owned: `frontend/src/ipc/MergeRequestSource.ts`, `frontend/src/ipc/domain.ts`, `frontend/src/ipc/index.ts`,
`frontend/src/ipc/mergeRequestDomain*.ts`, `frontend/src/ipc/tauriMergeRequests*.ts`,
`frontend/src/ipc/fixtureMergeRequest*.ts`, `frontend/src/ipc/AGENTS.md`, `frontend/src/ui/MergeRequestRow.vue`,
`frontend/src/ui/CiStatusBox.vue`, `frontend/src/ui/MergeRequestsView.vue`, `frontend/src/ui/mergeRequests*.ts`.
Read-only: everything else, `bindings.ts` above all (generated). `frontend/src/mergeRequests/**` stays framework-free
(its fence) and needs no change unless a pure rule moves there; say so if it does.
Non-goals: links anywhere else (threads, AI answers, Markdown stay text, #112/#115); a context menu; any change to the
open-changes button's behaviour.

## Contract (fixed)

- `domain.ts`: the brand `WebPage = string & { readonly __brand: "WebPage" }` and `isWebPage` replace `JobPage` and
  `isJobPage` (same https rule); `ipc/index.ts` exports `WebPage` and `PageOpened` in place of the old names.
- `MergeRequestSource.openPage(page: WebPage): Promise<SourceResult<PageOpened>>` replaces `openJobPage`; the
  converted row type carries `page: WebPage | null` (converted and checked in `mergeRequestDomain.ts` like a job's).
- The fixture source (`?mr=` scripts) gives every row a page under its `ORIGIN`
  (`<ORIGIN>/-/merge_requests/<iid>`) and logs an open as `mergeRequests.fixture_page {"page": …}` (replacing
  `fixture_job`) for both kinds of page.
- No old name (`JobPage`, `isJobPage`, `JobOpened`, `openJobPage`, `openJob`, `jobProblem`, `fixture_job`) is left
  where it now covers both kinds of page: a clean rename, no alias.

## Behaviour (owner's request + #137)

1. A row whose `page` is not null: a click anywhere on the row opens the merge request's page in the browser, except
   a click on its CI box (icon or box) and on its open-changes button, which keep exactly their current actions and do
   not also open the page. The row shows it is clickable (pointer cursor and the list's hover background).
2. Keyboard: the title is a button in the tab order, its accessible name and tooltip "Open !12 on GitLab" (the
   number from the row); Enter and Space open the page. The full title stays readable (truncated text keeps its full
   title on hover as today).
3. A row whose `page` is null (GitLab not on https): no pointer, no hover, the title is plain text, a click does
   nothing.
4. The answer: `opened` → nothing shown; `notOffered` / `failed` → the page's existing one problem line (today's job
   problem bar in `MergeRequestsView.vue`, dismissable as now), worded for what was clicked: for a merge request
   "This merge request's page was not listed by GitLab, so yamt did not open it." and "Could not open the browser:
   <message>"; a job keeps its current sentences. A failed call reports through the store's problem path as a job's
   does today. One problem line, one store field, one text function per answer kind (vision 2): not a second bar.

## Change

Rename through the ipc layer and its tests; add the row's page; the fixture data; then the row, the store slice
(`ui/mergeRequests.ts`) and the texts (`ui/mergeRequestsText.ts`). Pure tests for the text and the store's answer
handling (`mergeRequests.test.ts` style, including which page reached `openPage` for a row click vs a job click);
conversion tests for a row's page (an `http` page refused as a job's is).

## Acceptance

- `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test` pass (paste summaries).
- `grep -rn "JobPage\|isJobPage\|JobOpened\|openJobPage\|jobProblem\|fixture_job" frontend/src` → nothing.
- **Fixture page in WebKit** (`just app-session start-fixture --name <n> --diff --mr list`, open the merge-request
  page): click a row's title area → the log has `mergeRequests.fixture_page` with that row's
  `…/-/merge_requests/<iid>`; click a row's empty middle (between the title and the counts) → the same for that row;
  click the open-changes button → its current fetching state, no `fixture_page` line; click a failed job in a CI box →
  the job's page logged, not the row's; Tab to a title and press Enter → that row's page logged. Screenshot of a
  hovered row.
- **Real app** (debug build, `skill://verification`): `scripts/range-repo.sh /tmp/yamt-mrweb-range`, then
  `just app-session start-app --name <n> --range main...feature --repo /tmp/yamt-mrweb-range --glab merge-requests`,
  open the merge-request page, click a row → `<session>/glab/opened.log` gains
  `https://gitlab.example/…/-/merge_requests/<iid>` for that row; a job click still writes its job address. Stop the
  session and remove `/tmp/yamt-mrweb-*`.
- `just mutants HEAD` per SP11.

## Skills

`skill://ts-conventions`, `skill://vue-conventions`, `skill://ipc-contract`, `skill://verification`.
