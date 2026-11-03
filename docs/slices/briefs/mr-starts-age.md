# Slice MrStartsAge — the list's age left of Refresh

Request `docs/slices/request-mr-starts.md` part A (rules A1–A3, acceptance A). Base: main `6c34a149`. Shape given by
the request; no designer.

Known facts (tree at base):

- `ui/MergeRequestsView.vue:145-153` is the Refresh button (`ml-auto`, spinner while `loading`); `:73` `now` is
  `useNow` ticking every `MINUTE_MS`, already given to the rows (`MergeRequestRow.vue:61` `createdAgo(…, props.now)`).
- `ui/mergeRequests.ts`: `ListLoad` (`:36-39`) is `notLoaded | loading { first } | done { end, at }`; `at` is the
  end of the last call, whatever its end (`ended`, `:108-123`), and drives the stale reload in `show` (`:178-187`,
  `RECHECK_PAUSE_MS`). A refresh keeps the old rows until a listed end (`buffered`, `:113-118`); a thrown call
  restores the old `listing` (`load`, `:169`); an end with a failure text (`listFailureText(end) !== null`) keeps the
  old rows but writes a new `at`.
- Core `mergeRequests/`: `agoText(time, now)` (`internal/relativeTime.ts:17`, "just now", "1 minute ago", "3 hours
  ago"); `dateTimeText(at)` (`internal/dueDate.ts:69`, "30.10.2026, 15:04", no locale); `localDay`. `index.ts` is the
  only surface (`mergeRequests/AGENTS.md`).
- Hover text on this page is `v-tooltip` only, never `title` (`ui/tooltip.ts`, detector `ui/mergeRequestTitles.test.ts`).
- Fixture scripts: `?mr=list`, `?mr=slow` (pages spaced out), `?mr=pageFails` (`ipc/fixtureMergeRequests.ts`).

## Target

Owned: `frontend/src/ui/MergeRequestsView.vue`, `frontend/src/ui/mergeRequests.ts`, `frontend/src/ui/mergeRequests.test.ts`,
`frontend/src/mergeRequests/**`, `frontend/src/ui/AGENTS.md`.

Read-only: everything else, `frontend/src/ipc/**` included (fixtures as they are); `docs/**` (lines in
`deviations_from_brief`).

Non-goals: auto-refresh; any change to when the page reloads (the stale reload keeps its `at`); other windows'
headers; the start-up of the window (another slice owns `main.ts`, `compareStore.ts`, `rangeStore.ts`).

## Contract (fixed)

- `MergeRequests` (the slice `ui/mergeRequests.ts` returns) gains one read-only time of the shown list: when the list
  now on screen finished loading (ms since epoch), `null` while none has. Name it as you see fit; it has one writer,
  this file. The view never derives it from `listing`.
- Core: one function giving the hover text for a time and now: `HH:MM` when both are the same local day
  (`localDay`), else `dateTimeText`. The visible words are `agoText` (no second wording of an age).

## Change

1. Core: the hover function above, exported from `index.ts`, with tests at the day edges (23:59 vs 00:00 local, a time
   ahead of now, a west zone as the existing `dueDate.test.ts` pins one).
2. State: the shown list's time is set only when a load ends with no failure text (the same condition that swaps the
   rows in); a refresh in flight, a thrown call and an end with a failure text leave it. Tests in
   `mergeRequests.test.ts` for each of those, plus the first load (null until its end) and a first load that fails
   (stays null).
3. View: left of Refresh, in muted text (`text-fg-muted`), `agoText(shownAt, now)`, hover the core text through
   `v-tooltip`; nothing when `null`. Refresh keeps its place at the right (`ml-auto` moves to the group). It updates
   with `now` (every minute).

## Acceptance

- `pnpm -C frontend lint`, `typecheck`, `test` clean; `just mutants HEAD` (SP11).
- WebKit fixture (`just app-session start-fixture --name age --diff --mr list --size 1600x1000`): open Merge requests;
  after the list: "just now" left of Refresh (screenshot of the header); hover it → `HH:MM` of now. Wait past a minute
  (or move the page's clock) → "1 minute ago". With `--mr slow`: click Refresh, the old age stays while the spinner
  runs, then "just now". With `--mr pageFails` after a good load is not reachable in one script, so pin the failure
  case by the unit test and say so. Light and dark theme, one screenshot each.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
