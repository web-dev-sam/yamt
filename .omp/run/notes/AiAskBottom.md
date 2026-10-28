# AiAskBottom — Ask AI at the bottom of a thread, typed text added then asked (board "AI thread" row 2)

Brief `docs/slices/briefs/ai-thread-ask.md`; web-impl, isolated, 15 min. Fields read from `agent://AiAskBottom`.

## Summary

- Header: place + collapse only. With `--ai` every open thread and every line's new thread shows the bottom row
  Comment, Ask AI (Stop while this thread's turn runs), Cancel; Ask AI and Stop keep the field's focus. Without
  `--ai` unchanged.
- `RangeAi.ask(from: AskFrom, typed)`: non-blank typed text added first (note or new thread), asked once stored; a
  refused add asks nothing. `canAsk(from, typed)`: off while a turn runs, while the conversation loads, while this
  box's own add runs, or with nothing to send.
- `RangeThreads.addThread` → `ThreadId | null`, `addNote` → `boolean`; every caller migrated. Hover texts in
  `rangeThreadText.ts` say both conditions.

## Files

`RangeThreadBox.vue`, `rangeAi.ts`, `rangeAi.test.ts`, `rangeAiView.ts`, `rangeAiView.test.ts` (imports),
`rangeThreads.ts`, `rangeThreads.test.ts`, `rangeThreadText.ts`, `rangeStore.ts` (imports), `ui/AGENTS.md`.

## Tests (rangeAi.test.ts unless noted)

Typed text after an answer → one note, field empty, one ask "Who calls it?\n\nAnd where?"; first turn wrapped; blank
typed = as before; refused add → problem, text kept, no ask; new thread → added then asked; refused new thread → no
ask; second press during the add → one add, one ask, other threads unaffected; a new thread's add blocks only its own
Ask AI; `canAsk` off while running / loading even with text, typed text alone enough; a thread no longer listed →
nothing; Retry after an unrecorded crash asks nothing until a load records it. `rangeThreads.test.ts`: return values
(stored, refused, running, unknown key, blank).

## Evidence (the builder's)

- `pnpm -C frontend typecheck|lint|fmt:check|test` pass (198 files, 2722 tests); `unused`, `sfc-order` clean.
- Builder's Stryker on `rangeAi.ts`, `rangeAiView.ts`, `rangeThreads.ts`: 4 survivors on changed lines, claimed
  equivalent (`rangeAi.ts:194,199,216,224`); others on moved or unchanged lines.
- WebKit fixture `--range-case review --threads seeded --ai`, 1600×1000, shots `/tmp/aiask/`: header place +
  collapse (`03-open.png`); row Comment(off), Ask AI, Cancel; typed + Ask AI → note added, field "", focus kept, Stop
  in Ask AI's place, the band grew (`04-asked.png`); after the answer Ask AI off with the disabled text
  (`05-answered.png`); Stop 60 ms after Ask AI → "You stopped the AI." (`06-stopped.png`); Ctrl+Enter only adds
  (6 → 7 messages, no turn); nothing typed with a note since the answer → asks (`07-nothing-typed.png`); line 26's new
  thread: Ask AI off until typed, then thread count 4 → 5 and the turn starts (`08-draft.png`, `09-draft-asked.png`);
  light (`10-light.png`). Without `--ai`: no AI control, row only with text (`11-noai.png`, `12-noai-typed.png`).

## Deviations

- Accepted: the orchestrator's `ui/AGENTS.md` paragraph added.
- Accepted: pure parts moved from `rangeAi.ts` (353 lines > the 300-line lint cap) into the owned `rangeAiView.ts`:
  `ThreadAi`, `IDLE`, `isGone`, `isAnswerIn`, `answersIn`, `isKept`, `heldAfter(end)`, `promptText(thread, session,
  context)`, `AskContext`, the note separator. `ask`/`canAsk`/`AskFrom` stay in `rangeAi.ts`.
- For review: `rangeAi`'s `State.threads` widened from `Pick<RangeThreads, "list" | "setSession" | "addAiAnswer">` to
  the whole `RangeThreads` "to save lines".
- Accepted: doc comments say "plan row 124" (the palette test reads `#124` as a colour).
- Accepted: test rig source override, `gate`/`draftOf`/`threadAt` helpers.
- Project-map wording for `rangeAi.ts`/`rangeAiView.ts`: applied by the orchestrator.
- No "before" screenshot without `--ai` (needs the old tree); the final run compares.

## Open risks (the builder's)

- Fixture: a thread asked more than once shows later recorded answers as "omp no longer has this answer"
  (`10-light.png`); the builder believes `fixtureAgent` opens a new session per ask; not compared with the old code.
- Ctrl/Cmd+Enter during Ask AI's own add can add the same text again (Comment's behaviour today, unchanged).
- A line's new thread: Ask AI is on without checking the First message context; missing context → added, not asked.

## Reviews (round 1)

- Mutants `just mutants a484eb6`: 947 killed, 2 timeout, 36 survived, 15 no coverage
  (`.omp/run/mutants/AiAskBottom.survivors.txt`); the 4 on added lines judged equivalent by the correctness reviewer.
- `AiAskBottomCorrect`: pass. The fixture's "omp no longer has this answer" after a second ask is not new: the session
  and record paths are unchanged, and `fixtures/agent/load.jsonl` replays one turn, so turn 1+ shows as gone (the
  builder's guess of a new session per ask was wrong). One nit (#1663, `finally`) dropped.
- `AiAskBottomBoundary`: fail. Block #1659: `rangeAiView.ts` got a second job (the AI's pure rules beside the view).
  Promoted: #1660 (`State.threads` widened to all of `RangeThreads`), #1661 (two in-flight records of a draft's add
  that disagree while Comment's add runs), #1662 (`isReady`'s doc comment). → `AiAskBottomR1`
  (`briefs/ai-thread-ask-rework-1.md`); plan #124 amended: one record of adds in flight in `rangeThreads.ts`.
