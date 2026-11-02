# Slice mr-row-details-page — the rows' people, labels and due dates, the hover filters, one tooltip (wires the window)

Feature: merge-request row details (request `docs/slices/request-mr-row-details.md` rules 1–11, Acceptance "WebKit
fixture" and "Real app"; design `docs/slices/briefs/mr-row-details-design.md` option A, §1.2–1.7, §2.3; proposed plan §2
#151–#157; owner answers #2100–#2105). Runs after `mr-row-details-state` and `mr-row-details-hover` have landed (and so
after `-rust`, `just bindings` and `-core`). **This slice wires the window together**: its real-app run is the feature's
first end-to-end proof, and after it `pnpm -C frontend typecheck` is clean again.

## Target

Owned: `frontend/src/ui/MergeRequestRow.vue`, `frontend/src/ui/MergeRequestFilter.vue`,
`frontend/src/ui/MergeRequestsView.vue`, `frontend/src/ui/CiStatusBox.vue`, `frontend/src/ui/MergeRequestReadiness.vue`,
`frontend/src/ui/MergeRequestsButton.vue`, `frontend/src/ui/MergeRequestPicture.vue` (new),
`frontend/src/ui/MergeRequestPeople.vue` (new), `frontend/src/ui/MergeRequestLabels.vue` (new),
`frontend/src/ui/MergeRequestDueDate.vue` (new), `frontend/src/ui/mergeRequestsText.ts`,
`frontend/src/ui/mergeRequestsText.test.ts`, `frontend/src/ui/mergeRequestTitles.test.ts` (new),
`frontend/src/ui/AGENTS.md`.

