# CI job log in the merge-request page — design

Request: `docs/slices/request-ci-job-log.md` (rules 1–9, owner answers #2154 press not hold, #2155 text per job name;
this design refines only details a rule names). Facts: `.omp/run/notes/PlanScoutCiLogFacts.md` (used as given; its
UNKNOWNs are closed in §1). Decisions that bind: plan §2 #128 (the page), #133/#137 (offered pages only, no CSP change),
#127 (one `search/` matcher), #154 (`useHoverBox`), #135 (the CI box closes on scroll); risks RK41, RK53. Citations
are to this working tree (base `2e898a4f`); GitLab sources are `gitlab-org/gitlab` master as read on 2026-11-03.

## 1. The request's "to be measured", closed

### 1.1 The job id

- `webPath` is `project_job_path(object.project, object)` (`app/graphql/types/ci/job_type.rb:290-292`): the job's
  **own** project and `Ci::Build#id`. The REST route finds the same row: `find_build!(params[:job_id])`
  (`lib/api/ci/jobs.rb`, `get ':id/jobs/:job_id/trace'`). So the digits after `/-/jobs/` are the REST `job_id`, and
  `WebPage::job` already refuses anything else (`web_page.rs:23-29`, `is_number` `:123-125`). No `id` in the list
  query (no complexity cost, `query.rs:59-61` unchanged).
- **New finding — forks.** `webPath`'s project is the job's own: a fork merge request's pipeline runs in the fork, so
  `projects/:fullpath/jobs/<n>/trace` (the target project, `project.rs:9-10`) answers 404 for it. The route therefore
  names the project from the page itself: `<origin><sub-path>/<group/project>/-/jobs/<n>` → `projects/<group%2Fproject>/
  jobs/<n>/trace`. The sub-path GitLab may be installed under is `Project.web_path` minus `/<full_path>`
  (`project.rs:12-20,57-62`), dropped from the front when present. glab passes an escaped path as is: its own example
  `glab api projects/gitlab-com%2Fwww-gitlab-com/issues` (`gitlab-org/cli` `internal/commands/api/api.go` v1.80.2).
- A trigger job (`Ci::Bridge`) has no `webPath` (`job_type.rb:291`), so no page and no log — already `page: null`.

### 1.2 The timestamp prefix in the raw trace

- The runner writes it into the stored log; `Stream#raw` returns `stream.read` unchanged, and the readers that need
  plain lines strip it themselves (`extract_coverage`: `line.slice!(0, TIMESTAMP_HEADER_LENGTH) if strip_timestamp`)
  (`lib/gitlab/ci/trace/stream.rb`). So `/trace` keeps it whenever the job ran with timestamps: on by default since
  GitLab 18.9, off with `FF_TIMESTAMPS: false` (docs `ci/jobs/job_logs` l. 168-209).
- Shape (`stream.rb:10-13`): `\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d{6}Z [0-9a-f]{2}[EO][+ ]`, exactly 32
  characters; `+` in column 32 marks a line continuing the previous one. GitLab decides "has timestamps" once, from
  the first line (`ansi2json/converter.rb` `handle_line`). A cut tail starts at a line start (§1.3), so its first line
  carries the prefix too.
- The Rust slice's step 1 reads one real failed job's trace head on gitlab.com (read-only) and pastes it
  `[INFERENCE until then: gitlab.com runners send the prefix]`; the parser handles both.

### 1.3 Memory, byte ranges, the cut

- **No byte range.** The API never reads a `Range` header: Rails answers `build.trace.raw` whole, or hands an archived
  log to Workhorse whole (`send_archived_trace_via_workhorse!`, `jobs.rb`). Master has `byte_offset`/`byte_limit`
  parameters (`byte_limit` ≤ `Stream::LIMIT_SIZE`), but the API docs list only `id` and `job_id` (docs `api/jobs`
  "Retrieve a log file for a job"), an older GitLab ignores them, and a tail needs the size first. Not used.
  Measured later (`CiJobLogRust`, 2026-11-03): gitlab.com does answer `Range: bytes=-1000` on `/trace` with 206 and
  the exact tail (Workhorse or object storage, not Rails). Kept as written: reading whole is bounded below, an empty
  log would meet a 416 instead of a 200, and older self-managed GitLab is unmeasured (vision 5). Owner may reopen.
