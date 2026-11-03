# Slice ci-job-log-page — Shift over a failed job shows its log beside the CI box, searchable

Feature: CI job log (request `docs/slices/request-ci-job-log.md` rules 1–7 and the WebKit-fixture acceptance; design
`docs/slices/briefs/ci-job-log-design.md` option A, §1.5–1.7, §2.3–2.4; proposed plan §2 #160, #161; proposed RK59).
Needs `ci-job-log-state` (the slice's `jobLog`, `showJobLog`, `closeJobLog`, `jobSearch`, `setJobSearch`; the fixture's
logs) and `ci-job-log-palette` (the `text-ansi-*`/`bg-ansi-*` classes) landed, and so `ci-job-log-core`. Wires the
window: last implementer slice.

## Target

Owned: `frontend/src/ui/CiStatusBox.vue`, `frontend/src/ui/CiStatusJobLog.vue` (new),
`frontend/src/ui/mergeRequestLogLook.ts` (new), `frontend/src/ui/mergeRequestLogLook.test.ts` (new),
`frontend/src/ui/mergeRequestsText.ts`, `frontend/src/ui/mergeRequestsText.test.ts`, `frontend/src/ui/problem.ts`,
`frontend/src/ui/problemText.ts`, `frontend/src/ui/problemText.test.ts`, `frontend/src/ui/useHoverBox.ts`,
`frontend/src/ui/useHoverBox.test.ts`, `frontend/src/ui/useShiftHeld.ts`, `frontend/src/ui/useShiftHeld.test.ts`,
`frontend/src/ui/keyHold.ts`, `frontend/src/ui/keyHold.test.ts`, `frontend/src/ui/altHold.ts`,
`frontend/src/ui/altHold.test.ts`, `frontend/scripts/app-session/keys.ts`, `frontend/scripts/app-session/keys.test.ts`,
`frontend/src/ui/AGENTS.md`.

Read-only: everything else — the state (`ui/mergeRequests.ts`, `ui/mergeRequestJobLogs.ts`, `ipc/**` and its
fixtures: use them as contracted), `mergeRequests/**` and `search/**` (use their exports), `ui/rangeKeys.ts`
(`isTypingTarget`), `ui/useMenuPlacement.ts`, `ui/menuPosition.ts`, `ui/useFollowEnd.ts`, `ui/tooltip.ts`,
`ui/MergeRequestRow.vue` (its `openJob` already opens the page), `ui/MergeRequestFilter.vue` (uses `useShiftHeld()`,
whose type stays), `ui/mergeRequestTitles.test.ts` (the no-`title` detector: must stay green), `style.css` and
`themes/**` (the palette slice's), `docs/**`.

Non-goals: folding, timestamps, durations; regex or match-case search; a log outside the merge-request page; a second
Shift listener; any `editor/` code; a virtualised list (design §1.5: rendered whole, measured below).

## Contract

Existing and fixed by the earlier slices: `useMergeRequests()` gives `jobLog`, `showJobLog(job)`, `closeJobLog()`,
`jobSearch(name)`, `setJobSearch(name, text)` (`ui/mergeRequestJobLogs.ts`, brief `ci-job-log-state.md`); the core's
`JobLogView`, `LogStyle`, `AnsiColour`, `hitPlaces`, `firstHit`, `steppedHit`, `hitCountText`, `NO_RESULTS`
(`ci-job-log-core.md`); `search/` `matcherOf`.

New here:

```ts
// ui/keyHold.ts — one listener set, its state now any type (altHold keeps its boolean)
export type KeyHoldEvent =
  | { readonly kind: "keydown"; readonly key: string; readonly repeat: boolean }
  | { readonly kind: "keyup"; readonly key: string; readonly altKey: boolean; readonly shiftKey: boolean }
  | { readonly kind: "pointer"; readonly altKey: boolean; readonly shiftKey: boolean; readonly pressed: boolean } // pressed: pointerdown
  | { readonly kind: "left" };
export type KeyHold<S> = {
  readonly start: S;
  after(state: S, event: KeyHoldEvent): S;
  /** Whether pointer events are listened to (only while a key is held, as now). */
  holding(state: S): boolean;
};
export function useKeyHold<S>(hold: KeyHold<S>, pointerEvents: readonly string[]): Readonly<ShallowRef<S>>;

// ui/useShiftHeld.ts — replaces shiftHeldAfter
export type ShiftState =
  | { readonly kind: "up"; readonly taps: number }
  | { readonly kind: "held"; readonly alone: boolean; readonly taps: number };
export function shiftAfter(state: ShiftState, event: ShiftEvent): ShiftState;
export function useShiftHeld(): Readonly<Ref<boolean>>; // unchanged meaning: from Shift's keydown to its keyup
/** Counts Shift taps: Shift down then up with no other key and no pointer press between. */
export function useShiftTaps(): Readonly<Ref<number>>;

// ui/mergeRequestLogLook.ts
/** The classes of a run: full class names from static tables (Tailwind sees them), "" for the plain style. */
export function runClasses(style: LogStyle): string;
```

`shiftAfter` rules (`ShiftEvent.pointer` gains `pressed`): keydown `Shift` from `up` → `held { alone: true }`, while
`held` unchanged (repeats); keydown of another key while `held` → `alone: false`; keyup `Shift` while `held` → `up`,
`taps + 1` when `alone`; a pointer event while `held` without `shiftKey` → `up` (no tap, as now); with `pressed` →
`alone: false`; `left` → `up`, taps kept; anything while `up` but Shift's keydown → unchanged. `taps` never decreases.
Both composables read one `createSharedComposable` state (one listener set per window, ui/AGENTS.md:51). The X11 note
(`useShiftHeld.ts:18-19`) stays.

`runClasses`: foreground `text-ansi-red` … `text-ansi-bright-white`, background `bg-ansi-…` (Record<AnsiColour,
string> each, 16 entries), `font-bold`, `italic`, `underline`, `line-through`, both lines as
`[text-decoration-line:underline_line-through]` (two utilities set the same property: one would win).

`ui/problem.ts`: `MergeRequestStep` gains `"jobLog"`; `problemText.ts`: `jobLog: "Could not read the job's log"`.

`ui/mergeRequestsText.ts` (design §2.4 words, exact):

- `jobTitle(name, page)`: a page → `Open the log of ${name} on GitLab. Shift: show the log here`; null unchanged.
- `jobLogTitle(name)` → `Log of ${name}`; `JOB_LOG_LOADING = "Loading the log…"`; `JOB_LOG_SEARCH = "Search the log"`;
  `JOB_LOG_CUT = "Earlier lines are on GitLab."`; `JOB_LOG_WHOLE = "Open the whole log on GitLab"`.
- `jobLogRefusalText(reply)`, exhaustive over the non-`log` replies: `noLog` "GitLab has no log for this job.";
  `notOffered` "This job's log was not listed by GitLab, so yamt did not read it."; `glabMissing`
  `${GLAB_MISSING_TEXT} — install glab, then press Shift over the job again.`; `notLoggedIn`
  `${glabNotLoggedInText(detail)} — run glab auth login in a terminal, then press Shift over the job again.` (as
  `:49-55`); `failed` `Could not read the log: ${message}`.

**`CiStatusBox.vue`**:

- Tracks the pointed job (`pointerenter`/`pointerleave` on each `<li>`) and the focused one (`focus`/`blur` on its
  button); the job a tap asks for is the pointed one, else the focused one.
- `watch(useShiftTaps(), …)`: inside the watcher, nothing unless the CI box is `open`, the job has a page, and
  `!isTypingTarget(document.activeElement)` (`ui/rangeKeys.ts:26`); then `showJobLog({ name, page })`. Never watch
  `open && held`: a Shift already held as the box opens would count.
- Renders `<CiStatusJobLog :key="shown.job.page" :shown :anchor @close @open-job>` as a DOM child of the `area` span
  (after the box `div`, so `useHoverBox`'s one inside rule covers both, design §1.6) while `open` and the shown job's
  page is one of this box's jobs; `anchor` = the box's `useElementBounding` `{ left, top }`.
- When `open` turns false with its job shown → `closeJobLog()`. The log's `close` → `closeJobLog()`, then focus that
  job's button (a second Escape then closes the CI box). `openJob` re-emits as the job click does.
- The job button gets `aria-keyshortcuts="Shift"`. No `title` attribute anywhere (`mergeRequestTitles.test.ts`).

**`useHoverBox.ts`**: `keyPressed` ignores an Escape whose `defaultPrevented` is already true.

**`CiStatusJobLog.vue`** (props `{ shown: ShownJobLog; anchor: { left: number; top: number } }`, emits `{ close: [];
openJob: [page: WebPage] }`):

- `fixed`, `w-[min(56rem,calc(100vw-2rem))] h-[min(36rem,calc(100vh-2rem))]`, `useMenuPlacement(box, () => ({ x:
  anchor.left − box width, y: anchor.top }))` (clamped by `menuPosition.ts:7-12`); `role="dialog"`,
  `aria-label` = `jobLogTitle(name)`; border and shadow as the CI box.
- Header (`bg-panel-inline`): the title, the field (`type="text"`, `aria-label` and placeholder `JOB_LOG_SEARCH`), the
  count (`aria-live="polite"`): `hitCountText` or `NO_RESULTS` (nothing for an empty field).
- Body (`bg-panel`, `font-mono`, `whitespace-pre-wrap`, `[overflow-wrap:anywhere]`, `overflow-y-auto`,
  `tabindex="0"`): `loading` → `JOB_LOG_LOADING`; `refused` → `jobLogRefusalText`; `failed` → `problemText({
  action: "mergeRequests", step: "jobLog", cause }, platform)`; `shown` → when `cut`, a first line `JOB_LOG_CUT` and a
  button `JOB_LOG_WHOLE` emitting `openJob(page)`; then one `div` per `LogLine` whose only children are one `span`
  per run with `runClasses(run.style)` and the run's text (text, never `v-html`: RK57). `useFollowEnd(scroller,
  () => lines)` starts it at the end.
- On mount: the field gets `jobSearch(name)`, focus and `select()`. On input: `setJobSearch(name, text)`; matches
  `matcherOf({ text, matchCase: false })?.hits(view.text, Infinity)` → `hitPlaces` → one `Range` per place
  (`lines.children[line].children[run].firstChild`, offsets) → `CSS.highlights.set("job-log-match", new
  Highlight(...))` and `"job-log-current"` with the current one; the current starts at `firstHit` (the last) and is
  centred with `scrollTop` only (never `scrollIntoView`, `useFollowEnd.ts:10-11`); no hit → no scroll. Enter /
  Shift+Enter in the field → `steppedHit`, centred. Both highlights deleted on unmount.
- Escape anywhere in the log → `preventDefault()`, `emit("close")`.
- A non-scoped `<style>`: `::highlight(job-log-match) { background-color: var(--color-search-match) }`,
  `::highlight(job-log-current) { background-color: var(--color-primary); color: var(--color-on-primary) }`.

**`scripts/app-session/keys.ts`**: `press Shift` alone parses (a named key `Shift`: WebDriver `\uE008`, xdotool
`Shift_L`) so the smoke runs can tap Shift; `Shift+a` and the other chords unchanged.

## Change

1. `keyHold.ts` generic, `altHold.ts` passing its rule, `useShiftHeld.ts` `shiftAfter`/`useShiftTaps`; their tests.
2. `useHoverBox.ts` and its test; `problem.ts`/`problemText.ts` and test; `mergeRequestsText.ts` and test;
   `mergeRequestLogLook.ts` and test; `keys.ts` and test.
3. `CiStatusJobLog.vue`; `CiStatusBox.vue`.
4. `ui/AGENTS.md`: the log box (Shift tap, inside rule, Escape order, highlights, remembered text), amend the "Held"
   lines (ui/AGENTS.md:51) for `shiftAfter`/`useShiftTaps`, and the state slice's `deviations_from_brief` `ui/` lines.

## Acceptance

- Step 0, before any `.vue` work, in the fixture app (`just app-session start-fixture --name cl --diff --mr list
  --size 1600x1000`): `just app-session read --name cl "typeof Highlight === 'function' && 'highlights' in CSS"` →
  `true`. If not: stop, report it; the orchestrator switches to option B.
- Vitest, each named for the bug it catches, at least: `shiftAfter`: `a_lone_shift_press_and_release_is_a_tap`,
  `shift_with_another_key_is_no_tap` (Shift+E), `shift_with_a_pointer_press_is_no_tap` (Shift+click),
  `a_held_repeat_keeps_the_tap`, `leaving_the_window_ends_the_hold_without_a_tap`,
  `a_pointer_without_shift_ends_the_hold_without_a_tap`, the existing held/not-held cases moved to `shiftAfter`;
  `useShiftTaps`: `held_and_taps_share_one_listener_set`; `keyHold`: `the_state_is_the_rules_own_type`,
  `pointer_events_are_heard_only_while_holding`, `a_pointerdown_is_pressed`; `altHold` tests unchanged and green;
  `useHoverBox`: `an_escape_handled_inside_leaves_the_box_open`; `runClasses`: `every_colour_has_its_class_both_ways`,
  `underline_and_strike_together_keep_both_lines`, `the_plain_style_has_no_class`; texts: every new word and each
  refusal (exhaustive); `problemText`: the `jobLog` row; `keys`: `a_lone_shift_is_a_key_both_ways`.
- `pnpm -C frontend lint`, `typecheck`, `test` (including `mergeRequestTitles.test.ts`, palette and themes fences),
  `just arch-check` (PM10), `just map-check`: summary lines.
- WebKit smoke on the fixture (`skill://verification` recipe; `hover`, `press Shift --x11`, `type --x11`, `read`,
  `shot`): the CI box of the first failed row open, `hover` over `lint:docs`, `press Shift --x11` → the log left of
  the CI box, coloured, at its end, focus in the field; `type --x11 Error` with the pointer over `test:unit` → the
  same log, count "N of M"; Escape, Escape → both closed. Two `shot`s with the log open: yamt Dark, and yamt Light
  (Settings → Theme → the yamt row's light button; `start-fixture` has no `--settings`, `args.ts:26-29`).
- Timings in WebKit (record both): Shift to the long `test:unit` log's last line painted ≤ 1.5 s (`read` an async
  expression that awaits two `requestAnimationFrame`s after the `mergeRequests.job_log_shown` event, or the state's
  `ms` plus the paint); a one-letter query on it to highlights painted ≤ 250 ms. Over budget: report the numbers as a
  design finding (design §1.5); do not virtualise or narrow the acceptance.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://comment-policy`, `skill://risk-register` (proposed RK57,
RK59), `skill://verification`.
