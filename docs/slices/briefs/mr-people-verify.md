# Slice mr-people-verify — the gate, the WebKit fixture and the real app for people on a merge request

Design: `docs/slices/briefs/mr-people-design.md` option A. Request acceptance: `docs/slices/request-mr-people.md`
"Acceptance" (`:64-73`). Proposed plan §2 #153 (amended), #169, #170; RK53, RK54, RK64, RK65. Recipes:
`skill://verification`. Windows open only on a private display. Screenshots come only from the session or the private
display.

## Target

**Owned:** none (read-only commands; your scratch folder only).

**Read-only:** the whole tree.

**Needs:**

- `mr-people-rust` (with `just bindings` applied), `-core`, `-state` and `-page` committed.
- **Smoke pass** (steps B–C, no `just check`): as soon as `-page` is committed, beside its reviewers.
- **Final pass**: once the docs keeper has named every new file in the project map (`just map-check`, PM6), and
  `search_people`, `change_people`, `MergeRequestSource.searchPeople` and `changePeople` in architecture and
  ipc-contract. Run `just check` once, then B–C.

**Non-goals:**

- The owner's playground check (below, for the orchestrator to hand on).
- Fixing anything.
- `just mutants`.

## Contract

**Fixture `?mr=list`**, as `mr-people-state` built it:

- Rows as today: !640 assignee sam, no reviewer, author anna; !638 assignee ben, reviewers chiara (approved), dmitri
  (changes requested) and sam (requested), approved by sam and anna; !637 nobody; !632, !623, !614 and !605 with
  `mayRerequest` false.
- `searchPeople` answers after 300 ms from `PEOPLE` (sam, anna, ben, chiara, dmitri) and the search-only erik "Erik
  Lund", olga "Olga Novak", rita "Rita Moreau", by username or name; "zzz" finds no one.
- `changePeople` answers after 1,000 ms and keeps each changed row's people:
  - rita → refused "Cannot assign @rita to !<iid>";
  - adding olga → unchanged;
  - else changed.
- Log lines: `mergeRequests.fixture_people_search { text }`, `mergeRequests.fixture_people_change { iid, group,
  action, username }`.

**Scenario `tests/glab/mr-people/`**, as `mr-people-rust` recorded it:

- User `sam`. !52: assignee sam; reviewers ben, chiara (approved), dmitri. !51 nobody. !50 `updateMergeRequest` false.
- Searches `er` (erik with an uploaded picture, ben), `an` (anna), `gh` (ghost).
- Posts, in order:
  1. add assignee erik
  2. add reviewer erik
  3. remove assignee sam
  4. remove reviewer chiara
  5. add assignee anna, which GitLab Free drops
  6. add reviewer ghost, refused "Reviewers not able to be set: ghost"

**Words:**

- Page: "Add assignee", "Add reviewer", "More", "Remove assignee", "Remove reviewer", "Search people…", "Searching…",
  "No one found", "None", "Already an assignee", "Already a reviewer", "Me".
- Sentences: "GitLab did not add @olga as assignee (GitLab Free allows one assignee per merge request).", "GitLab still
  lists … as reviewer.", GitLab's own refusal text.
- Problems (in the box only): "Could not search people", "Could not change the merge request's people".

## Change (the steps)

**A. Gate (final pass only).** `just check` → pass, or the failing recipe and its first 30 lines.

**B. WebKit fixture.** Run `just app-session start-fixture --name mpv --diff --mr list --size 1600x1000`, then open the
merge-requests page. Run every step in both windows (`--diff`, and `--range-case review --mr list`) unless noted.

1. **Add by typing.** On !640, "Add reviewer".
   - The field is focused. The empty list starts with "Me @sam", then !640's own people.
   - Type "erik": "Searching…" or the list, then "Erik Lund @erik" with a loaded picture. The session log has one
     `fixture_people_search { text: "erik" }` (the pause: not one per letter).
   - Click Erik: a spinner, then Erik under Reviewers ("Review requested"); the field is empty and still focused; the
     stack shows Erik's picture.
   - The "Reviewer" filter lists Erik Lund with count 1.
2. **Keyboard.** On !640, "Add assignee", empty field.
   - Me reads "Already an assignee", `aria-disabled`.
   - ArrowDown/ArrowUp move `aria-activedescendant` over the others only, wrapping.
   - Enter adds the highlighted one.
   - Escape: the field closes, focus is on "Add assignee", the box stays. Escape again: the box closes, focus is on
     the stack.