- **Reading whole is bounded in practice.** gitlab-runner's `output_limit` defaults to 4096 KB (runner docs
  "advanced configuration"); GitLab's own maximum is 100 MB (docs `administration/cicd/limits` "Maximum file size for
  job logs"). `Glab::run` holds stdout (`glab.rs:22-33,89-92`): a 4 MB log costs 4 MB for a moment; a 100 MB one most
  likely ends at `GLAB_TIMEOUT` 20 s (`glab.rs:10`) as "glab timed out", which the box shows (rule 9). After the cut
  only ≤ 500 KB is kept. A streaming tail reader in `gitio` would serve one caller for a rare case (vision 5).
- **The cut is GitLab's.** `LIMIT_SIZE = 500.kilobytes` (512,000 bytes); `limit` seeks to the last 512,000 bytes and
  `readline`s, dropping the line it lands in even when it lands on a line start, only when the log is larger
  (`if last_bytes < size`) (`stream.rb` `limit`); the job page does exactly this (`app/models/ci/build_trace.rb`:
  `stream.limit`). Rust cuts the bytes the same way, then decodes them lossily (U+FFFD), so the window never sees
  half a UTF-8 sequence (the cut is after a `\n` byte).
- **Empty and missing logs.** Master answers `body trace || ''` for a job without a log (200, empty); the docs name
  404 for "Job not found or no log file". Both mean "no log" to the user. glab prints `glab: <message> (HTTP 404)`
  on an HTTP error and exits 1 (`tests/glab/README.md:55-58`, `crates/gitio/tests/glab.rs:133-134`): a failure whose
  line ends in `(HTTP 404)` is `NoLog`.

### 1.4 Where the colours are parsed, and what crosses the IPC

The raw cut text crosses as a `String` with a `cut` flag; the framework-free core parses it in TypeScript. Reasons:
the owner reads TypeScript (vision 1); the fixture page (`?mr=list`) then runs the same parser on raw fixture logs, so
the WebKit check exercises the real code (vision 2: one parser); the payload is the log itself (≤ 500 KB plus JSON
escapes), smaller than per-run JSON objects. Rust stays: offered check, route, fetch, cut, cache. The alternative
(Rust parses into styled lines) is option C.

### 1.5 Rendering cost and visible-only rendering

- Shape: ≤ 512,000 bytes ≈ 9–10k lines; most lines are one or two runs → ≈ 20–30k elements, rendered once per
  opened log. The page already renders up to 500 rows (`MAX_MERGE_REQUESTS`, `lib.rs:45`) of some 40 elements each in
  WebKit `[INFERENCE: the same order of DOM size works today]`. No virtualisation (variable wrapped heights, opening at
  the end, and copy-all of a selection would all need their own code, vision 5).
- Highlights do **not** re-render lines: the CSS Custom Highlight API (`CSS.highlights`, `Highlight`, `::highlight()`)
  paints `Range`s over the static text nodes. A broad query ("e": tens of thousands of matches) then costs one regex
  pass and one `Range` per match, no DOM change, and a selection the user made survives typing. `[INFERENCE: WebKit
  ships the API since Safari 17.2; WebKitGTK 2.54 (plan §2 #99) has it]` — the page slice's first step checks
  `typeof Highlight === "function"` in the WebKit fixture; if false, the slice stops and the orchestrator switches to
  option B.
- The page slice measures in WebKit (fixture, a ≤ 500 KB cut log): Shift-to-last-line-painted ≤ 1.5 s and a one-letter
  query to highlights painted ≤ 250 ms; either over budget is a finding for the design, not a narrowed acceptance.

### 1.6 Joining `useHoverBox`; reading the Shift press

- **Inside rule, one copy.** The log box is a DOM child of the CI box's `area` span (`CiStatusBox.vue:62-70`),
  `position: fixed` like the CI box (`:81-88`). Pointer enter/leave, `focusin`/`focusout` and the scroll filter all ask
  `area.contains` (`useHoverBox.ts:47-49,56-68,100-111`), so pointer or focus in the log box holds both boxes and a
  scroll inside does not close them, with no change to the rule. A click outside moves focus out (focusout with
  `relatedTarget` outside or null) while the pointer is outside → both close; a scroll outside closes the CI box
  (`:121-125`) and the CI box's close closes the log.
