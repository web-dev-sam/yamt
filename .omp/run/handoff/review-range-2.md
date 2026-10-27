# Handoff — review a commit range (`yamt --diff=<range>`, threads → GitLab, AI behind `--ai`), session 30

Written 2026-10-27 on the owner's word (#1630: "stop, it ran 26m and only is at 17/791, that will effectively never
end I need to handover because the token context is overflowing again"). **No agent is running**; the final run was
cancelled and its `cargo mutants` process is gone. `.omp/run/slices.json` is `{}`. Branch `feat/review-range` off main
`bc69714`, tree clean, nothing pushed. Previous handoff: `review-range-1.md`.

## State: merged into `main` and prepared as pre-release 0.6.0-beta.1 (session 31, `main` at `69321c1`)

- Board "Review a commit range" rows 1–17 **accepted / done** (rows 15–17: edit and delete of unsent comments, plan
  §2 #123, owner #1636; final run `RVVerify4` pass). "Release 0.6.0-beta.1": `feat/review-range` merged as `a39907b`,
  release commit `ce2cf46`, final run `Release060Beta1Verify` pass, publishing handed to the owner
  (`docs/slices/handoff-release-0.6.0-beta.1.md`). Nothing pushed. Next findings id: **#1655**.
- A (range window), B (threads + GitLab), C (AI) are complete in code, reviewed by both lenses, every fix round
  re-checked and passing. Each committed patch has its own mutation record (`.omp/run/mutants/RV*.survivors.txt`),
  survivors triaged in `.omp/run/findings.jsonl`.
- Real-app evidence already observed by builders (not yet by the verifier): the range window (Xvfb), threads + Send
  with the fake glab (6 steps), and with real `omp acp` 18.12.6: an answer, Stop, Keep at close, reopen loads the
  conversation, reload mid-turn kills omp and keeps the checkout, Discard removes it (`.omp/run/notes/RVAiThreadsSmoke.md`,
  `RVAiThreadsR1.md`).
- Docs pass done: project map (`just map-check` ok), architecture §1/§2/§3.8, ipc-contract (IPC4, commands, IPC7),
  risk register RK28–RK39, CM15, plan #121–#122 + the amendment paragraph after the §2 table (#108 names, #110 clone
  rules, #117 lock order, #121 measured replay facts), README "Use", CHANGELOG `[Unreleased]`.
- Owner answers this session: #1629 "Fix it, and others like it" — third fix rounds allowed in this feature without
  asking (used for Markdown, thread boxes, agent client, turn view, AI shell, AI in threads).

## Next steps (re-hydrate per `skill://orchestrate` §0 first)

1. The owner publishes per `docs/slices/handoff-release-0.6.0-beta.1.md` (push `main`, CI green, tag, draft, tick
   "pre-release", his real-GitLab check). A red CI job or a failed download smoke comes back as a fix on `main`.
2. Next retro (before the next feature's first spawn): curator gets `findings.jsonl` since the last retro; #1630/#1631
   are already applied (the mutation-run limit). Candidate: #1638 (`readmer check` in `just check`: the feature's docs
   pass edited the generated README by hand and nothing caught it).

## Gotchas learned this session

- The fan-out hook needs the task name in `.omp/run/slices.json` **before** the spawn (write first, spawn in the next
  call); reviewers and the verifier (not isolated) need no entry.
- Rate limits: a 429 with `retry-after-ms` kills a subagent at once with nothing applied; wait the stated time (one
  `sleep` job), rename the registry key, respawn.
- Stryker's dry run fails on any node test that reads repository files by location (the sandbox moves the tree):
  parsing must stay pure; existence checks go behind an injected lookup.
- Stryker survivor filtering to changed lines: `/tmp/surv.ts <stryker-output> <from> <to>` (bun) — kept only in /tmp;
  rewrite if gone (match `[Survived|NoCoverage]` then the `src/…:line:col` line against `git diff -U0` hunks).
- `bindings.ts` must be regenerated (`just bindings`) and committed after any Rust IPC change; a regenerated union can
  break the window until the matching web round lands — fold those lines into that round's brief.
- Implementers keep asking for one-line grants outside Owned (commands.rs registration, test literals, index
  exports); grant in the registry and the brief in the same turn.
