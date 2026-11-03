# Slice mr-shift-held — the "not" icons show only while Shift is held

Owner's words (#2145, corrected by #2146): Shift+click works as described; "just the icon that appears stays after a
shift press, thats a UI bug". Request `docs/slices/request-mr-row-details.md` rule 7 ("While Shift is held, every value
of an open checklist shows a 'not' icon"). Base: main `65f92b64`.

Known facts: the muted icons follow `useKeyModifier("Shift")` (`ui/MergeRequestFilter.vue:64`, `minusTone` at `:104`),
which sets its state from `getModifierState("Shift")` on key and mouse events. The click reads `$event.shiftKey`
(`:164`) and is right (owner #2146). Every earlier WebKit pass faked Shift with a synthetic `keydown` and never sent a
real release. [INFERENCE] On WebKitGTK the Shift release event still reports the modifier as set, so the state sticks
true until the next event.

## Target

Owned: `frontend/src/ui/MergeRequestFilter.vue`, `frontend/src/ui/useShiftHeld.ts` (new, if needed),
`frontend/src/ui/useShiftHeld.test.ts` (new), `frontend/src/ui/AGENTS.md`.

Read-only: everything else; the click path (`$event.shiftKey`, `mergeRequestFilters.ts`, core `clicked`) stays as is;
`docs/**` (doc lines in `deviations_from_brief`).

Non-goals: any change to what a click or Shift+click does; other windows.

## Rules

1. The icons show from the Shift key going down until that key goes up — whatever `getModifierState` reports on the
   release — and go on the window losing focus or the page being hidden.
2. A pointer event with `shiftKey` false and no Shift key down hides them (catches a release the page never saw).
3. Values already excluded keep their struck red icon regardless.

## Acceptance

- Reproduce first in the WebKit fixture (`just app-session start-fixture --diff --mr list --size 1600x1000`) with
  **real** key input through WebDriver actions (`keyDown`/`keyUp` of `\uE008` on the session's WebDriver endpoint, as
  `MrRowDetailsPageR1` sent pointer actions with curl), not synthetic DOM events: hover Assignee, press and release
  Shift, count the muted icons (the bug: they stay). After the fix: down → icons on; up → off at once; Shift+click
  "anna" → "Assignee: not anna" and, after release, only anna's red icon left; Shift down, window blur, back → off. Same
  in the real app (`just app-session start-app … --glab mr-row-details`, WebKitGTK).
- Vitest (node) for the held state: down/up, a release that still reports the modifier, blur, a pointer event with
  `shiftKey` false. `lint`, `typecheck`, `test` clean; `just mutants HEAD`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