- **Escape order.** The log box handles Escape (closes itself, focuses its job, `preventDefault`); the event bubbles to
  the area, whose `keyPressed` (`useHoverBox.ts:70-76`) today closes on any Escape. One line changes: it ignores an
  Escape already `defaultPrevented`, as `MergeRequestsView.vue:86-90` and `ServerLogView.vue:85-90` already do. The
  second Escape (focus on the job button, inside the area) closes the CI box as today.
- **The press is a tap.** A keydown edge would open a log on Shift+Tab (keyboard users moving back through the jobs)
  and on Shift+click, then pull focus into the field. A Shift "press" is therefore Shift down then up with no other
  key and no pointer press between — what the acceptance calls "press and release Shift". It comes from the one
  Shift rule: `useShiftHeld.ts`'s `shiftHeldAfter` (`:14-27`) becomes `shiftAfter` over a small state
  (`up | held { alone }` plus a tap count) on `keyHold.ts`'s one listener set (`:17-55`), made generic over its
  state; `useShiftHeld()` keeps returning the held boolean for the filters, `useShiftTaps()` adds the count. The
  X11 quirk stays handled by key names (`:18-21`). `altHold.ts` passes its boolean rule unchanged.
- **Which job, and when not.** Over a job = the pointer is over its `<li>` (the wrapper, since WebKit sends no pointer
  events to a disabled button, `ui/AGENTS.md` "Hover"); else the job button with focus. Nothing opens when the CI box
  is closed, the job has no page, or focus is in a text field: `isTypingTarget` (`ui/rangeKeys.ts:26-42`, reused, not
  copied; PM10 forbids only the window roots, `windowFence.ts:10-17,70-84`). After opening, focus is in the search
  field, so Shift over another job types a capital (rule 1); switching by pointer first moves focus out of the field
  (a click in the log text — the scroller is focusable — or Escape). That consequence is in §6.

### 1.7 The search matcher

`search/`'s `matcherOf({ text, matchCase: false })` (`search/internal/match.ts:55-61`, exported by `search/index.ts:1`):
the text escaped, `giu`, hits per line in UTF-16 columns (`:20-50`) — rule 6's "plain text, case-insensitive" as the
window-wide search already defines it (plan §2 #127). The page calls it (ui may import `search/index.ts`); the core
(`mergeRequests/` imports no `src/` module, PM3) takes the hits as plain `{ line, from, to }` and maps them onto runs.
The core's `searched` (`mergeRequests/internal/search.ts:9-19`) is a `toLowerCase().includes` filter with no positions
(and `toLowerCase` can change a string's length), so it is not reused.

### 1.8 Colour tokens

- **16 tokens per theme**, `--color-ansi-{black,red,green,yellow,blue,magenta,cyan,white}` and
  `--color-ansi-bright-…`, in `style.css`'s `@theme` (yamt Dark) and every `themes/*.css` block (the themes fence
  requires every `--color-*` token in each block, `frontend/scripts/themes.ts:161-174`, and a source comment per line
  in the imported themes, `:186-196`). Tailwind makes `text-ansi-red` / `bg-ansi-red` from them.
- **Values from each editor's own terminal palette**, as #102 sourced the rest: VS Code `terminal.ansi*` (theme JSON
  or the registered defaults), WebStorm `CONSOLE_*_OUTPUT` keys, Zed `terminal.ansi.*` (`one.json`), Atom (no
  terminal: "gap", the One syntax hues of `colors.less`); yamt Dark/Light after WebStorm Islands (their headers).
