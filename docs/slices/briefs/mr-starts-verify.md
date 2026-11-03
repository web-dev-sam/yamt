# Slice mr-starts-verify — the gate, the WebKit fixture and the real app for the starts feature

Request acceptance: `docs/slices/request-mr-starts.md` "Acceptance". Briefs: `briefs/mr-starts-rust.md`,
`briefs/mr-starts-age.md`, `briefs/mr-starts-open.md`. Recipes: `skill://verification`. Windows open only on a private
display; screenshots come only from the session or that display (VF8, VF9).

## Target

**Owned:** none (read-only commands; your scratch folder only). **Read-only:** the whole tree.

**Needs:** `MrStartsRust`, `MrStartsAge`, `MrStartsOpen` committed; the docs keeper's map update (`just map-check`).

**Non-goals:** fixing anything (VF1); `just mutants`.

## Contract

- Start marker `document.documentElement.dataset.open === "mergeRequests"` (app), `?open=mergeRequests` (fixture);
  session tool: `start-app --mr`, `start-fixture --open-mr`.
- Age words: core `agoText` ("just now", "1 minute ago"); hover `HH:MM` today, else `DD.MM.YYYY, HH:MM`.
- `YAMT_AI`: unset, empty, `0` off; anything else on. The app inherits the caller's environment through the session
  tool.

## Change (the steps)

**A. Gate.** `just check` → pass, or the failing recipe and its first 30 lines.

**B. The list's age (WebKit fixture).** `just app-session start-fixture --name age --diff --mr list --size 1600x1000`.

1. Open Merge requests. After the rows: muted "just now" directly left of Refresh; hover → today's `HH:MM`.
2. Wait 61 s → "1 minute ago" without any click.
3. Restart with `--mr slow`: open, wait for the list, click Refresh; within the first second the age still reads the
   earlier value and the spinner runs; after the load "just now".
4. `shot` of the header in yamt Dark and yamt Light. Same steps 1 in the range window (`--range-case review --mr list`).

**C. Opening at start (WebKit fixture).**

1. `start-fixture --name open --diff --mr list --open-mr`: the merge-request page with rows, no click.
2. Without `--open-mr`: the compare tabs. `--range-case review --mr list --open-mr`: the page in the range window.
3. `--diff --open-mr` without `--mr`: refused by the tool.

**D. Real app.** `cargo tauri build --debug --no-bundle`; `scripts/mr-conflict-repo.sh <scratch>/mr`.

1. `target/debug/yamt --help`: the `--mr` lines and `YAMT_AI` beside `--ai` (paste). `target/debug/yamt --repo
   <scratch>/mr --mr`: the `--diff … takes no --repo` refusal, exit code non-zero.
2. `just app-session start-app --name mr --diff --dir <scratch>/mr --glab mr-conflicts --mr`: the page with rows at
   once (`shot`); `dataset.open` reads `"mergeRequests"`. Without `--mr`: the compare tabs, `dataset.open` undefined.
3. `scripts/range-repo.sh <scratch>/plain`, then `YAMT_AI=1 just app-session start-app --name ai --diff --dir
   <scratch>/plain --glab merge-requests --mr` (`mr-conflicts` has no diff refs, #2240): click "Show Diff" on row 0;
   `pgrep -af 'yamt --diff='` shows the child ending with `--ai`; a screenshot of the private display shows the child's
   window with "Ask AI" on a thread (open or start one if needed). Repeat with `YAMT_AI=0`: the child has no `--ai`.
4. A folder without a GitLab remote (`scripts/range-repo.sh <scratch>/plain` or any repo with no remote) and
   `start-app --diff --dir <scratch>/plain --mr`: the compare tabs, no page, no problem bar.
5. Stop every session; leave no yamt from this run.

## Acceptance

Each step: pass or fail with the observed words, `dataset` values, process lines and the screenshots' paths. Report
the environment (VF5).
