I ran all ten steps. Nine passed as written. The tenth part, the mid-turn reload in step 9, showed a real defect in `ui/rangeAi.ts`. I fixed it, added two node tests, and re-ran it in the real app, where it now works. All seven `pnpm -C frontend` recipes pass.

**summary**
- `app-session start-fixture` now takes `--ai`, `--ai-case <case>` and `--ai-changes`, which add `&ai=<case>` and `&ai-changes` to the fixture URL. `start-app --ai` passes `--ai` to yamt; it did not exist before.
- **Defect fixed (`ui/rangeAi.ts` `load`):** reloading the page while a turn runs leaves a prompt that omp holds but the thread never recorded as an answer. From then on every new answer showed the turn before it. The next answer showed blank and the real one was hidden; screenshot `/tmp/aismoke/29-shifted.png`. Now, when a conversation loads, every turn omp holds beyond the thread's recorded answers is recorded as an answer before Ask AI turns on.
- Real app, after the fix: the thread already broken by the earlier run repaired itself (turn 4 was recorded and its answer showed). A new mid-turn reload was recorded as turn 5 with Ask AI off ("Nothing to ask yet…"). The next ask showed its own answer as turn 6.

**files_changed**
- `frontend/scripts/app-session/args.ts`, `args.test.ts`, `startArgs.ts`, `start.ts`
- `frontend/src/ui/rangeAi.ts`, `rangeAi.test.ts`

**tests_added**
- `args.test.ts` "start-app --ai reaches the app as its own --ai after the repository": the flag is parsed, `appArgs` adds `--ai` (range and compare window), and `--ai-case` is refused on `start-app`.
- `args.test.ts` "start-fixture --ai turns the range fixture's AI on…": the search string with and without a case and `--ai-changes`; `--ai-case`/`--ai-changes` without `--ai` are refused, and so is `--ai` without `--range-case`. The existing `appArgs` calls and the defaults now include `ai: false`.
- `rangeAi.test.ts` "turns omp holds without an answer in the thread (a reload mid-turn) become answers before Ask is offered": two extra replayed turns become answers 1 and 2, Ask stays off, and the next finished turn is answer 3 with its own text.
- `rangeAi.test.ts` "a failed write of an unseen turn's answer stops there and still shows the conversation": exactly one write is tried and the conversation still loads.

**smoke_evidence**

WebKit (MiniBrowser, `just app-session start-fixture --name aif --range-case review --threads seeded --ai [--ai-case crash]`):
1. **Stop:** clicked "Ask AI", then the button titled "Stop the AI's turn; what it wrote so far stays". The box ends with "Thinking and steps / You stopped the AI."; the Ask AI button is enabled and titled "Send your messages since the AI's last answer to the AI". Screenshot `/tmp/aismoke/10-stopped-line.png`.
2. **`?ai=crash`:** shows "The AI stopped unexpectedly (exit code 1): fixture agent: crashed mid-turn" with a [Retry] button (`/tmp/aismoke/11-crash.png`). After Retry, the partial answer stays and a full second answer ("I added `hello` … detached HEAD") follows (`/tmp/aismoke/12-retried.png`).
3. **Settings:**
   - With `ai`, the headings are `Theme | Antialiasing | Keymap | AI | Settings file`, and the AI section holds "Agent command … First message … Placeholders: {{ RELATIVE_FILE_PATH_WITH_LINE }}…" (`/tmp/aismoke/13-settings-ai.png`).
   - Without it (`?range=review&threads=seeded`), the headings are `Theme | Antialiasing | Keymap | Settings file` and there are no Ask AI buttons (`/tmp/aismoke/15-settings-no-ai.png`).
4. **Edit diff (`edit-and-command`):** "Edited README.md" opens a diff with "… 20 unchanged lines" and the added line `24 + hello` (`/tmp/aismoke/07-diff.png`).

Real app, real `omp acp` 18.12.6. Repo from `scripts/range-repo.sh /tmp/yamt-test-range-ai`, started with `just app-session start-app --name aiapp --range main...feature --repo … --ai --home /tmp/yamt-ai-home --settings '{"agent":{"command":["env","PI_CODING_AGENT_DIR=/home/wds/.omp/agent","omp","acp"]}}'`:

