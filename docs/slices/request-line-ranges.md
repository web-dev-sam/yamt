# Request — a thread on a range of lines, chosen by dragging over the line numbers, as in GitLab

Asked by the owner on 2026-10-31 (session 41, planning after 0.6.4, #2051); details by the orchestrator as owner (OR13),
copied from GitLab's merge-request diff where marked. A design may refine a detail it names, never reopen a rule.
Facts: `.omp/run/notes/PlanScoutRangeThreads.md` (path:line at main `c8c5c54a`). The window is the range window
(`yamt --diff=<a>..<b>` and the changes window a merge request's Show Diff opens).

## Owner's words

- "Currently the user can open discussions on lines. I want to be able to open discussions on a range of lines by
  dragging, like in gitlab"

## GitLab's behaviour copied (sources)

- Gesture: "Hover over the line number, and select Add a comment to this line: Select and drag your selection to include
  all desired lines" (docs.gitlab.com `user/project/merge_requests/reviews/suggestions`). The form opens under the last
  line; its header reads "Comment on lines +5 to +8".
- Highlight: "We should highlight the intervals upon hover and when focusing on/authoring one comment"
  (gitlab-org/gitlab#14128, shipped).
- API: a draft note's `position[line_range]` holds `start` and `end`, each `{ line_code, type, old_line, new_line }`;
  `type` is `new` for an added line, otherwise `old`; `line_code` is `<sha1 of the file path>_<old>_<new>`; the
  position's own `old_line`/`new_line` name the end line (docs.gitlab.com `api/draft_notes`, `api/discussions`
  "Parameters for multiline comments" and "Line code").

## Rules

1. **Drag on the line numbers.** A press on a line number (where today's "+" shows, `threadNumbers.ts:103-128`) and a
   move tint every line from the pressed one to the one under the pointer, in that column; the release opens the new
   thread for those lines. A press and release on one line is today's one-line thread, unchanged. The press starts
   nothing any more: the thread starts on release (today it starts on press). Escape during the drag cancels it
   (orchestrator). The count badge keeps its press (open/collapse that line's threads) and starts no drag.
2. **One column.** A range is lines of the column it started in: the old file's lines in the left column (removed and
   unchanged), the new file's in the right (added and unchanged). The pointer's height picks the line; moving sideways
   into the other column changes nothing (orchestrator, the boring choice in a two-column view; the question below
   asks the owner).
3. **Shown lines only.** The drag stops at a collapsed run's wave: hidden lines never join a range (orchestrator, as in
   GitLab, where unexpanded lines are not rows). The mouse wheel scrolls during a drag and the range follows the line
   under the pointer; no automatic scroll at the column's edges (non-goal).
4. **Where the box sits.** Under the range's last line, in the place a one-line thread on that line takes today
   (GitLab: the form under the last line). The count badge sits on that last line. Dragging upwards gives the same
   range as dragging downwards.
5. **Highlight.** A thread's lines are tinted in its column while its new-thread box is open (being written) and while
   the pointer is over its box (GitLab #14128); the same rule for one-line threads, a range of one (orchestrator: one
   rule). Tint colour: the selection's, readable in dark and light.
6. **Place text.** The box header, its accessible name and the AI's `RELATIVE_FILE_PATH_WITH_LINE` value read
   `path:5-8` for a range (one text, `rangeThreadText.ts` `threadPlaceText`), `path:5` for one line as today. The
   placeholder keeps its name: users' saved First message templates use it (plan §2 #113). A left-column range names
   the old path and old numbers, as a removed line does today; the default template's sentence about removed lines
   covers "lines" (wording in the design).
7. **Drafts.** Dragging exactly the range of a new thread still being written focuses it (today's same-line rule,
   `rangeDrafts.ts:120-123`); any other range is a new draft, even one ending on the same line (they share that row,
   as threads with one place do today).
8. **Never hidden.** Every unchanged line of a thread's range stays shown when unchanged lines collapse (today one line,
   `columnFolds.ts:58-71`), computed at open and on each toggle as today.
9. **Stored.** The range is kept in the pair's threads file and survives a restart. Existing threads load unchanged as
   one-line threads. An older yamt meeting a file it cannot read refuses it, naming it, untouched (plan §2 #120's
   rule); the design states when the file's format changes.
10. **Posted to GitLab.** A range posts as GitLab's multi-line comment: `position[line_range]` with both ends (rule
    "API" above), the position's `old_line`/`new_line` naming the last line; a one-line thread posts as today, with no
    `line_range`. The "lines up" rule (#119) is unchanged. A draft already on GitLab counts as this message only when
    its range matches too (today `same_draft` compares only one line, `position.rs:80-87`). How GitLab numbers the
    `<old>`/`<new>` of a `line_code` for an added or removed line is taken from GitLab's own code, cited in the design.

## Acceptance

WebKit fixture (`?range`, a seeded range thread added to `fixtureThreads.ts`): a drag over four right-column line
numbers across unchanged and added lines tints them and opens a box under the fourth; a drag upwards gives the same;
Escape mid-drag starts nothing; a press-release still starts a one-line thread; the badge still toggles; a drag stops
at a wave; hovering a stored range thread's box tints its lines; collapse on keeps every unchanged line of the range.
Rust: the stored range survives a reload; the posted body carries `line_range` with both ends against a fake GitLab
case under `tests/glab/`; a one-line body is unchanged. Real app on `scripts/range-repo.sh`: drag, comment, restart,
the range is back; dark and light. `just check` passes. Owner check (his GitLab playground, `scripts/gitlab-playground.sh`):
a sent range shows in GitLab as "Comment on lines +a to +b" on the right lines.

## Non-goals

Changing a thread's range after it starts (GitLab's start-line menu in the form); keyboard or Shift+click selection;
a range spanning both columns (unless the owner answers otherwise); automatic scroll at the edges; quoting the lines'
text to the AI; GitLab suggestions; the merge and compare windows; reading GitLab's threads back.

