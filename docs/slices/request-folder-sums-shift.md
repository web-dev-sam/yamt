# Request — a folder's `+a −r` in the diff window's tree shows only while Shift is held

Settled with the owner on 2026-11-25 (session 59); details by the orchestrator as owner (OR13), the owner may veto.
Amends plan §2 #125 (folder rows always show their sum).

## Owner's words

- "can you also make the folder additions/deletions in the sidebar only visible while shift is being pressed?"

## Rules

1. **Shift shows them.** In the range window's tree view, every folder row's `+a −r` (`RangeApp.vue` folder slot,
   `RangeCounts`) shows from the Shift key going down until it goes up, by the one held-Shift rule the app already has
   (`ui/useShiftHeld.ts` `useShiftHeld`: a release WebKitGTK still reports as Shift, a window blur and a pointer event
   without Shift all end it). Not held → not shown.
2. **Nothing moves** (orchestrator, boring option): while hidden the counts keep their place (`invisible`, as
   `ChoiceView.vue:88`), so folder names do not re-truncate and the folder's reviewed check stays where it is when Shift
   goes down or up.
3. **Unchanged:** file rows' counts, the folder's reviewed check, list view, the merge-request line's totals, every
   other window. Shift pressed anywhere in the window counts, typing a capital in a text field included (the rule is
   the key, not the focus).

## Acceptance

WebKit fixture (`just app-session start-fixture --range-case review`, tree view) and the real app on
`scripts/range-repo.sh`, with **real** key input through WebDriver actions (`keyDown`/`keyUp` of `\uE008`, as
`briefs/mr-shift-held.md`): no folder counts shown; Shift down → every folder row's counts show, equal to before this
change; Shift up → hidden at once; Shift down, window blur, back → hidden; folder names and the reviewed check do not
move between the two states (same bounding boxes). File rows' counts always shown. `just check` passes; dark and light.

## Non-goals

A hint that the counts exist; a setting to keep them always on; hiding file rows' counts; Shift in the merge or
compare windows.
