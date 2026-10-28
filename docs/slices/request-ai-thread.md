# Request — the AI's thinking stays a fixed height; Ask AI sits at the bottom of the thread and sends what you typed

Settled with the owner on 2026-10-28 (session 32, planning after 0.6.0-beta.1); details by the orchestrator as owner
(OR13) where marked. A design may refine a detail it names, never reopen a rule. Facts:
`.omp/run/notes/PlanScoutAi.md` (path:line at main `15ab31c`).

## Owner's words

- "for AI mode: add a max height for the thinking block so that it doesnt keep growing when AI thinks."
- "The "ask AI" button is on top right. I want a discussion with the AI so when asking again, I need to scroll up to
  send to the AI which is bad. Also I dont want to send everything to the AI again and instead maintain a omp session
  if that isnt already the case. If it is ignore that ask."
- Answer (2026-10-28) to "What should Ask AI do with text you typed there and have not posted yet?": **"Send it in one
  step"** — Ask AI adds the typed text to the thread as your message and sends it at once; with nothing typed it sends
  your earlier unsent messages, as today.

## Already the case: one omp conversation per thread (no work)

Each thread keeps one ACP session (`Thread.session`, plan §2 #121); a follow-up sends only the notes written since the
AI's last answer (`rangeAi.ts:110-120`), omp holds the history; one `omp acp` process per window is reused between asks;
after a reload or restart the conversation is loaded again with `session/load`, never recreated (#115, #109). Only a
conversation omp deleted (`omp gc`) starts over with every note of the thread. The owner was told; nothing changes here.

## Rules

1. **Thinking height.** The "Thinking and steps" list of an AI turn (`AiTurn.vue:41`, the `<ol>` of thoughts, said
   lines and steps) is capped at 20rem (orchestrator: taller than a step's own output box, `AiStep.vue:28`
   `max-h-48`, so a step's box never fills it) and scrolls inside, with the panes' scroller look (`opaque-scroller`,
   plan §2 #60). The answer below it is never capped. Same cap for a running turn and a recorded one.
2. **Follow the newest text.** While a turn runs, the open list stays scrolled to its end as text arrives; once the
   reader scrolls up it stays where the reader put it; scrolling back to the end follows again. The rule is the server
   log's (`ServerLogView.vue:17,53-55,94-97`); one rule for both (a shared composable then has two users, vision 5),
   never a copy.
3. **Ask AI at the bottom.** Ask AI and Stop leave the thread's header. They sit in the thread's bottom action row with
   Comment and Cancel: Comment, Ask AI (Stop while this thread's turn runs), Cancel. With AI on, the row shows on every
   thread (today it shows only while text is typed or a new thread is written, `RangeThreadBox.vue:212`) so Ask AI is
   reachable without typing; without `--ai` the row is unchanged. The header keeps the place text and the collapse
   button.
4. **One step.** Ask AI with text typed: the text is added as your note (exactly what Comment does) and, once stored,
   the AI is asked; the field empties as after Comment. Nothing typed: sends your notes since the AI's last answer, as
   today. A failed add shows its problem and asks nothing. On a new thread (a line's first comment, not yet added):
   Ask AI adds the thread with the text, then asks (orchestrator: the same one step, so a discussion can start from a
   line).
5. **When Ask AI is enabled**: no turn runs in this thread, its conversation has loaded (today's wait,
   `rangeAi.ts:127`), and there is something to send — typed text that is not blank, or notes since the last answer.
   Its hover texts say both (words in `rangeThreadText.ts`).
6. **Unchanged**: Ctrl/Cmd+Enter is Comment and Escape is Cancel in the field (`rangeKeys.ts:11-14`); Edit and Delete
   rules (#123); what one turn sends; the First message template; the close question; `--ai` off shows no AI control.

## Acceptance

Real app with `--ai` and a real `omp acp` on `scripts/range-repo.sh`: a turn with long thinking keeps the open list at
20rem and follows its end; scrolling up holds the place while text keeps arriving; the recorded turn shows the same
cap. In a thread of several turns, typing a follow-up at the bottom and pressing Ask AI posts it as your note and the AI
answers it without scrolling; Ask AI on a line's new thread starts the discussion; Stop at the bottom interrupts.
Without `--ai` the thread box looks as before. WebKit fixture (`?range&ai`) tests the rules; `just check` passes; dark
and light.

## Non-goals

A key for Ask AI; moving the "Thinking and steps" section or keeping it open across the live → recorded switch;
changing what a turn sends or how conversations are kept; the compare and merge windows.

## Slice graph (proposal; the session's orchestrator refines it)

| row | slice                                                          | owner    | owns (coarse)                                                                   | needs |
| --- | -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- | ----- |
| 1   | thinking cap and follow (rules 1–2)                            | web-impl | `ui/AiTurn.vue`, the follow rule shared with `ui/ServerLogView.vue`             | —     |
| 2   | Ask AI at the bottom, one step (rules 3–5)                     | web-impl | `ui/RangeThreadBox.vue`, `ui/rangeAi*.ts`, `ui/rangeThreadText.ts`, their tests | —     |
| 3   | final run: `just check`, WebKit, real app with a real omp turn | verifier | —                                                                               | 1, 2  |

Rows 1 and 2 are disjoint and run side by side. Risk: the thread box sits in a CodeMirror block row whose height is
measured (`threadWidget.ts:13,38-41`, `threadHosts.ts:30`); a capped list changes the row's height less, but the
aligned bands must still follow every height change (the row 14a test pattern: wait for CodeMirror's first measure).