## Question for the owner

Should one discussion be able to cover lines from both sides, for example the three old lines and the five new lines
that replaced them? GitLab's single-column view allows it. Recommended no: a drag stays on one side, so in yamt's
two columns the gesture stays obvious; the cost is two discussions where one change spans both sides.

## Slice graph (proposal; the session's orchestrator refines it)

| row | slice                                                                                                                  | owner     | owns (coarse)                                                                                                        | needs |
| --- | ---------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | design: the anchor's shape, the file format step, GitLab's `line_code` rule (sourced), the drag and tint in the editor | designer  | `docs/slices/briefs/line-ranges-*.md`                                                                                | —     |
| 2   | Rust: range anchor in `yamt-review` (store, format, post body, draft match), `add_thread` command, bindings            | rust-impl | `crates/review/**`, `src-tauri/src/review.rs`, `tests/glab/<new case>/**`                                            | 1     |
| 3   | editor: drag on the numbers, tint (drag, draft, hover), range kept visible under collapse, controller events           | web-impl  | `frontend/src/editor/**`                                                                                             | 2     |
| 4   | window: drafts, place text, AI value and template wording, hover to the controller, fixtures                           | web-impl  | `frontend/src/ui/range*`, `frontend/src/ipc/{threadLine,fixture*}.ts`, `frontend/src/agent/internal/firstMessage.ts` | 2     |
| 5   | final run: `just check`, WebKit, real app                                                                              | verifier  | —                                                                                                                    | 3, 4  |

Rows 3 and 4 are disjoint and run side by side once row 2's bindings are committed; the design fixes their contract
(the controller's start event with a range, the hover-tint call). Row 4 wires the window: its commit starts the smoke
pass. Risks (facts in the note): the press handler starts on `mousedown` today (rule 1 moves it to release); the
column text is selectable (`pane.ts:209-210`), so the drag must not also select text; `same_draft` and the per-line
badge key on one line; `columnFolds.ts` keeps `len: 1`; no threads file format has ever changed (every `FORMAT` is 1),
and an older yamt silently drops an unknown field when it rewrites the file, so a new field alone is unsafe.
