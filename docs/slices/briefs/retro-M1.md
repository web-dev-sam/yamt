# Rules review at the end of M1 (curator, Propose mode)

First spawn `M1RulesReview` (2026-10-10 17:39) was interrupted by the owner before it reported; it
changed nothing. Re-spawn under a new name (e.g. `M1RulesReviewB`) with this brief.

Context: yamt's rules review at the end of M1, before the first desktop-app (Tauri) task of the v0
release. The owner approves each change in plain language; this run only proposes.
Inputs: `.omp/run/findings.jsonl` lines 111–283 (finding id = line number; `source: "human"`
weighs most). Board row D in `docs/slices/SLICES.md` lists the drift already spotted. Decision
record: `docs/plan.md` §2 rows 1–40 (latest #31–#40). Last review's outcome: `.omp/GUARDRAILS.md`
changelog (2026-10-09). Output schema: the curator agent definition's.

## Task

Run the retro procedure of `skill://guardrail-evolution` in Propose mode over findings #111–#283.
Cover each item below as its own proposal or an explicit "no change" with a reason:

- **VF8 — already approved by the owner (2026-10-10, findings #281–#282, plan §2 #40):** test
  windows open on the owner's Samsung screen, never the ASUS one. `just webdriver` runs on the
  real display after `scripts/test-screen.sh place`, which keeps two KWin rules forcing a position
  inside the Samsung screen: one matches the window class (`minibrowser|yamt-test`), one the title
  (`yamt-test`). Without a Samsung screen it falls back to a private display.
  `just test-window-check` fails if a test window is anywhere else. Rewrite VF8 and the
  fixture-mode recipe in `skill://verification` to match:
  - run `just test-window-check` right after opening a session and paste its output;
  - never start `WebKitWebDriver`, `MiniBrowser` or `epiphany` directly.

  Add to the Tauri smoke recipe that the app's test build carries `yamt-test` in its window class
  or title and uses the same check. Mark it `pre-approved` in `diff_summary`.

- **Rule texts that now contradict the code or decisions:**
  - CM2/CM8 (`dismissed` → per-side `ignored`, plan §2 #33);
  - CM6 and the other apply rules vs. the multi-dispatch apply (#218);
  - TS2 status example (#259);
  - TS15 parse-once cache exception (#274);
  - TS11 wording and the test-file cap (#223);
  - CM1/CM3/CM10/CM12 as listed on row D;
  - the cm6-rules dependency list (`@codemirror/language-data`, `indentWithTab`).
- **`skill://project-map`:** add the new files `editor/internal/{language,words,indent}.ts`,
  `merge-core/{token,line_pairs}.rs`, the showcase fixtures, `src/icons.d.ts` and
  `scripts/test-screen.sh`; bump the verified commit in Apply mode.
- **ipc-contract IPC7** (showcase fixtures, #228).
- **Risk register:** a row for #225 (redo position after repeated undo/redo of an insert-only
  apply).
- **Process lessons:**
  - the worktree race when two isolated agents are spawned in one call;
  - a registry change after spawn never reaches an isolated agent (#267);
  - the verifier could not write screenshots with an empty registry (#253);
  - #255: check WebStorm's source before designing an interaction it already has;
  - the window-placement incident #282: verify placement without risking a visible window on the
    wrong screen;
  - test runs leave a private display behind: an orphaned `Xvfb :99` from the 17:03 test run was
    still alive at 17:45. Add a cleanup step to the smoke recipe.
- **Comment audit** over the code changed since the last review's verified commit (see
  `skill://project-map`).

For every proposal give: the rule text, level, detector, cost, origin findings. Keep each proposal
small enough that the owner can approve or reject it on its own.
