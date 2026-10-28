# AiThreadVerify — final run, board "AI thread" row 3 (session 33)

Brief `docs/slices/briefs/ai-thread-verify.md`; verifier at HEAD `19be32c`, 20 min, alone, no mutation run.
Fields read from `agent://AiThreadVerify`. Scratch and shots under `/tmp/yamt-ait/verify/`.

## Gate: pass

`just check` once at the root, clean tree, exit 0 (48 s): golden 10× ok, `check-sfc-order`, `hooks.test.ts` 17/17.
`git status --porcelain` empty after the run; no yamt, `omp acp` or driver process left.

## Steps (all pass)

- 2a header place + collapse only; four open threads show Comment(off), Ask AI, Cancel with nothing typed; a new
  thread shows Comment(off), Ask AI(off), Cancel (`2a-*.png`).
- 2b typed + Ask AI → note at once, field "", Stop in Ask AI's place; Stop → "You stopped the AI." (dark, light).
- 2c hover texts read from the `title`; Ctrl+Enter only adds; nothing typed + a note since the answer → asks;
  Escape clears and adds nothing.
- 2d a line's new thread (12 dark, 4 light): added with the text, first turn ran.
- 2e live list 320px, gap 0 while following; scrolled to 40 → held (gap 400 → 448); back at the end → follows;
  recorded list 320px opening at its end; answer uncapped; edit diff 256px max.
- 2f bands level before/after the list opened (`[608,608]` → `[932,932]`).
- 3 without `--ai`: no AI control; vs `c72b022` built from `git archive`: `compare -metric AE` → 0 differing pixels.
- 4 server log: opens at its end (208/908/1116), follows, holds at 200 through 10 starts, follows again.
- 5a real app, real `omp acp`: live list 320px, at its end; scrolled up held through growth to 1812; back at the end
  followed through 5752; recorded turn 1 320px at its end.
- 5b follow-up typed at the bottom → note, field empty, answered, no scrolling up; `threads.json`: one session,
  `aiAnswer` turns 0 and 1; omp's session file: the second prompt is exactly the new note.
- 5c Stop by a real click → stopped. 5d close → no question (checkout unchanged), exit 0, no `omp acp` left; reopened
  thread shows both turns.

## Notes from the run

- Fixture turns (~2 s) were driven by in-page scripts; hover texts read, not shown; recipe 4 added log lines through
  the page's own server start; 5a's live numbers come from the second turn (the first sampler hit WebDriver's 30 s
  limit); 5d's first close was the verifier's own sender bug.
- Unexplained once: typing into a thread's Reply field at the screen's bottom edge (y≈940, dark) left no text and Ask
  AI added nothing; never again with the field mid-screen. Not reproduced; logged #1664.
