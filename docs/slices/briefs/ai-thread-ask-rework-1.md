# Slice AiAskBottomR1 — fix round 1: the AI's rules in their own file, one record of adds in flight

Board "AI thread" row 2, fix round 1 of `docs/slices/briefs/ai-thread-ask.md` (read it whole; its Behaviour and
Acceptance still hold). Round 1 is commit `05c8fa5` (notes `.omp/run/notes/AiAskBottom.md`); the review raised the
findings below (`.omp/run/findings.jsonl` #1659–#1662), each to be fixed. Nothing else changes: no behaviour of round 1
is reopened beyond what a finding names.

## Findings to fix (verbatim, with the orchestrator's decision)

1. **#1659 (block, growth: second job)** `frontend/src/ui/rangeAiView.ts:27` — "rangeAiView.ts now does two unrelated
   jobs. One is the view of an answer, which the components read (`answerView`, `answering`, `liveTurn`,
   `answerText`, `postBody`). The other is rangeAi's pure decision rules, which only `rangeAi.ts` (and
   `rangeStore.ts` for `AskContext`) import: `heldAfter` with the HELD tables (#121), `isKept`, `isGone`,
   `answersIn`, `promptText`/`AskContext`/`NOTE_JOIN` (the prompt rule). No view function calls any of these rules."
   Fix: `ThreadAi` and `IDLE` stay in `rangeAiView.ts` (the shared shape the view reads); `heldAfter` (+ both HELD
   tables, `Held`), `isGone`, `isAnswerIn`, `answersIn`, `isKept`, `promptText`, `AskContext` and `NOTE_JOIN` move
   into a new pure module `frontend/src/ui/rangeAiRules.ts`, imported by `rangeAi.ts` and `rangeStore.ts`. A view
   function that needs one of them imports it from there (never a copy).
2. **#1660 (promoted)** `frontend/src/ui/rangeAi.ts:39` — "`State.threads` was widened to the whole `RangeThreads`
   … It actually uses only `list`, `setSession`, `addAiAnswer`, `addThread` and `addNote` … the file is 282 lines
   against `max-lines` 300." Fix: `Pick<RangeThreads, …>` of exactly the members `rangeAi.ts` uses (the five above
   plus the in-flight query of item 3), a named alias if it formats more compactly.
3. **#1661 (promoted, one fact with two sources)** `frontend/src/ui/rangeAi.ts:42` — "Two places now track whether
   draft K is being added. `rangeAi`'s `adding` … is reactive; it gates the button. `rangeThreads`' own `adding`
   (rangeThreads.ts:71,164) holds the same key, is not reactive, and silently refuses … They disagree when Comment's
   add of a draft is running: Ask AI shows as enabled, then pressing it does nothing." Fix: `rangeThreads.ts` owns
   the one reactive record of adds in flight (a `shallowRef` of a readonly set, replaced, never mutated): a line's
   new thread by its draft key and a note by its thread. `addThread` keeps refusing a second add of the same draft
   (as today); `addNote` records its add but refuses nothing (Comment's behaviour is unchanged). `rangeAi.ts` keeps no
   in-flight record of its own: `canAsk` reads the threads' one, so Ask AI is off while any add of that box runs —
   its own press's or Comment's. (Plan #124's "no add of its own press still runs" becomes "no add in that box still
   runs"; the orchestrator updates the plan row.)
4. **#1662 (promoted)** `frontend/src/ui/rangeAi.ts:71` — "The doc comment on `isReady` says 'No turn runs and the
   conversation has loaded'. The function also requires the First message context." Fix: the comment names it.

## Target

Owned: `frontend/src/ui/{rangeAi,rangeAi.test,rangeAiView,rangeAiView.test,rangeAiRules,rangeAiRules.test,
rangeThreads,rangeThreads.test,rangeStore,rangeStore.test}.ts`, `frontend/src/ui/RangeThreadBox.vue`,
`frontend/src/ui/AGENTS.md`.

Read-only: everything else. The project map and `docs/architecture.md` are the orchestrator's: give their new wording
in `deviations_from_brief`.

## Contract (fixed; you may add, never change)

Round 1's contract stands (`AskFrom`, `RangeAi.ask(from, typed)`, `canAsk(from, typed)`, `addThread → ThreadId |
null`, `addNote → boolean`). Added:

```ts
// ui/rangeThreads.ts — RangeThreads (both read the one reactive record, so a computed over them recomputes)
/** Whether the add of this line's new thread (its draft key) still runs. */
addingThread(draftKey: string): boolean;
/** Whether an add of a note to this thread still runs. */
addingNote(thread: ThreadId): boolean;
```

## Acceptance

- Node: tests move with the code they prove (a rule's tests beside its module; none lost). New: Ask AI is off while
  Comment's add of that box runs — a draft's (`addThread` held) and a thread's note (`addNote` held) — and on again
  once it lands or is refused; `addingThread`/`addingNote` true during the add and false after, on success and on
  refusal; a second Comment while a note's add runs still sends (unchanged). Your tests kill the mutants on your
  changed lines (Stryker, SP5).
- `rangeAiView.ts` exports only the view and the shared shape (`ThreadAi`, `IDLE`, the answer's view, `answering`,
  `liveTurn`, `answerText`, `postBody` and their types); `rangeAi.ts` imports its rules from `rangeAiRules.ts`.
- WebKit, fixture page (`just app-session start-fixture --range-case review --threads seeded --ai`, MiniBrowser
  1600×1000), dark: typed follow-up + Ask AI → note, empty field, turn, Stop; a line's new thread + Ask AI → added
  and asked; nothing typed with a note since the answer → asks. Observed values pasted.

Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test`, `pnpm -C frontend fmt:check`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
