# Slice ci-job-log-state — the window's one shown log, its source call, the remembered search texts, the fixture's logs

Feature: CI job log (request `docs/slices/request-ci-job-log.md` rules 2, 3, 7, 9; design
`docs/slices/briefs/ci-job-log-design.md` option A, §1.10, §2.1–2.4; proposed plan §2 #158, #160). Needs
`ci-job-log-rust` landed and `just bindings` run (`Generated.JobLog`, `Generated.JobLogReply`, `commands.readJobLog`)
and `ci-job-log-core` landed (`jobLogView`, `JobLogView`). Runs beside `ci-job-log-palette`.

## Target

Owned: `frontend/src/ui/mergeRequestJobLogs.ts` (new), `frontend/src/ui/mergeRequestJobLogs.test.ts` (new),
`frontend/src/ui/mergeRequests.ts`, `frontend/src/ui/mergeRequests.test.ts`, `frontend/src/ipc/MergeRequestSource.ts`,
`frontend/src/ipc/mergeRequestDomain.ts`, `frontend/src/ipc/index.ts`, `frontend/src/ipc/tauriMergeRequests.ts`,
`frontend/src/ipc/tauriMergeRequests.test.ts`, `frontend/src/ipc/fixtureMergeRequests.ts`,
`frontend/src/ipc/fixtureMergeRequests.test.ts`, `frontend/src/ipc/fixtureMergeRequestData.ts` (export `ORIGIN` only),
`frontend/src/ipc/fixtureMergeRequestLogs.ts` (new), `frontend/src/ipc/fixtureMergeRequestLogs.test.ts` (new),
`frontend/src/ipc/AGENTS.md`.

Read-only: everything else — `frontend/src/ipc/bindings.ts` (generated, PM4), `frontend/src/mergeRequests/**` (the
core's; use its exports), every `.vue` file, `ui/mergeRequestsText.ts`, `ui/problem.ts`, `ui/problemText.ts`,
`ui/useShiftHeld.ts`, `ui/keyHold.ts`, `ui/useHoverBox.ts` (the page slice's), `ui/windowStorage.ts` (reuse
`storedRecord`), `ui/mergeRequestRerequests.ts` (the pattern), `frontend/scripts/**` (the palette fence must pass on
the fixture's logs), `ui/AGENTS.md` and `docs/**` (put `ui/` lines in `deviations_from_brief`; the page slice writes
them). After this slice `pnpm -C frontend typecheck` is clean (nothing in the page uses the new names yet).

Non-goals: any rendering, Shift, search matching (the page's); the stored texts' UI; a log kept in the window across
jobs (Rust keeps logs for the run, #158: re-asking a log is one IPC call and no glab run); reporting a failure to the
problems bar (the box shows it, design §2.3).

## Contract

**Source** (`ipc/MergeRequestSource.ts`, beside `rerequestReview`):

```ts
/** A failed job's log, read only when this window's list offered `page` (plan §2 #158). */
readJobLog(page: WebPage): Promise<SourceResult<JobLogReply>>;
```

`ipc/mergeRequestDomain.ts`: `export type JobLogReply = Readonly<Generated.JobLogReply>;` (no conversion: `text` is
the raw log, `cut` a boolean; `index.ts` exports it). `tauriMergeRequests.ts`: `async readJobLog(page) { return
toResult(await commands.readJobLog(page)); }`.

**State** (`ui/mergeRequestJobLogs.ts`; `MergeRequests` becomes `RowActions & Rerequests & JobLogs & Shown & {…}`,
spread in `createMergeRequests` as `...createJobLogs({ source: deps.source, storage: deps.storage })`, as
`createRerequests`):

```ts
export type LoggedJob = { readonly name: string; readonly page: WebPage };
export type JobLogLoad =
  | { readonly kind: "loading" }
  | { readonly kind: "shown"; readonly view: JobLogView; readonly cut: boolean }
  | { readonly kind: "refused"; readonly reply: Exclude<JobLogReply, { readonly kind: "log" }> }
  | { readonly kind: "failed"; readonly cause: ProblemCause };
export type ShownJobLog = { readonly job: LoggedJob; readonly load: JobLogLoad };
export type JobLogs = {
  /** The window's one log box: null when none is open. */
  readonly jobLog: Readonly<ShallowRef<ShownJobLog | null>>;
  /** Shows `job`'s log: the same page while loading or shown changes nothing; else loading, then the reply. */
  showJobLog(job: LoggedJob): Promise<void>;
  closeJobLog(): void;
  /** The search text remembered for a job of this name ("" when none). */
  jobSearch(name: string): string;
  /** Remembers `text` for every job of this name, in every repository; "" forgets it. */
  setJobSearch(name: string, text: string): void;
};
export function createJobLogs(deps: {
  readonly source: MergeRequestSource;
  readonly storage?: StorageLike;
}): JobLogs;
```

Rules:

1. `showJobLog(job)`: when `jobLog.value?.job.page === job.page` and its load is `loading` or `shown`, return (the
   page's "Shift over the shown job does nothing"); a `refused` or `failed` one is asked again (their words say
   "press Shift over the job again", and Rust keeps no failure, #158). Otherwise write a **new** entry `{ job, load:
   loading }`, `attempt(() => source.readJobLog(job.page))` (`ui/problem.ts`), and write the outcome only when
   `jobLog.value` is still that same entry object (identity: a reply for a job no longer shown, or after
   `closeJobLog`, is dropped).
2. Outcomes: `log` → `shown { view: jobLogView(reply.log.text), cut: reply.log.cut }` (parsed once here, so a
   remount of the box never parses again); any other reply → `refused { reply }`; a source failure → `failed { cause
   }`, nothing reported (the page shows `problemText` with the page slice's `jobLog` step).
3. One `log.info("mergeRequests.job_log_shown", { page, kind, lines, cut, ms })` per settled ask (`kind` the load's,
   `lines`/`cut` only for `shown`, `ms` from the ask to the parsed view): never the log's text (RK57). `log` from
   `../ipc` as `ui/aiClose.ts:1`.
4. Texts: `storedRecord("yamt.mergeRequests.jobSearches", "mergeRequests.job_searches_storage_failed", storage)`
   (`ui/windowStorage.ts:51-68`); `jobSearch` reads `entryAt(name)`, a non-string as `""`; `setJobSearch` with `""`
   calls `remove(name)`, else `set(name, text)`. No repository key (rule 7, design §1.10).

**Fixture** (`ipc/fixtureMergeRequestLogs.ts`, `createFixtureMergeRequests` gains `readJobLog` calling it after
`pause(LOG_PAUSE_MS)`, `LOG_PAUSE_MS = 400`, and `log.info("mergeRequests.fixture_job_log", { page })`):

```ts
/** The fixture's answer for a job page: a job page of the fixture's list gets a log or a scripted refusal; any other
 *  page `notOffered` (as Rust, #158). */
export function fixtureJobLog(page: WebPage): JobLogReply;
```

- A page `${ORIGIN}/-/jobs/<n>` with `n ≥ 9000` and `n % 10 === 0` (every `lint:docs`, `fixtureMergeRequestData.ts:137`)
  → `log`, `cut: false`, a short raw log (40–80 lines) built with escapes in code (`"\u001b[31m"`), containing: GitLab
  timestamp prefixes on every line (`2026-10-30T09:00:01.123456Z 00O `, one `00O+` continuation line), a
  `section_start:…:prepare_script[collapsed=true]\r\u001b[0K` header and its `section_end`, a progress line using
  `\r`, `\r\n` line ends, basic and bright colours, bold, a `38;5;208` and a `48;5;196` run, a truecolor
  `38;2;255;0;0` run, an OSC title `\u001b]0;title\u0007`, a line `<b>not bold</b> &amp; <script>x</script>`, blank
  lines, and the words `Error` and `error` on several lines (the search's case-insensitivity shows).
- `n % 10 === 1` (every `test:unit`) → `log`, `cut: true`, a long log: about 9,000 lines, at most 512,000 UTF-8 bytes,
  built once on first use and kept; coloured lines with timestamps, `FAIL`/`PASS` words, its last line `ERROR: Job
  failed: exit code 1`. Its first line is a whole line (Rust drops the line a cut lands in).
- Scripted refusals by job number, chosen among the failed rows other than the first (read
  `fixtureMergeRequestData.ts` `pipeline`/`PIPELINES` for which indexes fail; the job is `9000 + 10·index`): one row's
  `lint:docs` → `noLog`, its `test:unit` → `failed { message: "glab timed out" }`; another row's `lint:docs` →
  `notLoggedIn { detail: LOGGED_OUT_DETAIL }`, its `test:unit` → `glabMissing`. Name these iids as exported
  constants (`NO_LOG_IID`, `LOGGED_OUT_LOG_IID`) so the verify brief reads them in the test.
- No string in the file may contain `#` followed by 3, 4, 6 or 8 hex digits (the palette fence,
  `frontend/scripts/palette.ts:17-19`).

## Change

1. Source, domain alias, export, tauri method and test; fixture method, `ORIGIN` export.
2. `fixtureMergeRequestLogs.ts` and its test.
3. `mergeRequestJobLogs.ts` and its test; spread into `mergeRequests.ts`; `mergeRequests.test.ts`' full
   `MergeRequestSource` literal (`:147`) gains `readJobLog`, plus one test that the slice exposes the job-log calls.
4. `ipc/AGENTS.md`: `readJobLog`, the fixture's logs and refusals, `LOG_PAUSE_MS`.

## Acceptance

- Vitest (`pnpm -C frontend test -- src/ui/mergeRequest src/ipc`), each named for the bug it catches, at least:
  - `mergeRequestJobLogs.test.ts`: `a_job_shows_loading_then_its_parsed_log`, `a_reply_for_a_job_no_longer_shown_is_dropped`
    (ask A, ask B, A answers → B still loading; then B answers → B shown), `a_reply_after_close_is_dropped`,
    `the_same_job_while_loading_or_shown_asks_nothing`, `a_refused_or_failed_job_is_asked_again`,
    `every_reply_but_a_log_is_kept_as_refused`, `a_source_failure_is_shown_not_reported`,
    `the_log_is_parsed_once_per_ask` (the view's identity across reads),
    `a_search_text_is_remembered_per_job_name_for_every_repository` (two slices on one `StorageLike`, the stored JSON
    is `{ "test:unit": "fail" }`), `an_empty_search_text_forgets_the_name`, `a_stored_non_string_reads_as_empty`,
    `the_log_event_never_carries_the_text`.
  - `fixtureMergeRequestLogs.test.ts`: `every_listed_lint_job_has_its_short_coloured_log` (through `jobLogView`:
    coloured runs, no timestamp text, the markup line as written), `every_listed_unit_job_has_the_long_cut_log`
    (`cut`, UTF-8 bytes ≤ 512,000, ≥ 8,000 view lines), `the_scripted_rows_refuse_as_named` (the four replies by the
    exported iids' job pages), `a_page_that_is_no_listed_job_is_not_offered` (a merge-request page, job 9002, another
    origin).
  - `tauriMergeRequests.test.ts`: `readJobLog_calls_the_command_with_the_page_and_returns_its_reply`; `readJobLog`
    added to the "a %s failure comes back unchanged" table.
  - `fixtureMergeRequests.test.ts`: `a_job_log_is_logged_and_paused` (fake timers: nothing before 400 ms, the
    `mergeRequests.fixture_job_log` line).
- `pnpm -C frontend lint`, `typecheck` (clean), `test` (the palette and themes fence tests stay green on the new
  fixture file): summary lines.
- `just map-check` (PM6: new IPC method on the map) and `just arch-check`: summary lines.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://ipc-contract`, `skill://comment-policy`, `skill://risk-register` (proposed RK57),
`skill://verification`.