3. **Suggestions.** On !638, "Add assignee", click "Me": sam is added with no `fixture_people_search` line.
4. **Remove behind a click.**
   - On !638, a single click on chiara's ellipsis opens the menu ("Remove reviewer") and logs no
     `fixture_people_change`.
   - Choose it: chiara's spinner, then she is gone. !638's approvals count is unchanged (2). Dmitri's line still shows
     the re-request button and the state icon before his ellipsis (rule 3), and !638's assignees are unchanged (rule 7).
5. **One at a time.** On !636, add two people within a second. Both show spinners. The two `fixture_people_change`
   lines are about 1 s apart, the second after the first's answer.
6. **Free and refusal.**
   - On !640 add olga as assignee: the Free sentence, and the assignees are unchanged.
   - Add rita as reviewer: "Cannot assign @rita to !640".
   - Leave the box and come back: both sentences are gone.
7. **Holding the box** (RK65).
   - Field focused, pointer moved off the box, keep typing: the box stays open.
   - Open a menu by click, move the pointer off: the box and menu stay. Escape closes the menu only.
   - A click elsewhere on the page closes the box.
8. **Not editable / nobody.**
   - !632: no `user-plus`, no ellipsis anywhere in its box.
   - !637: its dimmed icon opens a box with "Assignees None" and "Reviewers None" and both add buttons.
9. **No one found.** "Add reviewer", type "zzz": "No one found".
   9b. **The open row stays** (owner #2246, request rule 9). Set the filter "Reviewer: None"; open !637's box and add
   Erik Lund as reviewer: !637 stays on the list and its box stays open with Erik under "Reviewers". Move the
   pointer off the box: once it closes, !637 is gone from the list.
10. `shot` with a field open and with a menu open, in yamt Dark and yamt Light (`--settings '{"theme":"light"}'`).

**C. Real app.** Run `scripts/local-conflicts-repo.sh <scratch>/mpv`, then `cargo tauri build --debug --no-bundle`,
then `just app-session start-app --name mpv --diff --dir <scratch>/mpv --glab mr-people`. Open the merge-requests page.
On !52, in the scenario's post order:

1. "Add assignee", type "er".
   - The fake glab log has one `argv:` line with `PeopleSearch` and `-f search=er`, and no `stdin:` line.
   - Erik's `img` loads from `yamt-picture:`.
   - Click Erik: the stack and box show Erik as assignee.
2. "Add reviewer", type "er", click Erik: Erik under Reviewers, "Review requested".
3. Sam's ellipsis → "Remove assignee": sam is gone.
4. Chiara's ellipsis → "Remove reviewer": chiara is gone. !52's approvals count still shows chiara's approval.
5. "Add assignee", click Anna in the suggestions: "GitLab did not add Anna Berg as assignee (GitLab Free allows one
   assignee per merge request)." (the row names her as author); the assignees stay Erik.
6. "Add reviewer", type "gh", click Ghost: "Reviewers not able to be set: ghost".
7. The log has exactly six `stdin:` bodies:
   - each with one of the two mutations aliased `changed:`;
   - each `"usernames"` a one-element array, `"mode"` `APPEND` or `REMOVE` in the order above;
   - no `REPLACE` anywhere.
8. !50 (`updateMergeRequest` false) shows no controls. The app log has one people-change line per change with iid,
   group, action and outcome, and never a username. `shot` in dark and light.

## Acceptance

Each step: pass or fail, with the observed words, the `read` results, and the app-log and fake-glab log lines pasted
verbatim, plus the screenshots' paths.

**Owner check** (hand on, not run). The owner's playground (`scripts/gitlab-playground.sh`, a personal project on
gitlab.com, so GitLab Free `[INFERENCE]`); the real app logged in as `samubr`:

1. On !1 "Due dates on cards", "Add assignee" → "Me". GitLab's page for !1 shows samubr as assignee.
2. "Add reviewer" → type "sam" → samubr: GitLab shows samubr as reviewer.
3. Each one's ellipsis → Remove: both are gone on GitLab's page. Each change leaves GitLab's own system note
   ("assigned to @samubr", …).
4. Optional, if the project has a second member: with one reviewer set, adding a second shows the Free sentence, and
   GitLab still lists only the first.
