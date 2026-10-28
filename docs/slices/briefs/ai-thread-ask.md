# Slice AiAskBottom — Ask AI at the bottom of a thread; what you typed is added and sent in one step

Board "AI thread" row 2 (session 33). Request `docs/slices/request-ai-thread.md` rules 3–6 (read it whole; the
owner's answer "Send it in one step" is binding); decision `docs/plan.md` §2 **#124** (read it whole; its second half
is this slice), with #115, #120, #121, #123. Runs beside another slice that owns `AiTurn.vue`, `EditDiff.vue`,
`ServerLogView.vue` and a new `useFollowEnd.ts`; never touch those. The orchestrator may send you one paragraph for
`frontend/src/ui/AGENTS.md` from that slice: add it as given.

Facts (given, at `2fbb31e`):

- `ui/RangeThreadBox.vue`: header `:150-185` = place text, then Stop (`stoppable`, `:153`) or Ask AI (`askable`,
  `:161-174`, the disabled button wrapped in a `<span>` carrying the hover text), then the collapse button; messages
  `:186`; the live `AiTurn` `:194`; the textarea `:202` (`text` from `threads.noteText` / the draft); the Comment /
  Cancel row `:212` shown only when `draft !== null || !blank`; Comment has `@mousedown.prevent` so the field keeps
  focus; `submit` `:116-125` calls `threads.addThread(key, text)` on a draft or `threads.addNote(id, text)`.
- `ui/rangeThreads.ts`: `addThread(draftKey, text): Promise<void>` `:157-175` (no draft, blank, or an add of that key
  running → returns; a refusal writes the text back to the draft and reports `step: "add"`; success opens the thread,
  keys it to the draft key, drops the draft); `addNote(thread, text): Promise<void>` `:177-183` (blank → returns;
  `changed(…, "note", …)`; empties the note draft when stored, writes the text back when refused).
- `ui/rangeAi.ts`: `RangeAi.ask(thread)` `:227-237` and `canAsk(thread)` `:123-129` (`running === null`, not
  `waiting` — the stored session not yet loaded or its replay not yet recorded — and `promptText !== null`);
  `promptText` `:110-121` = the notes since the session's last answer, wrapped in First message when the session has
  no answer yet; `State.threads` is `Pick<RangeThreads, "list" | "setSession" | "addAiAnswer">`; `retry` calls the
  internal `ask`. `byThread` is a `shallowRef` (what makes `canAsk` reactive in the component).
- `ui/rangeAiView.ts:46-48` `answering(ai)` (Stop instead of Ask AI). `ui/rangeThreadText.ts:22-27` the Ask AI and
  Stop words; `ASK_AI_TITLE` / `ASK_AI_WAITING` are the enabled and disabled hover texts.
- `ui/rangeKeys.ts:11-14`: in the field Ctrl/Cmd+Enter is `submit` (Comment), Escape is `cancel`.
- `rangeStore.ts:125-128` builds the `RangeAi` (`createRangeAi(agent.client, state.threads, …)`) and spreads it with
  `client`; `ai` is null without `--ai`.

## Target

Owned: `frontend/src/ui/RangeThreadBox.vue`, `frontend/src/ui/{rangeAi,rangeAi.test,rangeAiView,rangeAiView.test,
rangeThreads,rangeThreads.test,rangeThreadText,rangeThreadText.test,rangeStore,rangeStore.test}.ts`,
`frontend/src/ui/AGENTS.md`.

Read-only: everything else; docs outside `ui/AGENTS.md` are the orchestrator's (list needed lines in
`deviations_from_brief`).

