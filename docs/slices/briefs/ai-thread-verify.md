# Final run — the AI's thinking list capped and following; Ask AI at the bottom of a thread

Board "AI thread" row 3 (session 33). Rows 1 (`AiThinkingFollow`: the "Thinking and steps" list at most 20rem, scrolling
inside, following its end; one follow rule with the server log, `ui/useFollowEnd.ts`; an edit diff box 16rem) and 2
(`AiAskBottom`: Ask AI/Stop in the bottom row Comment, Ask AI, Cancel, on every thread with `--ai`; typed text added
as your note then asked; a line's new thread added then asked) are committed. Rules: `docs/slices/request-ai-thread.md`
and `docs/plan.md` §2 **#124** (read both whole). Read-only (VF6); you fix nothing (VF1); alone. **No mutation run**
(VF7, owner #1630): each patch had its own. Real-app sessions `v-ait-…`; scratch under `/tmp/yamt-ait/verify/`. The
owner's own yamt may be running: leave it alone; never `pkill`/`killall`.

## Recipes

1. `just check` from the main checkout at HEAD. Any failure is `gate: fail` with its first 30 relevant lines.
2. WebKit, fixture page (`just app-session start-fixture --range-case review --threads seeded --ai`, MiniBrowser,
   1600×1000), dark **and** light:
   a. A thread's header shows the place text and the collapse button only; the bottom row shows Comment, Ask AI,
   Cancel on every open thread with nothing typed, and on a line's new thread.
   b. Type a follow-up in a thread with an AI answer, press Ask AI → it shows as your note, the field is empty, the
   turn runs, Stop sits in Ask AI's place; Stop interrupts ("You stopped the AI.").
   c. Nothing typed and a note since the answer → Ask AI asks; nothing typed and no note → Ask AI is off; both hover
   texts read as plain sentences. Ctrl/Cmd+Enter in the field only adds the note; Escape cancels.
   d. On a line's new thread: type, Ask AI → the thread is added with the text and its first turn starts.
   e. Open "Thinking and steps" while a turn runs: computed `max-height` 320px; once full it stays scrolled to its end
   as entries arrive (`scrollTop + clientHeight` within 1 px of `scrollHeight`); scroll up mid-turn → the place
   holds; back to the end → it follows. The recorded answer's list: same cap, opens at its end; its answer text is not
   capped; an opened edit diff inside is at most 256px.
   f. The thread's aligned bands still line up after the box changes height (row shown, list opened).
3. The same fixture page without `--ai`: the thread box looks as before the change (no AI control; the Comment/Cancel
   row only on a new thread or with text typed). Compare with a screenshot from the commit before row 1
   (`c72b022`) if you can build it read-only in a scratch worktree; else describe what you observed.
4. Server log, merge window (the fixture page with servers, or the real app): opens at its end, follows new lines,
   holds a scrolled-up place.
5. Real app on a private X display (`cargo tauri build --debug --no-bundle`; repository from `scripts/range-repo.sh
   /tmp/yamt-ait/verify/repo`), `--ai` with real `omp acp` (installed). The app runs with a private HOME, so omp needs
   its login pointed at the owner's store, as earlier runs did: `just app-session start-app --name v-ait --range
   main...feature --repo … --ai --home /tmp/yamt-ait/verify/ai-home --settings
   '{"agent":{"command":["env","PI_CODING_AGENT_DIR=/home/wds/.omp/agent","omp","acp"]}}'`:
   a. Start a thread on a line with a question that makes the AI think at length, press Ask AI on the new thread →
   the turn starts; open "Thinking and steps": capped at 320px, following its end; scroll up → holds while text keeps
   arriving; the recorded turn shows the same cap.
   b. In that thread, after an answer, type a follow-up at the bottom and press Ask AI → it is posted as your note and
   the AI answers it (the request omp got is only the new note: `threads.json` holds the same `session`, a second
   `aiAnswer` turn 1); no scrolling up needed (screenshot).
   c. Ask again and press Stop in the bottom row → the turn stops.
   d. Close (WM_DELETE_WINDOW) → answer the close question if asked; exit status recorded; no `omp acp` left.

## Report

`gate: pass|fail`, the `just check` result line, one observed value or screenshot path per step.
