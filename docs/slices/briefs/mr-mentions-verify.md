# Slice mr-mentions-verify — the gate, the WebKit fixture in both windows and the real app for `@` completion

Design: `docs/slices/briefs/mr-mentions-design.md` option A. Request acceptance: `docs/slices/request-mr-mentions.md` "Acceptance". Plan §2 #191–#192 (proposed), #118, #169, #183, #185 and #189 (amended). Risks: RK35, RK53, RK54, RK65, RK73, and RK76 (proposed). Recipes: `skill://verification`.

Windows open only on a private display. Screenshots come only from the session or the private display.

## Target

**Owned:** none. Read-only commands; your scratch folder only.

**Read-only:** the whole tree.

**Needs:**

- **Smoke pass 1** (steps B and C, no `just check`): as soon as `mr-mentions-list` is committed (it wires the reply field in the compare window and on the range window's merge-request page). `mr-mentions-core` and `mr-mentions-search` are committed before it.
- **Smoke pass 2** (step D only): as soon as `mr-mentions-post` is committed (it wires the range window's Post box).
- **Final pass**: once the docs keeper has done these, run `just check` once, then B–D.
  - `skill://project-map` `tree.md` names the new files (`mergeRequests/internal/mentions.ts`, `ui/mergeRequestMentionLines.ts`, `ui/mergeRequestMentions.ts`, `ui/MergeRequestMentionList.vue`, `ui/textareaCaret.ts`; `just map-check`, PM6).
  - `state.md` names `mentionSearch`.
  - The plan rows and the risk rows are recorded.

**Non-goals:** the owner's playground check (below, for the orchestrator to hand on); fixing anything; `just mutants`.

## Contract

**Fixture `?mr=list` (compare window):**

- !637's d01 thread. Open its panel by Shift over d01's row in !637's discussions box.
- People: sam (Me, "Sam Weller"), anna "Anna Berg", ben "Ben Okafor", chiara "Chiara Rossi", dmitri "Dmitri Volkov"; search-only erik "Erik Lund", olga, rita. The text `an` matches only Anna.
- Log lines: `mergeRequests.fixture_people_search {"text":…}` (one per search sent, 300 ms answer) and `fixture_write { … }`.

**Range fixture:** `--range-case review --threads seeded --gitlab listed --mr list --open-mr`. `listed` lines the range up with `?mr=list`'s !640, so the Post box knows !640's people once the page has loaded. `--gitlab linedUp` (!12, no listed row) gives search results only.

**Fake glab scenario `tests/glab/mr-threads/`:** !90 with d01–d13; `graphql-people-an.json` answers `search=an` (anna, `/2/avatar.png`). Every call is logged as an `argv:` line. A search with no scripted answer exits 2 and is still logged.

**Words:** "People to mention" (the listbox), "Add comment", "Text to post", "Queue". The people box's failure sentences (`peopleSearchText`).

## Change (the steps)

### A. Gate (final pass only)

`just check` → pass, or the failing recipe and its first 30 lines.

### B. WebKit fixture, the reply field

Start: `just app-session start-fixture --name mmv --diff --mr list --open-mr --size 1600x1000`. Every step runs in yamt Dark and in yamt Light (`start-fixture` has no settings option: set `<html data-theme="light">` live, #2495) unless noted.

1. **Bare `@`.** In d01's reply field type `@` → the listbox under the caret line.
   - Its lines are !637's author, assignees, reviewers, approvers, then d01's writers, each once. Each line shows a picture, the name and a muted `@username`.
   - The first line is selected.
   - **No** `fixture_people_search` line.
2. **Search.** Type `an` → after the pause, exactly one `fixture_people_search {"text":"an"}`. Anna Berg is listed.
3. **Under the caret.** `read` the list's and the field's rects and the field's computed `lineHeight` and `paddingTop`. For `@an` on line 1, on line 3 (two line breaks first) and after `hello ` on line 1:
   - the list's top is within 2 px of the bottom of the `@`'s line;
   - its left is within 4 px of the `@`'s x (the `hello ` width measured with a canvas `measureText` in the field's computed font).
4. **Inside the panel.** With 12 lines typed and `@an` on the last: the list's rect is inside the panel's rect.
5. **Pick and undo.** Down, then Enter → the field reads `@anna `, `selectionStart` 6, no list. Undo through `document.execCommand("undo")` (the driver's Ctrl+Z does not reach WebKit's undo, measured by the list slice) → `@an` selected (0–3), one step. Click a line → that person written.
6. **Escape (RK73).** `@an`, Escape → the list closes, the panel stays open, focus is in the field. Escape again → the panel closes. The page stays (#189).
7. **Send keys.**
   - Ctrl+Enter with the list open → one `fixture_write { kind: comment }`, and no list.
   - Shift+Enter with the list open → a line break.
   - Tab with the list open → a pick.
8. **Rule 6.**
   1. With the panel's list showing Anna, open !637's people box and press "Add assignee": its empty field shows its own suggestions (Me first), not Anna's search.
   2. Type `er` → Erik.
   3. Escape twice.
   4. Reopen d01's panel and click at the end of the kept `@an` → Anna again, no Erik.
9. **Preview.** The list closes on Preview. Write brings the text back, with no list until the caret is in a word.
10. `shot` of the list from step 2, dark and light.

### C. Real app, the reply field

1. `scripts/local-conflicts-repo.sh <scratch>/mmv` and `cargo tauri build --debug --no-bundle`.
2. `just app-session start-app --name mmva --diff --dir <scratch>/mmv --glab mr-threads --mr`, then the merge-requests page, !90's d01 panel. Count the session's fake glab `argv:` lines after each step:
   1. `@` → no new line.
   2. `an` typed in one burst → after a pause, exactly **one** `argv: api graphql … search=an`. Anna Berg is listed with her uploaded picture (`/2/avatar.png`).
   3. Down, then Enter → the field reads `@anna ` (`read`). No new `argv:` line.
   4. Clear the field (Ctrl+A, Delete), then `@a`, a pause, `n`, a pause, `n`, a pause → exactly one line per pause (`search=a`, `search=an`, `search=ann`): one search call per pause. A search with no scripted answer shows the people box's failure sentence, muted, under the known people (rule 5).
3. `shot`, dark and light.
4. `just app-session stop --name mmva`.

### D. WebKit fixture, the range window's "Text to post"

Start: `just app-session start-fixture --name mmvr --range-case review --threads seeded --gitlab listed --mr list --open-mr --size 1600x1000`, then Back to the files, `board.ts`, a seeded thread's note, and "Post".

1. Ctrl+End, then type ` @` → the list with !640's people, and no `fixture_people_search`.
2. Type `an` → one `fixture_people_search {"text":"an"}`, and Anna listed. `read`: the list is inside the pane's `.cm-scroller` rect, and `elementFromPoint` at its centre is in the list.
3. Down, then Enter → `@anna `. While typing, `document.activeElement` stays the box (RK35). ArrowDown with the list open changes neither the shown file nor the pane.
4. `@an`, Escape → the list closes and the box stays. Escape → the box closes, as today.
5. Post again, `@an`, Enter, Queue → the queued text holds `@anna `. Send → a pending posting naming !640.
6. Restart with `--gitlab linedUp`. Post: ` @` → no list. `an` → Anna, from the search only.
7. `shot` of step 2, dark and light.

## Acceptance

For each step: pass or fail, with the observed words, the `read` results, the log and `argv:` lines pasted verbatim, and the screenshots' paths.

**Owner check** (hand on, not run). On the owner's playground (`samubr/glab-yamt-playground` on gitlab.com), with the real app logged in as `samubr` and an open merge request with a discussion:

1. Shift over the discussion's row. In the reply field type `@` → the merge request's people at once. Type two letters of a project member other than yourself → that member is listed.
2. Pick them with Down/Enter or a click, and write a short reply. "Add comment" → on GitLab the comment shows `@username` as a link, and that person has a to-do ("mentioned you"). A self-mention makes no to-do on GitLab.
3. In the reply field pick a person, then press Ctrl+Z once → the typed `@` word comes back (selected); the driver could not press a real Ctrl+Z.
4. Optional (range window): line a range up with the merge request, open the merge-request page once, then in "Text to post" type `@` → its people. Queue and Send → the draft carries the mention. It notifies the person when you publish the review on GitLab `[INFERENCE]`.