Non-goals: a key for Ask AI; the "Thinking and steps" list; what one turn sends (#121); the First message template;
the close question; Edit/Delete (#123); the compare and merge windows.

## Contract (fixed; you may add, never change)

```ts
// ui/rangeThreads.ts — RangeThreads (return values added; every caller migrated)
/** The added thread; null when nothing was added (no such draft, blank text, an add of it running, a refusal). */
addThread(draftKey: string, text: string): Promise<ThreadId | null>;
/** Whether the note was stored; a blank text is not sent. */
addNote(thread: ThreadId, text: string): Promise<boolean>;

// ui/rangeAi.ts
/** Where Ask AI was pressed: an open thread, or a line's new thread not added yet (its draft key). */
export type AskFrom =
  | { readonly kind: "thread"; readonly thread: ThreadId }
  | { readonly kind: "draft"; readonly key: string };

export type RangeAi = {
  of(thread: ThreadId): ThreadAi;
  /** Ask AI (plan #124): a non-blank `typed` is added first (the note, or the new thread) and the AI is asked once
   *  it is stored; a failed add asks nothing; nothing typed asks with the notes since the last answer. */
  ask(from: AskFrom, typed: string): Promise<void>;
  /** Plan #124: no turn runs, the conversation has loaded, no add of its own ask runs, and something to send. */
  canAsk(from: AskFrom, typed: string): boolean;
  retry(thread: ThreadId): void;
  stop(thread: ThreadId): void;
  load(thread: ThreadId): void;
};
```

The rule lives in `rangeAi.ts` (node-tested), never in the component: the box only passes its `AskFrom` and text.

## Behaviour (plan #124, request rules 3–6)

1. The header keeps the place text and the collapse button only. Stop and Ask AI move to the bottom row, in this
   order: Comment, Ask AI (Stop in its place while this thread's turn runs), Cancel. Ask AI keeps the field's focus
   as Comment does.
2. With `--ai` the row shows on every open thread and on a line's new thread, text typed or not; without `--ai` the
   box is exactly as before (row only on a new thread or with text typed; no AI control).
3. Ask AI with non-blank text typed: the text is added as your note exactly as Comment adds it, and once stored the
   AI is asked; the field empties as after Comment. Nothing typed: your notes since the AI's last answer, as today.
   A failed add shows its problem (the existing path), keeps the text in the field and asks nothing. On a line's new
   thread: the thread is added with the text, then asked (its first turn, wrapped in First message).
4. Enabled when no turn runs in this thread, its conversation has loaded, no add of its own press still runs (a
   second press while the first add runs adds nothing twice and asks once), and there is typed text that is not
   blank or a note since the last answer. On a new thread: non-blank text and no add of it running. Both hover
   texts (enabled, disabled) say both conditions in plain words, in `rangeThreadText.ts`.
5. Unchanged: Ctrl/Cmd+Enter is Comment, Escape is Cancel; Comment's own behaviour; Edit/Delete.

## Acceptance

- Node: `rangeAi.test.ts` — typed text on a thread with an answer: one note stored, then one ask whose text is the
  notes since the last answer including the typed one; typed text on a first turn: wrapped; nothing typed: as
  before; a refused add: the problem reported, no ask, the text kept; a draft: the thread added, then asked; a second
  `ask` while the first add runs: one note, one ask; `canAsk` — false while running, false while the conversation
  loads even with text typed, false with blank text and no note since the answer, true with only typed text, false
  during its own add. `rangeThreads.test.ts` — `addNote`'s and `addThread`'s return values for stored, blank,
  refused, and (draft) running. Your tests kill the mutants on your lines (Stryker, SP5).
- WebKit, fixture page (`just app-session start-fixture --range-case review --threads seeded --ai`, MiniBrowser
  1600×1000), dark and light: the header shows place + collapse only; an open thread's bottom row shows Comment, Ask
  AI, Cancel with nothing typed; type a follow-up, press Ask AI → it shows as your note, the field is empty, the turn
  runs and Stop sits where Ask AI was; Stop interrupts; with nothing typed and a note since the answer Ask AI asks;
  hover texts enabled and disabled; Ctrl/Cmd+Enter still only adds; on a line's new thread Ask AI adds the thread
  and the turn starts; the aligned bands follow the box's height changes. Without `--ai` the same thread box matches
  its look before the change (screenshots before/after). Observed values and screenshots pasted.

Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test`, `pnpm -C frontend fmt:check`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
