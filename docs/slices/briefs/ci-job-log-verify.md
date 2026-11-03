# Slice ci-job-log-verify — the gate, the WebKit fixture and the real app for the CI job log

Design: `docs/slices/briefs/ci-job-log-design.md` option A. Request acceptance: `docs/slices/request-ci-job-log.md`
"Acceptance" (`:70-80`). Proposed plan §2 #158–#161; proposed RK57–RK59. Recipes: `skill://verification`; windows
only on a private display, screenshots only from the session or the private display.

## Target

**Owned:** none (read-only commands; your scratch folder only).

**Read-only:** the whole tree.

**Needs:** `ci-job-log-rust` (with `just bindings` applied), `-core`, `-palette`, `-state` and `-page` committed.
**Smoke pass** (steps B–C, no `just check`) as soon as `-page` is committed, beside its reviewers. **Final pass** once
the docs keeper has named every new file in the project map (`just map-check`, PM6) and `read_job_log` /
`MergeRequestSource.readJobLog` in architecture and ipc-contract: `just check` once, then B–C.

**Non-goals:** the owner's GitLab playground check (below, for the orchestrator to hand on); fixing anything;
`just mutants`.

## Contract

Fixture `?mr=list` as `ci-job-log-state` built it: every failed row's `lint:docs` (job `9000 + 10·index`) has the short
coloured log, every `test:unit` (`+1`) the long cut one, `test:e2e` no page; the refusal rows are the iids exported by
`frontend/src/ipc/fixtureMergeRequestLogs.ts` (`NO_LOG_IID`: `lint:docs` no log, `test:unit` "glab timed out";
`LOGGED_OUT_LOG_IID`: `lint:docs` not logged in, `test:unit` glab missing); replies after 400 ms; the fixture logs
`mergeRequests.fixture_job_log` and `mergeRequests.fixture_page`. Scenario `tests/glab/ci-job-log/` as `ci-job-log-rust`
recorded it: !71 `phpunit` 302 (coloured), `lint` 303 (over 500 KB), `e2e` 304 (no trace), `docs` 305 (empty),
`deploy` (no page); !70 `phpunit` 312; !69 (fork) `phpunit` 310. Words (`ui/mergeRequestsText.ts`): "Open the log of
<name> on GitLab. Shift: show the log here", "Log of <name>", "Loading the log…", "Search the log", "N of M", "No
results", "Earlier lines are on GitLab.", "Open the whole log on GitLab", "GitLab has no log for this job.", "This
job's log was not listed by GitLab, so yamt did not read it.", "… then press Shift over the job again.", "Could not
read the log: <message>".

## Change (the steps)

**A. Gate (final pass only).** `just check` → pass, or the failing recipe and its first 30 lines.

**B. WebKit fixture.** `just app-session start-fixture --name cl --diff --mr list --size 1600x1000`; open the merge
requests page; `hover`, `press … --x11`, `type --x11`, `click`, `scroll`, `read <js>`, `shot`, `stop`.

1. Hover the first failed row's CI icon, then its `lint:docs` job: the tip reads "Open the log of lint:docs on GitLab.
   Shift: show the log here"; the job button has `aria-keyshortcuts="Shift"`.
2. `press Shift --x11`: "Loading the log…", then the log box left of the CI box (`read` both boxes'
   `getBoundingClientRect()`: the log's right edge = the CI box's left edge, tops equal, unless clamped), scrolled to
   its end (`scrollTop + clientHeight ≥ scrollHeight − 1`), focus in "Search the log"; coloured runs (`read` the
   computed `color` of a red run ≠ the box's text colour); no timestamp text and no `section_start` text in
   `innerText`; the progress line shows its last state only; `<b>not bold</b> &amp; <script>x</script>` shows as
   written (no `b` or `script` element in the box).
3. With the pointer moved over `test:unit` (`hover`), `type --x11 Error`: the same log stays (no second
   `mergeRequests.fixture_job_log` line), the count reads "N of M" with N = M (the last match current), case-insensitive
   (matches on both `Error` and `error` lines).
4. Enter steps forward and wraps from M to 1; Shift+Enter backwards and wraps from 1 to M; the current match is centred
   (its rect's middle within 1 line of the scroller's middle, unless at an end). Type `zzzq`: "No results", the scroll
   position unchanged.
5. Escape: the log closes, focus on `lint:docs`'s button, the CI box still open; Escape again: the CI box closes.
6. Remembered text: open `test:unit`'s log on the first failed row, type `fail`; close; open `test:unit` on another
   failed row: the field holds `fail`, selected, its matches highlighted. Reload the page (`read "location.reload()"`,
   then reopen): still `fail`. Empty the field, close, reopen: empty; `read "localStorage.getItem('yamt.mergeRequests.jobSearches')"`
   has no `test:unit` key.
7. Switching: with `lint:docs`'s log open and focus in the field, hover `test:unit`, `press Shift --x11`: nothing new
   (open question 1). Click into the log text, hover `test:unit` again, `press Shift --x11`: `test:unit`'s log. It
   shows "Earlier lines are on GitLab." at its top; "Open the whole log on GitLab" logs `mergeRequests.fixture_page`
   with its page.
8. The refusal rows: each of the four sentences in the box; Shift again over a refused job asks again (a second
   `fixture_job_log` line); `test:e2e` (no page): Shift does nothing.
9. Click outside both boxes: both close. Reopen; a scroll inside the log keeps both open; a list scroll (`scroll` the
   list) closes both.
10. Timings: Shift to the long log's last line painted (≤ 1.5 s) and a one-letter query to highlights painted
    (≤ 250 ms), each measured three times with `read` of an async expression awaiting two `requestAnimationFrame`s.
    `shot` with a log open and a search shown in yamt Dark and yamt Light (Settings → Theme).

**C. Real app.** `scripts/local-conflicts-repo.sh <scratch>/cl`; `cargo tauri build --debug --no-bundle`;
`just app-session start-app --name cl --diff --dir <scratch>/cl --glab ci-job-log`; open the merge requests page.

1. !71 `phpunit` (302): Shift → the coloured log, at its end, focus in the field; search `fail` → highlights and count.
2. !70 `phpunit` (312): the field holds `fail`, its matches highlighted.
3. !71 `lint` (303): the cut notice, the button opens the job page (`<scratch>/cl/glab/opened.log` names it).
4. !71 `e2e` (304) and `docs` (305): "GitLab has no log for this job."; `deploy`: Shift does nothing.
5. !69 `phpunit` (310): its log; the fake glab log has an `argv:` line with `projects/sam%2Ftaskboard/jobs/310/trace`.
6. Reopen 302: no second `…/jobs/302/trace` line in the fake glab log.
7. No `trace` call for a job the page never asked; the app log has one `job_log` line per ask and never the log's
   text. `shot` in dark and light.

## Acceptance

Each step: pass/fail with the observed words, `read` results, timings, app-log and fake-glab log lines pasted
verbatim; screenshots' paths.

Owner check (hand on, not run): on the GitLab playground, run `scripts/gitlab-playground.sh` (it adds the "Failing CI"
merge request on `feature/failing-ci`; its pipeline needs a runner `[INFERENCE]`), open the page in the real app and
press Shift over `phpunit` and `long-log`: the lines, colours, collapsed section header and the cut notice match
GitLab's job page for the same job (except 256 colours, which show as the nearest theme colour, open question 2).