Read-only: everything else — `ui/mergeRequests.ts` and the other state files, `ipc/**` and its fixtures (the state
slice's: use them as contracted), `mergeRequests/**` (the core's), `ui/tooltip.ts`, `ui/useHoverBox.ts`,
`ui/useHoverMenu.ts`, `ui/useDropdownMenu.ts`, `ui/operationTooltip.ts` (the hover slice's), `ChoiceButtons.vue` (has no
`title`), `style.css` (no new token: the palette fence; the initials' colour is a hue rotation), `src-tauri/**` (the
CSP is the Rust slice's), every other window's file (owner answer 2), `docs/**` (the docs keeper's: put the lines in
`deviations_from_brief`). Four new components: each needs its one-line reason in `deviations_from_brief` (VU15).

Non-goals: adding, assigning or removing anyone, a button for assignees (owner #2104); approving; labels or due dates
on GitLab; sorting beyond owner answer 3; tooltips in other windows; building any picture address (the domain's
`picture` is the only one used).

## Contract

Given by the earlier slices (fixed): core `peopleStack`, `STACK_SHOWN`, `displayName`, `initials`, `pictureHue`,
`reviewStateText`, `reviewDone`, `authorText`, `approversText`, `NO_PEOPLE_TEXT`, `labelsShown`, `moreText`,
`dueDateText`, `daysLeft`, `daysLeftText`, `calendarDayFrom`, `calendarDayText`, `Choice.state`, `filterLabel`; state
`MergeRequests.click`, `dueDates`, `setDueDate`, `rerequests`, `rerequestReview`, `dismissRerequestRefusals`,
`RerequestAsk`; domain `Person.picture: string | null`, `Reviewer`, `Label`, `RerequestReply`,
`MergeRequestRow.author`/`approvedBy`/`mayRerequest`; hover `vTooltip`, `useHoverBox`, `useHoverMenu`
(`pointerEntered`, `pointerLeft`, `openerClicked`, `menuKey`, `openFor`, `above`), `HOVER_CLOSE_MS`,
`TOOLTIP_DELAY_MS`.

Fixed here (add-only beyond this):

```ts
// MergeRequestPicture.vue — one person's round picture, or the dimmed person icon for nobody
defineProps<{ person: Person | null; size: "row" | "stack" | "box" }>(); // 24 px, 20 px, 20 px
// always draws the initials (core `initials`) on `bg-primary text-on-primary` with style filter hue-rotate(<pictureHue>deg);
// when person.picture is not null: <img :src="person.picture" alt="" referrerpolicy="no-referrer"> over it, invisible
// until `load`, removed on `error` (no broken image); person null → Lucide `user-round` in text-fg-muted. No tooltip
// of its own (the user of it puts one).

// MergeRequestPeople.vue — the stack and its box (useHoverBox), a row control
defineProps<{ row: MergeRequestRow; asks: ReadonlyMap<string, RerequestAsk> }>();
defineEmits<{ rerequestReview: [username: string]; closed: [] }>();
// stack: peopleStack(row.assignees, row.reviewers): up to 3 overlapping pictures, then moreText(more); nobody →
// MergeRequestPicture(null) with v-tooltip NO_PEOPLE_TEXT and aria-label the same.
// box (opens at once on hover or focus): "Assignees", then "Reviewers" (a group with nobody is left out). An assignee:
// picture and displayName, nothing else. A reviewer: picture, displayName, then at the row's end, as on GitLab's page,
// the re-request button when row.mayRerequest && reviewDone(state) — Lucide `rotate-ccw`, v-tooltip REREQUEST_REVIEW,
// aria-label rerequestLabel(name); asks.get(username): running → spinner in its place, aria-busy, disabled — then the
// state icon (REVIEW_STATE_LOOKS below) with v-tooltip and aria-label reviewStateText(state). A refused ask:
// rerequestReplyText(reply, name) under that reviewer, text-problem-error, role="status". Closing the box emits `closed`.
const REVIEW_STATE_LOOKS: Readonly<Record<ReviewState, { icon: Component; tone: string }>> = {
  requested: { icon: CircleMinus, tone: "text-fg-muted" }, // GitLab `dash-circle`
  reviewed: { icon: MessageSquareText, tone: "text-primary" }, // GitLab `comment-lines`, info
  approved: { icon: CircleCheck, tone: "text-success-signal" }, // GitLab `check-circle`, success
  changesRequested: { icon: CircleAlert, tone: "text-problem-error" }, // GitLab `error`, danger
};

// MergeRequestLabels.vue — first chip and "+N" with a hover box (useHoverBox) of the rest
defineProps<{ labels: readonly Label[] }>();
// a chip: the title, rounded, text-xs, style { backgroundColor: colors.background, color: colors.text } when colors,
// else bg-hover text-fg; max width 10rem, truncated with its title in v-tooltip; no labels → nothing rendered.

// MergeRequestDueDate.vue — the due-date column, a row control
defineProps<{ due: CalendarDay | null; now: number }>();
defineEmits<{ set: [day: CalendarDay | null] }>();
// none: a muted Lucide `calendar` button, aria-label and tooltip SET_DUE_DATE. Set: a button showing dueDateText(due)
// over daysLeftText(daysLeft(due, now)).text (text-problem-error when overdue), tooltip and aria-label
// dueDateLabel(...). A click opens a box below it (useMenuPlacement): <input type="date" :value="calendarDayText(due)">
// focused, and CLEAR_DUE_DATE when set; a valid `change` emits `set(day)` and closes; Clear emits `set(null)` and
// closes; Escape or a click outside closes without change.

// MergeRequestRow.vue — props gain
due: CalendarDay | null;
asks: ReadonlyMap<string, RerequestAsk>;
// emits gain: setDue: [iid, day: CalendarDay | null]; rerequestReview: [iid, username]; peopleBoxClosed: [iid]

// MergeRequestFilter.vue — presentational; the View owns its menu
defineProps<{
  filter: ListFilter;
  label: string;
  set: boolean;
  choices: readonly Choice<Value>[];
  open: boolean;
  above: boolean;
}>();
defineEmits<{
  click: [value: Value, shift: boolean];
  clear: [];
  openerClick: [];
  pointerEnter: [];
  pointerLeave: [];
  menuKey: [event: KeyboardEvent];
}>();
defineExpose({ opener, menu }); // elements for the View's useHoverMenu

// mergeRequestsText.ts — added
export const ASSIGNEES = "Assignees";
export const REVIEWERS = "Reviewers";
export const REREQUEST_REVIEW = "Re-request review"; // GitLab's words
export function rerequestLabel(name: string): string; // "Re-request review from Anna Berg"
export function rerequestReplyText(
  reply: Exclude<RerequestReply, { kind: "requested" }>,
  name: string,
): string;
//   notReviewer "Anna Berg is no longer a reviewer of this merge request." · notOpen "This merge request is no longer
//   open." · glabMissing / notLoggedIn: the list's sentences (`listFailureText`'s) · refused / failed: the message as sent
export const SET_DUE_DATE = "Set a due date";
export const CLEAR_DUE_DATE = "Clear";
export function dueDateLabel(date: string, left: string): string; // "Due Nov 9, 2026, 7 days left. Change the due date"
export function notValueLabel(label: string): string; // "not anna" (an excluded value's accessible name)
```

Row layout (design §2.3), left to right: `MergeRequestPicture` of `row.author` (row size; `v-tooltip` and `aria-label`
`authorText(row.author)`; a click on it still opens the page); the text column (line 1 the title alone; line 2 today's
meta text, then `MergeRequestLabels` at its end, the meta text truncating before the labels); `MergeRequestPeople`
(`w-16`); `MergeRequestDueDate` (`w-24`); discussions; approvals (`aria-label` `approvalsText(row.approvedBy.length)`,
`v-tooltip` `approversText(row.approvedBy)`); CI; readiness; action; Show Diff. Row controls (`data-row-control`,
`@click.stop`): the people stack and its box, the "+N" chip and its box, the due-date column and its box, as the CI box
today (#137).

Filters (`MergeRequestsView.vue`): one `useHoverMenu<ListFilter>` for the three; each `MergeRequestFilter` gets `open =
openFor === filter` and `above`; its wrapper's `pointerenter`/`pointerleave` (button and list inside it) call
`pointerEntered(filter)`/`pointerLeft()`; the opener's click calls `openerClicked(filter)` and focuses the narrowing box
as today; a value's click emits `click(value, event.shiftKey)` → `requests.click`. In the list: a leading slot (`size-4`)
shows `circle-minus` muted on every not-excluded value while Shift is held (`useKeyModifier("Shift")`), and on an
excluded value always in `text-problem-error`, its label struck (`line-through`) in the same colour; then today's check
slot (`check` when included); `aria-checked` true for included and excluded, the excluded one's accessible name
`notValueLabel(label)`.

Tooltips: every `title`/`:title` in the owned `.vue` files becomes `v-tooltip` with the same text (today 12:
`MergeRequestRow.vue` 8, `MergeRequestReadiness.vue`, `MergeRequestFilter.vue`'s ×, `MergeRequestsButton.vue`,
`CiStatusBox.vue`'s job button); `aria-label`s stay. `CiStatusBox.vue` moves onto `useHoverBox` with the same behaviour.

## Change

1. The four new components; `MergeRequestRow.vue`'s layout and props; the View's props for rows (`due`:
   `dueDates.get(row.iid) ?? null`, `asks`: `rerequests.get(row.iid) ?? EMPTY`) and events (`setDue` → `setDueDate`,
   `rerequestReview`, `peopleBoxClosed` → `dismissRerequestRefusals`).
2. `MergeRequestFilter.vue` and the View's one hover menu; the three-state look; Shift.
3. `v-tooltip` everywhere in the owned files; `CiStatusBox.vue` on `useHoverBox`.
4. `mergeRequestsText.ts` words and tests.
5. `mergeRequestTitles.test.ts`: the detector — every `ui/MergeRequest*.vue` and `ui/CiStatus*.vue` (read from disk)
   has no attribute `title=` or `:title=` (`/\s:?title=/`); and its failing path (a sample text with `:title="x"` is
   reported with file and line).
6. `ui/AGENTS.md`: the page's people, labels, due dates, hover menu and tooltip in a few lines, plus the lines the state
   and hover slices handed on in their `deviations_from_brief` (the orchestrator passes them).

## Acceptance

- Vitest: `mergeRequestsText.test.ts` (each new sentence), `mergeRequestTitles.test.ts` (clean tree; the failing path).
  `pnpm -C frontend lint`, `typecheck` (clean), `test`: summary lines.
- WebKit fixture (`skill://verification` VF8/VF9): `just app-session start-fixture --name rd --diff --mr list --size
  1600x1000`; open the page; then `read`/`shot`:
  1. !640's first element is its author's picture; hovering it shows after about 0.4 s the tip "Author: Anna Berg";
     anna's `img` has loaded (`naturalWidth > 0`); a row authored by ben shows "BO" and no visible `img`; a row
     authored by chiara has no `img` at all.
  2. A row with four people shows three pictures and "+1"; hovering opens the box with "Assignees" and "Reviewers"; no
     assignee entry has a button; each reviewer shows its state icon, the words on hover; a reviewer in state
     "Reviewed", "Approved" or "Changes requested" has the `rotate-ccw` button left of the icon, one in "Review
     requested" none, and a row with `mayRerequest` false none at all. "Re-request review" on a done reviewer: spinner,
     then after about 1 s the icon reads "Review requested" and the button is gone; on dmitri: the refusal sentence;
     !637 (nobody) shows the dimmed icon with "No assignee or reviewer".
  3. !640's approvals tip "No approvals"; a row with three approvals: three names on three lines.
  4. !640 shows the chip "backend" and "+1"; hovering "+1" shows "bug"; !636 shows no label.
  5. Set !630's due date to tomorrow: "1 day left" and !630 is the first row; change it to yesterday: "1 day overdue" in
     the error colour; reload the page: kept; clear it: gone, !630 back in its place.
  6. Hover "Assignee": its list opens without a click; move to "Label": Assignee's closes at once, Label's opens; leave
     both: closed about 0.3 s later. Values read in count order. Hold Shift: the `circle-minus` icons show;
     Shift+click "Me": the button reads "Assignee: not Me"; click "frontend" in Label: the summary reads "6 of 40 merge
     requests" and the rows are !639, !627, !623, !619, !607, !603; reload: the same.
  7. `document.querySelectorAll("[title]")` inside the page section and on the header's merge-requests button: 0.
  8. `--mr local`: !635 shows "+0 −0 · 0 files", its CI icon and, after 1.5 s, the readiness icon with "No conflicts
     (checked locally). GitLab has not checked the rest yet".
  9. `shot` in dark and light (`--settings '{"theme":"light"}'`); `stop --name rd`.
- Real app (the feature's wiring): `scripts/local-conflicts-repo.sh <scratch>/rd` (a repository whose remote names
  `taskboard/taskboard`), build the debug app with its pages as `skill://verification` says, `just app-session start-app
  --name rd --diff --dir <scratch>/rd --glab mr-row-details`; open the page; read: !52's author picture (anna) and sam's
  loaded from `yamt-picture:`; ben's `img` `src` is exactly the scenario's `https://secure.gravatar.com/avatar/…`
  address (loaded or not, depending on the network: initials stay under it); chiara and dmitri as initials with no
  `img`; the labels `frontend` and `+2` with `frontend`'s background `rgb(66, 139, 202)`; "+0 −0 · 0 files"; !51 no
  size and the dimmed people icon; !50's reviewer icons and no re-request button (`mayRerequest` false); on !52 ben has
  the button, dmitri ("Review requested") none. "Re-request review" on ben → "Review requested"; the fake glab log holds
  the mutation's `stdin:` body with ben's global id, one picture call per uploaded picture and none naming Gravatar.
  `shot`; `stop --name rd`.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
