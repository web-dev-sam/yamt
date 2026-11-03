# Slice mr-people-page — add field, suggestions, per-person menu, hover holding (wires the window)

Feature: people on a merge request. Sources:

- Request `docs/slices/request-mr-people.md`: rules 1–7, the WebKit acceptance and the real-app acceptance.
- Design `docs/slices/briefs/mr-people-design.md` option A, §1.6, §1.7.
- Proposed plan §2 #169, #170; RK64, RK65.

Runs after `mr-people-state`, and so after `-rust`, `just bindings` and `-core`. **This slice wires the window**: its
real-app run is the feature's first end-to-end proof.

## Target

**Owned:**

- `frontend/src/ui/MergeRequestPeople.vue`
- `frontend/src/ui/MergeRequestPeopleSearch.vue` (new)
- `frontend/src/ui/MergeRequestPersonMenu.vue` (new)
- `frontend/src/ui/mergeRequestPeopleLines.ts` (new, pure), `frontend/src/ui/mergeRequestPeopleLines.test.ts` (new)
- `frontend/src/ui/mergeRequestsText.ts`, `frontend/src/ui/mergeRequestsText.test.ts`
- `frontend/src/ui/AGENTS.md`

**Read-only:** everything else.

- `ui/mergeRequests.ts`, `ui/mergeRequestPeople.ts`, `ipc/**` and the fixtures are the state slice's: use them as
  contracted.
- `mergeRequests/**` is the core's.
- `ui/useHoverBox.ts`, `ui/useDropdownMenu.ts`, `ui/useMenuPlacement.ts`, `ui/menuKeys.ts`, `ui/tooltip.ts`: use them
  as they are.
- `MergeRequestRow.vue` and `MergeRequestsView.vue` do not change: the box reads the new state through
  `useMergeRequests()` (PM10, as `CiStatusBox.vue:44`).
- `style.css`: no new token.
- `docs/**`: put lines in `deviations_from_brief`.

Two new components; each needs its one-line reason in `deviations_from_brief` (VU15):

- The search field has its own focus, keys and list.
- The menu is one dropdown per person.

**Non-goals:**

- The author; approvals; labels on GitLab; several merge requests at once; an undo (request non-goals).
- Editing from the filter bar or review mode's own controls (request non-goals).
- Swapping on GitLab Free (open question 2).
- Keeping a filtered-out row on screen (open question 3).
- Renaming `mayRerequest` (design §3).

## Contract

Given (fixed):

- State: `MergeRequests.me`, `rows`, `peopleSearch`, `peopleAsks`, `searchPeople`, `endPeopleSearch`, `changePeople`,
  `dismissPeopleNotices`; the types `PeopleSearch`, `RowPeopleAsks`, `NotDone`, `PeopleChangeFailure`.
- Domain: `PeopleGroup`, `PeopleChange`, `MergeRequestRow.mayRerequest`.
- Core: `peopleSuggestions`, `Suggestion`, `ME_WORD`, `displayName`, `initials`.
- Problem: the steps `searchPeople` and `changePeople` (`problemText`).

Fixed here (add-only beyond this):

```ts
// MergeRequestPeople.vue — props and emits unchanged (MergeRequestRow.vue keeps passing them)
defineProps<{ row: MergeRequestRow; asks: ReadonlyMap<string, RerequestAsk> }>();
defineEmits<{ rerequestReview: [username: string]; closed: [] }>();

// MergeRequestPeopleSearch.vue — the add field and its list, rendered in its group while that group is adding
defineProps<{ row: MergeRequestRow; group: PeopleGroup }>();
defineEmits<{ close: [] }>(); // Escape in the field

// MergeRequestPersonMenu.vue — the line-end ellipsis and its one-item menu (one useDropdownMenu<true>)
defineProps<{ name: string; item: string; working: boolean }>(); // item: REMOVE_ASSIGNEE | REMOVE_REVIEWER
defineEmits<{ choose: [] }>();

// mergeRequestsText.ts — added
export const ADD_ASSIGNEE = "Add assignee";
export const ADD_REVIEWER = "Add reviewer";
export const MORE = "More";
export const REMOVE_ASSIGNEE = "Remove assignee";
export const REMOVE_REVIEWER = "Remove reviewer";
export const SEARCH_PEOPLE = "Search people"; // the field's aria-label; its placeholder "Search people…"
export const SEARCHING_PEOPLE = "Searching…";
export const NO_ONE_FOUND = "No one found";
export const NO_ONE = "None"; // an editable empty group
export function moreLabel(name: string): string; // "More for Anna Berg"
export function alreadyText(group: PeopleGroup): string; // "Already an assignee" | "Already a reviewer"
export function peopleSearchText(
  search: Extract<PeopleSearch, { kind: "refused" | "failed" }>,
  platform: string,
): string; // glabMissing/notLoggedIn → glabRefusalText; failed → reply.message; thrown → problemText(step searchPeople)
export function peopleChangeText(notDone: NotDone, name: string, platform: string): string;
//   unchanged add: "GitLab did not add @olga as assignee (GitLab Free allows one assignee per merge request)."
//   unchanged remove: "GitLab still lists Anna Berg as reviewer."
//   refused { glabMissing | notLoggedIn } → glabRefusalText; refused { refused | failed } → reply.message;
//   failed { cause } → problemText({ action: "mergeRequests", step: "changePeople", cause }, platform)
```