5. **First turn:** the box went to "Stop … Thinking and steps working…" (`/tmp/aismoke/22-live.png`), then live steps "Reading README tail Done", "Appending hello line Done", "$ git status" (`/tmp/aismoke/23-live-steps.png`). The answer: "I added Hello! as the last line of README.md…". `threads.json` holds `"session":"01a17a6e-63cb-74af-ad38-9fa3c831c08d"` and `{"kind":"aiAnswer",…,"turn":0}`.
6. **Stop a second turn:** "Stop" clicked about 6 s in. The box shows "You stopped the AI." and `threads.json` gains `aiAnswer turn 1` (omp held the prompt) (`/tmp/aismoke/25-stopped-real.png`).
7. **Keep:** the checkout showed ` M README.md` before closing.
   - The window close (WM_DELETE_WINDOW) asks "Keep the AI's changes? … README.md / Keep Changes / Discard Changes" with Keep focused (`/tmp/aismoke/26-keep-question.png`).
   - Escape removes the question and the window stays open. A second close asks again.
   - "Keep Changes" ends the app; the WebDriver session is cut off ("Session terminated without a reply"). The checkout is still there, with ` M README.md` and `+Hello!`.
8. **Reopen** with the same `--home`: the thread shows turn 0's answer ("I added Hello! … not that file.") and the turn-1 note with its answer (`/tmp/aismoke/27-reopened.png`).
9. **Reload mid-turn:** omp was running as pid `1711996 bun …/omp acp` and the button read "Stop". After `location.reload()`, `pgrep` finds no omp acp process and the checkout directory is still there. This was re-run after the fix: "no omp acp after reload".
10. **Discard:** after a close, "Discard Changes" ends the app. The range folder then holds only `lock` and `threads.json`; the checkout is gone.

Recipes (run once at the end):
- `typecheck`, `lint`, `fmt:check` ("All matched files use the correct format."), `sfc-order`, `unused` → exit 0 each.
- `test` → `Test Files 197 passed (197)`, `Tests 2653 passed (2653)`.

**deviations_from_brief**
- **`--ai-case <case>` instead of `--ai=<case>`:** `argv.ts`, which I don't own, has no `--opt=value` form. I also added `--ai-changes`. The fixture URL reads `&ai=` / `&ai=crash` (`has("ai")` treats it the same as `&ai`).
- **omp's credentials:** the app runs with a private HOME, so omp would not find its login. I pointed the agent command at the owner's `~/.omp/agent` through `env PI_CODING_AGENT_DIR=…` in `--settings`, so these test conversations are stored in the owner's omp session store. app-session itself is unchanged here.
- **Throwaway tool:** the window close used a WM_DELETE_WINDOW sender in `/tmp`, since deleted; xdotool cannot close on a bare Xvfb.
- **My decision on the fix:** a turn omp holds with no answer in the thread becomes an answer when the conversation loads. This follows plan row 121 ("once omp holds the prompt"). The comment sits at `rangeAi.ts` `load`.
- **Found outside my files, not fixed:**
  - `scripts/app-session/find.ts` names a button by its `title` before its text, so "Stop" is only found as "Stop the AI's turn; what it wrote so far stays". The accessible-name spec puts content first.
  - `ipc/fixtureAgent.ts` replays the single-turn `load.jsonl` for every load. In fixture mode, after a stop or crash check, an earlier answer shows "omp no longer has this answer" (seen in `/tmp/aismoke/10-stopped-line.png`). This comes from the fixture only.
  - Turns loaded from omp's replay show different step titles from the live view ("read: README.md:-5" instead of "Reading README tail"). This is the agent client or omp's replay, not the thread code.

**open_risks**
- `frontend/src/ui/rangeAi.ts` `load` (the loop at about lines 255–261): a note written while the conversation is still loading is placed before the answers recorded at load. That note then counts as already answered and is left out of the next prompt.
- Same loop: if recording a missing answer fails, later answers are still numbered one turn behind. The failure is reported, and the next load tries again.
- `rangeAiView.ts` `answerView`: a stopped answer loads as plain "finished" after a reopen; the stopped line is not stored (known risk, seen in step 8).
- I did not run `just mutants` (not part of this brief).