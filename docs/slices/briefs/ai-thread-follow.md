# Slice AiThinkingFollow — the AI's thinking list capped at 20rem and following its end

Board "AI thread" row 1 (session 33). Request `docs/slices/request-ai-thread.md` rules 1–2 (read it whole); decision
`docs/plan.md` §2 **#124** (read it whole; its first half is this slice). Runs beside another slice that owns the
thread box (`RangeThreadBox.vue`), the AI ask (`rangeAi*.ts`) and `frontend/src/ui/AGENTS.md`; never touch those.

Facts (given, at `2fbb31e`):

- `ui/AiTurn.vue:14` `opened = shallowRef(false)`; `:41` the list `<ol v-if="opened" class="flex min-w-0 flex-col
  gap-2 border-l border-control-border pl-3">` holds thoughts, `said` lines and one `AiStep` per step; `:56` the
  answer (`useMarkdown`) sits below it, outside the list. No max-height, no overflow, no scrolling code today.
- The live turn (`RangeThreadBox.vue:194`) and a recorded answer (`RangeMessage.vue:147`) are two `AiTurn` instances;
  the list is closed again after the switch (non-goal to change).
- Updates arrive as a new `TurnView` object (immutable: `agent/internal/turn.ts` `withThought` returns new
  objects), at most once per 50 ms (`agent/internal/turnRun.ts:28`).
- `ui/AiStep.vue:28` a step's text output box `max-h-48 overflow-auto`; `ui/EditDiff.vue:103` an edit's diff box
  `max-h-96 overflow-auto rounded border border-control-border opaque-scroller font-mono`.
- `style.css:161` `@utility opaque-scroller` (needed for subpixel text in a scroller, plan §2 #60).
- The server log's follow rule, `ui/ServerLogView.vue`: `:17` `following = shallowRef(true)`; `:53-55`
  `scrollToEnd` (`scrollTop = scrollHeight`); `:94-97` `scrolled()` sets `following` to `scrollTop + clientHeight
  > = scrollHeight - 1`; `:45`+`:78-91` `keepPlace`after each log change (post flush): follows when`following`,
  > else restores the reader's top row (`anchor`, `topRow`, `droppedAbove`from`logFollow.ts`) because old lines drop
  > off the top; `:47-51`on mount focus Back,`nextTick`, scroll to end.
- Composable tests run in node with `effectScope` and plain objects (pattern `ui/useMarkdown.test.ts`).
- The thread box sits in a CodeMirror block row whose height is measured (`editor/internal/threadWidget.ts:13,38-41`,
  `threadHosts.ts:30` `ResizeObserver` → `requestMeasure`); the aligned bands must follow every height change.
- Fixture page: `?range&ai` plays `frontend/fixtures/agent/edit-and-command.jsonl` for every ask (79 lines, 21
  thought chunks and steps, 30 ms per line, so a turn runs ~2.4 s).

## Target

Owned: `frontend/src/ui/AiTurn.vue`, `frontend/src/ui/EditDiff.vue`, `frontend/src/ui/ServerLogView.vue`,
`frontend/src/ui/useFollowEnd.ts`, `frontend/src/ui/useFollowEnd.test.ts` (new).

Read-only: everything else (`frontend/src/ui/AGENTS.md` included: put the line it needs about `useFollowEnd` and the
cap in `deviations_from_brief`, worded ready to paste; the orchestrator has it added). Docs are the orchestrator's.

Non-goals: keeping the list open across the live → recorded switch; moving the section; `AiStep.vue`'s output box;
any change to what a turn sends; the compare and merge windows (the server log keeps its behaviour exactly).

## Contract (fixed; you may add, never change)

```ts
// frontend/src/ui/useFollowEnd.ts — the server log's follow rule; users: ServerLogView.vue and AiTurn.vue
export type FollowEnd = {
  /** True while the scroller's end is in view; false once the reader scrolls away; true again back at the end. */
  readonly following: Readonly<ShallowRef<boolean>>;
  /** The scroller's `@scroll` listener. */
  scrolled(): void;
};
/** While following, keeps `scroller` at its end after each change of `content` (post flush) and when the scroller
 *  element appears (an opened list starts at its end, following). Sets `scrollTop` only: never scrolls an ancestor. */
export function useFollowEnd(
  scroller: Readonly<ShallowRef<HTMLElement | null>>,
  content: WatchSource,
): FollowEnd;
```

## Change

1. `useFollowEnd.ts`: the rule above, moved out of `ServerLogView.vue` (one rule, two users — never a copy).
2. `ServerLogView.vue` uses it; its own anchor code stays for the not-following case (lines dropped above).
   Behaviour unchanged: opens at its end, follows, holds the reader's row while old lines drop off.
3. `AiTurn.vue`: the open list is at most 20rem tall (`max-h-80`), scrolls vertically inside with `opaque-scroller`,
   and follows its end through `useFollowEnd` (content: the turn's entries). The answer below is never capped. Same
   for a running and a recorded turn.
4. `EditDiff.vue:103`: `max-h-96` → `max-h-64` (16rem, so the whole diff box fits inside the 20rem list).

## Acceptance

- Node: `useFollowEnd.test.ts` — at the end, a content change scrolls to the new end; after the reader scrolls away
  (beyond the 1 px slack) a change leaves `scrollTop` alone; back at the end it follows again; a scroller that
  appears starts at its end with `following` true; no scroller → nothing thrown, nothing done. Your tests kill the
  mutants on your lines (Stryker, SP5).
- WebKit, fixture page (`just app-session start-fixture --range-case review --threads seeded --ai`, MiniBrowser
  1600×1000), dark and light: open a thread, Ask AI, open "Thinking and steps" while it runs — the list's computed
  `max-height` is 320px, `scrollHeight > clientHeight` once full, and after each update `scrollTop + clientHeight`
  is within 1 px of `scrollHeight`; scroll it up mid-turn (a turn lasts ~2.4 s: drive it from a script) → its
  `scrollTop` stays while entries keep arriving; scroll back to the end → it follows again. The recorded answer's
  list shows the same cap and opens at its end; its answer text is not capped; an opened edit diff inside the list
  is at most 256px and shows whole. The thread's aligned bands still line up after the list opens and fills
  (positions before/after, waiting for CodeMirror's first measure). Screenshots pasted.
- Server log (merge window, the fixture page with servers or the real app — the recipe you can reach): opens at its
  end, follows new lines, holds a scrolled-up place. Observed values pasted.

Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test`, `pnpm -C frontend fmt:check`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