`name` in a notice is `displayName` of the person when the row names them (author, assignees, reviewers or approvers).
Otherwise it is `@<username>`: the field cleared after the pick, so the result is gone.

**The box** (design §1.6–1.7):

- **Not editable** (`row.mayRerequest` false). Exactly as today: no add, no ellipsis; a row with nobody keeps the
  dimmed icon with no box.
- **Editable: groups.**
  - Both group headers always show, each with its add button: Lucide `user-plus`, `v-tooltip` and `aria-label`
    `ADD_ASSIGNEE` / `ADD_REVIEWER`.
  - An empty group shows `NO_ONE` muted.
  - A row with nobody opens the box from its dimmed icon (an opener button, `useHoverBox` as the stack).
- **Editable: lines.** Every assignee and reviewer line ends with `MergeRequestPersonMenu`: Lucide `ellipsis-vertical`,
  `v-tooltip` `MORE`, `aria-label` `moreLabel(name)`.
  - On a reviewer it comes after today's re-request button and state icon, which stay as they are (rule 3).
  - Its menu is one `role="menuitem"`, `REMOVE_ASSIGNEE` / `REMOVE_REVIEWER`.
  - Choosing it closes the menu (focus back on the ellipsis) and calls `changePeople(iid, { group, action: "remove",
    username })`.
  - The menu is a DOM child of the box, `position: fixed` and placed by `useMenuPlacement` below the button, clamped.
    So `useHoverBox`'s inside rule holds it.
  - While that person's change is queued or running, the ellipsis is `LoaderCircle` spinning, `aria-busy` and
    `aria-disabled`, and the menu does not open.
- **One add field per box** (`adding: PeopleGroup | null`, local).
  - The add button opens `MergeRequestPeopleSearch` under that group's header and calls `searchPeople("")`.
  - The field focuses on mount.
  - `input` → `searchPeople(value)`.
- **The list.**
  - Empty text: `peopleSuggestions(rows, row, group, me)`; the Me line reads `ME_WORD` and `@username`.
  - A search: `peopleSearch`'s people with `SEARCHING_PEOPLE` while `searching`, `NO_ONE_FOUND` for `found` with
    nobody, and `peopleSearchText` for `refused`/`failed`.
  - Each line: `MergeRequestPicture` (initials when no person), name, muted `@username`.
  - In the group already: `alreadyText(group)`, `aria-disabled`.
  - Queued or running as an add: a spinner.
- **Keys.** The field is `role="combobox"` with `aria-controls` and `aria-activedescendant`; lines are `role="option"`
  with `aria-selected`.
  - ArrowDown/ArrowUp move the highlight over addable lines, wrapping.
  - Enter adds the highlighted line.
  - Escape closes the field (`preventDefault`, then focus on that add button).
  - A click on a line adds it; its `mousedown` is prevented, so the field keeps focus.
  - The highlight goes to the first addable line whenever the list changes.
