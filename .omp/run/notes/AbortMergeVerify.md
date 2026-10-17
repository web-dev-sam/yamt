# AbortMergeVerify — final run, board "Abort merge" row 3

Brief `docs/slices/briefs/3.A-abort-verify.md`, at HEAD `1f446a4`. Gate **pass**: `just check` exit 0 (1357 web tests in 101
files, 10 goldens, hooks 16/16, arch/map ok). Env: rustc 1.99.0, node 24.22.0, pnpm 12.0.0, cargo-mutants 27.1.0.

## Mutants (`just mutants 407ec81`)
Rust 16 caught, 0 missed, 25 unviable. Stryker 754 killed, 81 survived, 16 no coverage, almost all on older lines.
On changed lines: problem.ts:80-82 equivalent (verifier); question.ts ABORT_TEXT words, question.ts:109 NoCoverage,
problem.ts:48 → verifier "real gaps"; orchestrator triage #1090: equivalent / gate-covered / words, dropped.

## Real app (Xvfb :77, kwin_x11 with a throwaway HOME, xdotool; screenshots /tmp/a-yamt-abort-verify/)
a. Mark resolved crlf.txt, Ctrl+S an edit in vOn.ts, unsaved edit in App.vue; question words = plan #74; Escape and Cancel:
   status and ls-files -s identical; Abort Merge: window gone < 3 s, no unsaved question, EXITSTATUS 1, stderr
   `yamt: merge aborted`, status `?? scratch.txt` only, no MERGE_HEAD, HEAD 972ffc02 unchanged, `git diff --stat HEAD` empty.
b. lsp-repo: oxfmt + oxlint running (pids listed) → abort → exit 1, no server process left.
c(1). Mark resolved, reopen, edit, Ctrl+S → `MM notes/crlf.txt`; abort → "Could not abort the merge: … Entry
   'notes/crlf.txt' not uptodate. Cannot merge. …"; app stays; nothing changed; close → exit 1 "6 of 7 files still unresolved".
c(2). staged then changed before start → same bar; close → exit 1 "6 of 6".
d. cherry-pick, rebase, merge --squash, rebase -r (MERGE_HEAD + REBASE_HEAD): no button; each close exit 1.
e. terminal commit → focus → button gone, "All files are resolved", close exit 0.
f. Ctrl+B hides list and button; again shows both.
g. header + question screenshots dark and light.
Cleanup: all its apps, kwin, Xvfb stopped; a `target/debug/yamt --repo /tmp/yamt-conflict-project` (pid 2093060) not its own.