- **Readable in every theme, with a detector.** Each foreground token must reach 4.5:1 (WCAG relative luminance)
  against its block's `--color-panel` — VS Code's own rule for its terminal ("increasing or reducing the luminance of
  the text's foreground color until a 4.5:1 contrast ratio is met", docs `terminal/appearance` "Minimum contrast
  ratio", the default). A value the editor ships below it is adjusted by that rule and its comment says so. The rule
  goes into `scripts/themes.ts` with its failing-path test (vision 3).
- **The 256 colours.** 0–15 are the 16 tokens; 16–255 (xterm's cube and grays) show as the **nearest of the 16** on
  xterm's default palette. Fixed xterm values cannot be readable on both dark and light panels, and a literal colour
  in a `.ts`/`.vue` file is refused by the palette fence (`frontend/scripts/palette.ts:17-19`). The reference triples
  are numbers used only to classify, never painted. Visible consequence (orange 208, `(255,135,0)`, shows as the
  theme's yellow, nearest `(205,205,0)`) is in §6.

### 1.9 GitLab's job page versus `ansi2html.rb`

The job page renders `Ci::BuildTrace` → `Gitlab::Ci::Ansi2json` (`app/models/ci/build_trace.rb`), not `ansi2html.rb`.
Where they differ, rule 4's first clause ("as GitLab's job page renders them") decides, except where rule 4 names a
detail:

| detail              | `ansi2html.rb`                                          | `ansi2json` (the job page)                                                                        | yamt                                                                                           |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| lone `\r`           | written as a character                                  | clears the current line (`scan_token(scanner, "\r")` → `clear!`)                                  | clears the line: a progress bar shows its last state                                           |
| section marker      | dropped in place                                        | dropped; a start or end ends a non-empty current line (`flush_current_line(false)`)               | as the job page                                                                                |
| bold foreground     | the light variant (`fg-l-*`, `:274-278`)                | no such rule (`ansi2json/style.rb`)                                                               | light variant: rule 4 names it; only 30–37 colours (as `ansi2html`: its regex skips `xterm-*`) |
| `109`               | background default                                      | foreground default (`on_109` sets `fg`)                                                           | background default (the code's meaning)                                                        |
| codes               | `on_<code>` methods: exact text, so `01` is nothing     | the same table                                                                                    | the same exact-text table                                                                      |
| `38;2;r;g;b`        | `38` consumes nothing; `2`, `r`, `g`, `b` read as codes | the same                                                                                          | the same (rule 4: no truecolor)                                                                |
| conceal (8)         | class `term-conceal`                                    | the same                                                                                          | shown as plain text (a hidden match could not be seen; decided in §2.4)                        |
| a line without text | `<br/>` (blank lines shown)                             | not emitted (`line.rb` `empty?`; `converter.rb` `flush_current_line` pushes non-empty lines only) | not shown, as the job page                                                                     |

Both: only `ESC [ … m` is applied; every other escape (`ESC ([@-_])(.*?)([@-~])`) is dropped; an escape cut off at a
line end ends the line's scan; timestamps stripped at line start, `+` lines joined; the style carries across lines.
yamt also drops other C0 control characters but tab (rule 4: "other control sequences … are not shown").

### 1.10 Remembered text

`storedRecord(key, warnEvent, storage)` (`ui/windowStorage.ts:51-68`) is a JSON map with `entryAt`/`set`/`remove`;
keyed by the job's name it is exactly rule 7: `yamt.mergeRequests.jobSearches = { [jobName]: text }`, an empty text
removed. Rule 7 says "per CI job name … for every merge request": one map for every repository (no repository key,
unlike #134 and #156). Two windows writing at once: the last write wins (#134).

## 2. What every option shares

### 2.1 Rust (`yamt-merge-requests`, `src-tauri`)

```rust
/// GitLab's job page shows at most this tail of a log (`Gitlab::Ci::Trace::Stream::LIMIT_SIZE`, 500 KiB).
pub const MAX_LOG_BYTES: usize = 500 * 1024;

/// A failed job's log as the window shows it.
pub struct JobLog { pub text: String /* colour codes kept; non-UTF-8 bytes as U+FFFD */, pub cut: bool }

#[serde(tag = "kind", rename_all = "camelCase")]
pub enum JobLogReply {
    Log { log: JobLog },
    NotOffered,                       // no list of this window sent that job page (or it is no job page)
    NoLog,                            // GitLab answered an empty log or 404
    GlabMissing,
    NotLoggedIn { detail: String },
    Failed { message: String },       // glab's last line, "glab timed out", or yamt's words
}

pub fn read_job_log(repository: &GitLabRepository, glab: Option<&Glab>, page: &WebPage) -> JobLogReply;
// src-tauri: MergeRequestState gains `job_logs: JobLogs` (Mutex<BTreeMap<WebPage, JobLog>>: the run's logs, a
// failure never kept); command `read_job_log(page: WebPage) -> Result<JobLogReply, IpcError>`.
```

### 2.2 The window's core (`frontend/src/mergeRequests/`)

```ts
type AnsiColour = "black" | "red" | … | "white" | "brightBlack" | … | "brightWhite";   // 16
type LogStyle = { foreground: AnsiColour | null; background: AnsiColour | null; bold; italic; underline; struck };
type LogRun = { text: string; style: LogStyle };          // text never empty
type LogLine = { runs: readonly LogRun[] };
type JobLogView = { lines: readonly LogLine[]; text: string };   // text = the lines' texts joined by "\n"
jobLogView(raw: string): JobLogView;
hitPlaces(view, hits: readonly { line; from; to }[]): readonly HitPlace[];   // where each hit starts and ends in runs
firstHit(count) / steppedHit(current, count, backwards) / hitCountText(current, count)
```

### 2.3 The page

- State (`ui/mergeRequestJobLogs.ts`, spread into the slice like `mergeRequestRerequests.ts`): the one shown log of the
  window — `{ job: { name, page }, load: loading | shown { view, cut } | refused { reply } | failed { cause } } | null`
  — the source call with a stale-reply guard (identity of the asked entry), and the remembered texts.
- `CiStatusBox.vue`: tracks the pointed and focused job, reads `useShiftTaps()`, renders `CiStatusJobLog.vue` beside the
  CI box when the shown job is one of its own, closes it when the CI box closes, focuses the job after Escape.
- `CiStatusJobLog.vue`: header (job name, search field, count), body (cut notice with "Open the whole log on GitLab",
  then the lines), its Escape/Enter/Shift+Enter keys, `useFollowEnd` for the end (ui/AGENTS.md: a new follower uses
  it), `useMenuPlacement` left of the CI box (`menuPosition` clamps, `menuPosition.ts:7-12`).

### 2.4 Details decided here (orchestrator level, proposed row #161; the owner may veto)

- Box 56rem wide × 36rem high, each at most the window less 2rem; its right edge on the CI box's left edge, its top
  on the CI box's top, then clamped; header `bg-panel-inline`, lines on `bg-panel` (the editor background the terminal
  palettes are made for), `font-mono`, `whitespace-pre-wrap`, `[overflow-wrap:anywhere]`, text selectable.
- Words: hover "Open the log of <name> on GitLab. Shift: show the log here"; box "Log of <name>"; "Loading the
  log…"; field "Search the log"; "3 of 17", "No results"; cut line "Earlier lines are on GitLab." with the button
  "Open the whole log on GitLab"; replies: no log "GitLab has no log for this job.", not offered "This job's log was
  not listed by GitLab, so yamt did not read it.", glab missing / not logged in as the list's sentences ending "then
  press Shift over the job again.", failed "Could not read the log: <message>"; an IPC failure as `problemText` with
  the step `jobLog` ("Could not read the job's log: …"), in the box.
- Shift over the job already shown does nothing while it loads or shows; a refused or failed load asks again (their
  words say "press Shift over the job again"). A failed fetch is not kept (Rust), so the next press asks GitLab again.
- Matches: `--color-search-match` (as `SearchResults.vue`); the current one `--color-primary` on `--color-on-primary`.
  The current match is scrolled to the middle of the box by `scrollTop` only (never `scrollIntoView`, which can move
  ancestors; `useFollowEnd.ts:10-11`).
- Conceal (SGR 8) shows its text; 256 colours as the nearest of 16 (§1.8); text per job name across repositories (§1.10).
- Decided after the smoke pass (#2179 #2180 #2185): the highlights hold only the matches on lines in view ± one
  screen (count and steps use all), since ~27k live ranges cost seconds per paint in WebKitGTK; a run with an ANSI
  background shows its text in the panel colour (≥ 4.5:1 by the palette rule); a refusal leaves no focus in the field,
  so Shift asks again. An OSC title shows its tail (`itle…`) exactly as GitLab's page does (§1.9).

## 3. Options

### Option A — raw tail over the IPC, the core parses, static lines with CSS highlights (recommended)

- **Structures.** §2 as written; the page keeps the rendered lines static and sets two `Highlight`s
  (`job-log-match`, `job-log-current`) from `hitPlaces`.
- **Files.** Rust: `crates/merge-requests/src/{lib.rs, job_log.rs (new), web_page.rs}`, `tests/job_log.rs` (new);
  `src-tauri/src/merge_requests.rs`, `merge_requests/job_logs.rs` (new), `merge_requests/tests/job_log.rs` (new),
  `commands.rs`; `scripts/fake-glab/glab`, `tests/glab/ci-job-log/` (new), `tests/glab/README.md`,
  `scripts/gitlab-playground.sh`. Core: `mergeRequests/internal/{jobLog,ansiColours,jobLogSearch}.ts` (new) and tests,
  `index.ts`, `AGENTS.md`. Palette: `style.css`, the nine `themes/*.css`, `scripts/themes.ts` (+ test). State:
  `ui/mergeRequestJobLogs.ts` (new), `ui/mergeRequests.ts`, `ipc/{MergeRequestSource,tauriMergeRequests,
  fixtureMergeRequests,mergeRequestDomain,index}.ts`, `ipc/fixtureMergeRequestLogs.ts` (new). Page:
  `ui/CiStatusBox.vue`, `ui/CiStatusJobLog.vue` (new), `ui/mergeRequestLogLook.ts` (new), `ui/mergeRequestsText.ts`,
  `ui/problem.ts`, `ui/problemText.ts`, `ui/useHoverBox.ts`, `ui/useShiftHeld.ts`, `ui/keyHold.ts`, `ui/altHold.ts`,
  `scripts/app-session/keys.ts` (a lone `Shift` key for the smoke runs).
- **Risks.** WebKitGTK without the Highlight API (checked first; fallback B). A 100 MB log times out (shown, rule 9).
  The fork route needs read access to the fork's jobs (else 403/404, shown). Highlight ranges need one text node per
  run (the template renders `{{ run.text }}` alone in its span; a test pins the core's run ↔ text mapping).
- **Tests.** Rust: cut rule (at, over, landing on a line start, no line break, invalid UTF-8), route (same project,
  fork, sub-path, a merge-request page), 404/empty → no log, glab missing / logged out, offered-only before any glab,
  one fetch per run, failures not kept. Core: every row of §1.9's table, timestamps and `+` joins, sections, `\r`,
  SGR table, 256 → 16, markup stays text, `hitPlaces` at run boundaries, wrapping steps. Palette: the contrast rule
  and its failing path. State: stale replies, same-job press, remembered text set/forget. Page: Shift tap rule (Shift+Tab,
  Shift+click, capitals, repeat, blur), Escape order; WebKit fixture and real app.
- **Visions.** 1 (parser in TypeScript), 2 (one parser for fixture and app, one matcher, one Shift rule, one inside
  rule, one palette), 3 (offered check in Rust, contrast detector, themes fence), 5 (no dependency, no gitio change).

### Option B — as A, but matches as `<mark>` runs re-rendered per query

- **Structures.** The core splits runs at hits (`markedLine(line, hits, current) → segments`); each line memoised
  (`v-memo` on its hit list); no Highlight API.
- **Files.** As A; the core gains the splitter (`internal/jobLogMarks.ts`), the page renders `<mark>` segments and
  loses the `Range` loop.
- **Risks.** A broad query re-renders most of ~10k lines and inserts tens of thousands of elements per keystroke
  `[INFERENCE: hundreds of ms to seconds in WebKitGTK]`; re-rendering drops a text selection while typing.
- **Tests.** As A, plus the splitter.
- **Visions.** 1 (`<mark>` as `SearchResults.vue:211` does) against rule 6's typing feel. The fallback if 1.5's check fails.

### Option C — Rust parses colours; styled lines cross the IPC

- **Structures.** `JobLog { lines: Vec<LogLine { runs: Vec<LogRun { text, style: LogStyle } > }>, cut }` with Rust enums
  for colours; the window renders as A.
- **Files.** As A, with the parser in `crates/merge-requests/src/job_log/ansi.rs`; the fixture needs pre-parsed lines
  (or a second parser in TypeScript for raw fixture logs).
- **Risks.** The owner reads the colour rules in Rust (vision 1); per-run JSON is several times the text; the fixture
  page would test generated data, not the parser (or two parsers, vision 2).
- **Visions.** 4 (Rust enums) against 1 and 2.

## 4. Recommendation

**Option A.** The log crosses once, as text, only for a job a list offered; the colour rules are TypeScript the owner
reads and the WebKit fixture runs; highlights never touch the DOM, so 500 KB stays cheap to search; Shift, the inside
rule and the matcher each stay single. Cost: five implementer runs — Rust (~15 files, ~1,000 lines with the scenario),
core (~7 files, ~800 lines), palette (~12 files, ~350 lines, sourced values), state (~14 files, ~700 lines), page (~20
files, ~1,000 lines) — in three waves, plus the verifier. No CSP change, no dependency, no `gitio` change.

### Proposed plan §2 rows (DR5: the orchestrator records them; numbers as free at commit time)

| #   | **Decision**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Rejected alternatives & why                                                                                                                                                                                                                                                                               | Vision  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 158 | **A failed CI job's log is read through the app, for an offered job page only** (owner #2154–#2155; request `docs/slices/request-ci-job-log.md` rules 8–9; design `briefs/ci-job-log-design.md` option A; amends #133's "one case" with a read of the same offered pages). `read_job_log(page)`: not in `pages` or not a `/-/jobs/<n>` page → `NotOffered` before any glab; else glab, login, project; `glab api projects/<the page's own project path, / as %2F>/jobs/<n>/trace` (`webPath` = `project_job_path(job.project, job)`: the number is the REST id, the project the job's own, a fork's for a fork's pipeline); the body read whole, then GitLab's `Stream#limit`: over 512,000 bytes the last 512,000 from after the next `\n`, `cut`; lossy UTF-8; empty or HTTP 404 → `NoLog`; a `Log` kept per page for the run in `MergeRequestState.job_logs`, failures never | GraphQL `CiJobTrace.htmlSummary` (≤ 100 lines, HTML); a `Range` header (the API never reads one); `byte_offset`/`byte_limit` (undocumented, master only, needs the size); a streaming tail in `gitio` (one caller; runner logs default ≤ 4 MB); `projects/:fullpath` (a fork's jobs are not the target's) | 3, 4, 5 |
| 159 | **The window turns the raw log into styled lines with GitLab's job-page rules** (`mergeRequests/` `jobLogView`): `Ansi2json`'s tokens (timestamp prefix stripped, `+` lines joined; section markers dropped, a start or end ending a non-empty line; lone `\r` clears the line; only `ESC[…m` applied, by GitLab's exact `on_<code>` table; no truecolor; a line without text not shown), `ansi2html`'s bold → light for 30–37; 256 colours as the nearest of the 16 on xterm's palette; conceal shown; C0 controls but tab dropped; text only, never markup. 16 tokens `--color-ansi-*` per theme from each editor's terminal palette, ≥ 4.5:1 against `--color-panel` (VS Code's minimum contrast ratio), enforced in `scripts/themes.ts`                                                                                                                                     | parsing in Rust (option C: the owner reads TypeScript; the fixture would test another parser); fixed xterm colours for 16–255 (unreadable on light panels; literals refused by the palette fence); GitLab's HTML                                                                                          | 1, 2, 3 |
| 160 | **The log box** (rules 1–7): opened by a Shift tap — down and up with no other key and no pointer press between (`useShiftHeld.ts` `shiftAfter` on `keyHold.ts`'s one listener set, `useShiftTaps`) — over a failed job's row or on its focused button, the CI box open, focus not in a text field (`isTypingTarget`); a DOM child of the CI box's hover area, so `useHoverBox`'s one inside rule holds both; an Escape handled inside is not the hover box's (`defaultPrevented`); left of the CI box, tops level, clamped; static lines; matches through the CSS Custom Highlight API from `search/` `matcherOf` (case-insensitive), the first current the last; the field's text per job name in `yamt.mergeRequests.jobSearches` (`{ [name]: text }`, every repository), empty removes                                                                                      | a keydown edge (Shift+Tab and Shift+click would open a log); a second Shift listener; `<mark>` re-rendering (option B: DOM churn on broad queries); a teleported box with its own inside rule; per-repository texts (rule 7 says per name)                                                                | 1, 2, 4 |
| 161 | **Defaults decided with the job-log design** (orchestrator, OR13; the owner may veto): §2.4 of the design (sizes, words, colours of matches, same-job press, failures not kept, conceal shown, 256 → nearest of 16, texts across repositories)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                                                                                                                                                                                                                                                                                         | 1       |

### Risks for the register (`skill://risk-register`, next free id RK57)

| id   | risk                                                                                                                               | owner                                                                                                                                                                                                                    | proving test                                                                                                                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RK57 | the app reads a log for a page no list offered (or a merge request's page), or the window interprets log text as markup            | `yamt-merge-requests` `read_job_log` (job page check) + `src-tauri` `merge_requests/job_logs.rs` (`pages` before any glab) + core `jobLogView` (text runs only) + `CiStatusJobLog.vue` (text interpolation, no `v-html`) | `a_job_no_list_offered_gets_no_log_and_runs_no_glab`, `a_merge_request_page_is_not_a_job_and_runs_no_glab`, `markup_in_a_log_stays_text`, WebKit fixture step "markup line" |
| RK58 | a log colour unreadable in a theme                                                                                                 | `style.css`, `themes/*.css`, `scripts/themes.ts` + `scripts/contrast.ts` (`ansi-contrast`)                                                                                                                               | themes "the real source tree has no … violations", `an_ansi_colour_below_4_5_to_1_against_its_panel_is_reported`                                                            |
| RK59 | a Shift that is part of a chord (Shift+Tab, Shift+click, a capital) opens a log, or a capital typed in the log's field switches it | `ui/useShiftHeld.ts` `shiftAfter` + `CiStatusBox.vue` (`isTypingTarget`)                                                                                                                                                 | `a_shift_with_another_key_or_a_pointer_press_between_is_no_tap`, WebKit fixture step "capitals"                                                                             |

### Shared edits for the orchestrator (no slice owns them)

- `just bindings` after `ci-job-log-rust` lands, before `ci-job-log-state` starts (`JobLog`, `JobLogReply`,
  `commands.readJobLog`). No frontend file uses them before the state slice, so the typecheck stays green.
- The docs keeper (`skill://orchestrate` §6): plan rows #158–#161; architecture §3.9 (`job_log.rs`, `MAX_LOG_BYTES`,
  `JobLogReply`), §3.5 (`MergeRequestState.job_logs`), §4 and `skill://ipc-contract` (`read_job_log`;
  `MergeRequestSource.readJobLog`; PM6 `map-check`), §5.1 state rows (the run's logs: `src-tauri`
  `merge_requests/job_logs.rs`; the shown log and the remembered texts: `ui/mergeRequestJobLogs.ts`; Shift taps:
  `ui/useShiftHeld.ts`), §5.4 (the log box, the Shift tap; amend the "Held" paragraph, architecture.md:1745-1750);
  `skill://project-map/tree.md` rows for every new file (`mergeRequests/internal/jobLog.ts`, `ansiColours.ts`,
  `jobLogSearch.ts`, `ui/CiStatusJobLog.vue`, `ui/mergeRequestJobLogs.ts`, `ui/mergeRequestLogLook.ts`,
  `ipc/fixtureMergeRequestLogs.ts`) and `state.md` rows for the three states above; RK57–RK59; the
  `deviations_from_brief` lines no slice could write (`ipc/AGENTS.md` is the state slice's, `ui/AGENTS.md` the page
  slice's, which also writes the state slice's `ui/` lines); CHANGELOG "Added" (the log box, Shift, search,
  remembered text) and "Changed" (a job's hover names Shift).
- No CSP change (`tauri.conf.json:14`): the log arrives through IPC.

## 5. Slice graph

| wave | brief                                   | owner     | needs                                             | beside      |
| ---- | --------------------------------------- | --------- | ------------------------------------------------- | ----------- |
| 1    | `ci-job-log-rust.md`                    | rust-impl | —                                                 | core        |
| 1    | `ci-job-log-core.md`                    | web-impl  | —                                                 | rust        |
| 2    | `ci-job-log-state.md`                   | web-impl  | rust (+ `just bindings`), core                    | palette     |
| 2    | `ci-job-log-palette.md`                 | web-impl  | — (may run in wave 1 when three implementers fit) | state       |
| 3    | `ci-job-log-page.md` (wires the window) | web-impl  | state, palette (and so rust, core)                | —           |
| 4    | `ci-job-log-verify.md`                  | verifier  | page committed (smoke); docs keeper done (final)  | docs keeper |

Why not the request's graph (one page slice owning every `ui/CiStatus*`, `useHoverBox.ts` and `ipc/*MergeRequest*`
file): with the Shift tap (`useShiftHeld.ts`, `keyHold.ts`, `altHold.ts`), the problem step, the fixture logs, the
slice module and the theme palette it would be about 45 files, far above the implementer budget, and the palette is
sourced data with its own detector (as #102 was). So the state and IPC layer (no `.vue`) is its own slice, the palette
is its own small slice, and the page slice owns the components, hover, keys and words.

## 6. Open questions for the owner

None blocks a slice; each below is decided as written (row #161) and the owner may veto:

1. Rule 1 keeps Shift for capitals while the cursor is in the log's search field, so with the pointer resting on
   another job, typing "Error" never switches logs — but switching by pointer then needs one click into the log text
   (or Escape) before Shift. Keyboard users press Escape, move to the job, and press Shift.
2. A 256-colour code shows as the nearest of the theme's 16 terminal colours (an orange shows as the theme's yellow),
   so every colour stays readable in light themes; GitLab's dark page shows the exact shade.