- **Adding.** `changePeople(iid, { group, action: "add", username })`. Then the field clears to `""` (`searchPeople("")`)
  and keeps focus (GitLab's `clearAndFocusSearch`).
- **Notices.** The row's `notDone` show as `peopleChangeText`, `text-problem-error`, `role="status"`:
  - a remove → under that person's line while they are listed;
  - else under its group.
- **The box closes** (today's `closed` emit, kept). It calls `dismissPeopleNotices(row.iid)`, and `endPeopleSearch()`
  when a field was open; `adding` returns to null.
- **Focus.** Today's `keepFocusInBox` (`MergeRequestPeople.vue:87-99`) widens to every control of a line (re-request,
  ellipsis): a reply that removes the focused control moves focus to the box.
- **Pure logic.** Which lines show, their states, the highlight steps and where a notice goes live in
  `mergeRequestPeopleLines.ts`: pure, tested, shaped as you see fit. The `.vue` files only bind them.

## Change

1. `mergeRequestPeopleLines.ts` and its tests.
2. `MergeRequestPersonMenu.vue`, `MergeRequestPeopleSearch.vue`, then `MergeRequestPeople.vue`.
3. `mergeRequestsText.ts` words and tests. `mergeRequestTitles.test.ts` (read-only) keeps passing: `v-tooltip` only, no
   `title=`.
4. `ui/AGENTS.md`:
   - the people box's add, search, menu, queue and notices in a few lines (plan #169, #170);
   - the lines the state slice handed on in its `deviations_from_brief` (the orchestrator passes them).

## Acceptance

- **Vitest:**
  - `mergeRequestPeopleLines.test.ts`:
    - `already_in_the_group_is_not_addable_and_working_shows_for_a_queued_add`
    - `arrows_skip_people_already_there_and_wrap`
    - `the_highlight_returns_to_the_first_addable_line_when_the_list_changes`
    - `a_remove_notice_sits_under_its_listed_person_else_under_the_group`
    - `searching_keeps_the_last_people_and_found_nobody_is_no_one_found`
  - `mergeRequestsText.test.ts`: each new word and sentence, including the four `peopleChangeText` cases and a thrown
    cause's words.
  - `pnpm -C frontend lint`, `typecheck`, `test`: summary lines.
- **WebKit fixture** (`skill://verification` VF8/VF9). Run `just app-session start-fixture --name mp --diff --mr list
  --size 1600x1000`, open the page, then `read`/`shot`:
  1. **Add by typing.** On !640, hover the stack.
     - "Assignees" shows Sam with an ellipsis; "Reviewers" shows "None"; both have the `user-plus` button.
     - Click "Add reviewer". The field is focused, and the list's first line reads "Me @sam".
     - Type "erik". About 0.55 s later, "Erik Lund @erik" with its picture.
     - Click it. Its spinner shows; about 1 s later Erik is under Reviewers ("Review requested"), the field is empty
       and focused, and the stack shows his picture.
     - The "Reviewer" filter lists Erik Lund with 1.
  2. **Keyboard.** On !640, "Add assignee", leave the field empty.
     - The Me line reads "Already an assignee" and the highlight starts on the next line (Anna Berg, the author).
     - ArrowDown/ArrowUp move it over the other lines, skipping Me and wrapping.
     - Enter adds the highlighted person.
     - Escape closes the field, focus is on "Add assignee" and the box stays. A second Escape closes the box.
  3. **Suggestions.** On !638, "Add assignee", then click "Me": sam is added without typing.
  4. **Remove.** On !638, click chiara's ellipsis: the menu shows "Remove reviewer", and nothing is removed yet (no
     `fixture_people_change` line). Choose it: spinner, then chiara is gone; the approvals count is unchanged.
  5. **Queue.** On !636, add two people quickly. The second shows its spinner at once, but its
     `fixture_people_change` line is logged about 1 s after the first's.
  6. **Free and refusal.**
     - Add "olga" as assignee on !640. The sentence "GitLab did not add @olga as assignee (GitLab Free allows one
       assignee per merge request)." shows, and the assignees are unchanged.
     - Add "rita" as reviewer: "Cannot assign @rita to !640".
     - Close the box and reopen it: both sentences are gone.
  7. **Holding the box.**
     - With the field focused, move the pointer off the box and type more: the box stays.
     - Open an ellipsis menu by click, move the pointer away: the box and menu stay. Escape closes the menu only.
     - A click elsewhere on the page closes the box.
  8. **Not editable.** !632 (`mayRerequest` false): no `user-plus`, no ellipsis. !637 when editable: its dimmed icon
     opens a box with both empty groups.
  9. The same steps 1 and 4 in `--range-case review --mr list`. `shot` with a field open and with a menu open, in
     yamt Dark and yamt Light (`--settings '{"theme":"light"}'`). `stop --name mp`.
- **Real app** (the feature's wiring).
  - Run `scripts/local-conflicts-repo.sh <scratch>/mp`, build the debug app as `skill://verification` says, then `just
    app-session start-app --name mp --diff --dir <scratch>/mp --glab mr-people`. Open the page.
  - On !52, in the scenario's post order:
    1. "Add assignee", type "er": the fake glab log has one `argv:` line with `PeopleSearch` and `search=er`. Erik's
       picture loads from `yamt-picture:`. Click Erik.
    2. "Add reviewer", type "er", click Erik.
    3. Remove sam (assignee) through his menu.
    4. Remove chiara (reviewer) through her menu.
    5. Add anna (assignee) from the suggestions: the Free sentence.
    6. "Add reviewer", type "gh", click Ghost: "Reviewers not able to be set: ghost".
  - The log holds six `stdin:` bodies, each one mutation with `"mode":"APPEND"` or `"REMOVE"` and one username in
    order.
  - !50 shows no controls. `shot`. `stop --name mp`.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`, `skill://risk-register` (proposed RK64,
RK65).
