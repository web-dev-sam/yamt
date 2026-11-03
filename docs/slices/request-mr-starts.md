# Request — the list's age, `yamt --mr`, and AI mode by environment

Asked by the owner on 2026-11-03 (#2195–#2197, third to fifth in importance; answer #2198); details by the
orchestrator as owner (OR13, the owner may veto). Three small, independent parts; the shape is given, so the
orchestrator writes short briefs (no designer). Base: main `399f0eb0`. Files: `frontend/src/ui/MergeRequestsView.vue`
(refresh button `:132-135`), `ui/mergeRequests.ts` (`refresh`, `:273`); `src-tauri/src/args.rs` (flags, `USAGE`);
README (`.readmer/readme.json` + `readmer`).

## Owner's words

- "A time "3min ago" next to the refresh button with which one can see from when the MR informations were."
- "A --mr flag that immediately opens the MR list view and can work without "--diff" (it means --diff implicitely
  if its not set already)."
- "A global env variable with which the user doesnt have to write "yamt --ai" and activate AI mode everywhere"
- (#2198) The time sits left of the refresh button.

## Rules

**A. The list's age.**

1. Left of the refresh button, in muted text: how long ago the shown list finished loading, in the rows' own words
   (`agoText`, the words of `created … ago`: "just now" under a minute, "3 minutes ago", "2 hours ago"), updated
   every minute while shown. The owner's "3min ago" is the example; the rows' words win, so the page has one way of
   saying an age (orchestrator, owner may veto). No list loaded yet (first load running or failed): no age.
2. Its hover gives the exact time (`14:32`, or `03.11.2026, 14:32` when not today).
3. During a refresh the old age stays until the new list has arrived; a failed refresh keeps the last good list's
   age (the failure shows as today).

**B. `--mr`.**

1. `yamt --mr` opens the compare window (as `yamt --diff`) with the merge-request page already open.
   `yamt --diff --mr` is the same; `yamt --diff=<range> --mr` opens the range window with its page open.
2. `--mr` alone with a merge (`yamt --repo <p> --mr`) follows `--diff`'s rules: the compare window takes no
   `--repo`, refused with the same message.
3. Without a GitLab remote the window opens as `yamt --diff` (or the range window) does today: its files, no page,
   no button; a failed project lookup shows its problem as today. `--help` and the README list `--mr`.

**C. AI mode everywhere.**

1. `YAMT_AI=1` in the environment makes every start behave as with `--ai`; `--ai` keeps working. Unset, empty or
   `0`: off. Any other value: on.
2. It is read once at start, like the flags; `--help` and the README name it beside `--ai`.

## Acceptance

A: core/unit tests for the words and the minute update; WebKit fixture shows "just now", then "1 minute ago" (clock
moved), hover the exact time; refresh keeps the old age until loaded. B: argument tests for every combination above;
real app `yamt --mr` in a repository with the fake glab opens the list at once. C: argument tests with the variable
set, unset, `0`; real app with `YAMT_AI=1 yamt --mr` → a changes window opened from the list has "Ask AI". `just
check` passes.

## Non-goals

An AI setting in the Settings window; other environment variables for other flags; auto-refresh.

## Slice graph (proposal)

| row | slice                                                            | owner       | needs |
| --- | ---------------------------------------------------------------- | ----------- | ----- |
| 1   | rust: `--mr`, `YAMT_AI`, usage text, the window opening its page | rust-impl   | —     |
| 2   | page: the list's age (core words + view)                         | web-impl    | —     |
| 3   | docs keeper; README by the orchestrator                          | docs-keeper | 1, 2  |
| 4   | verify                                                           | verifier    | 1, 2  |
