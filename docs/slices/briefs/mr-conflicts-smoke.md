# Smoke pass MrConflictsSmoke — size, readiness, resolve in your own checkout, abort, push

Board "Merge-request conflicts" row 8. Request `docs/slices/request-mr-conflicts.md`; design
`docs/slices/briefs/mr-conflicts-design.md` §4.7 ("WebKit fixture steps", "Real app"). Tree at `1bd8483`. Recipes
only (VF11 smoke); no `just check`, no mutation run. It also settles the app build's NOT RUN: the
merge window closes after an Abort with nothing left over and after a Push, and stays after Keep Local's question.

## Steps

1. **Fixture page, WebKit** — design §4.7 "WebKit fixture steps", page part, every check; `shot` after each click.
2. **Fixture merge window, WebKit** — the same paragraph's merge-window part, every check; plus
   `…&mergeRequest=created&clean&push=rejected` → Commit merge → the push question: both operation buttons disabled
   behind it (#2026).
3. **Real app** — `cargo tauri build --debug --no-bundle`, then design §4.7 "Real app" steps 1–7 in order, each on
   the repository the step names (`scripts/mr-conflict-repo.sh /var/tmp/yamt-mrc`, a fresh one where the step says
   so), with the `git` outputs it names pasted verbatim and a `shot` per step. In step 4 and step 5 also record
   whether the merge window process is gone afterwards (`pgrep -f 'yamt --repo /var/tmp/yamt-mrc'`).
   Remove `/var/tmp/yamt-mrc*` at the end.

## Report

`smoke` per `skill://verification`: each step, observed lines verbatim, pass/fail; a failure names the step, what was
expected and what was seen.
