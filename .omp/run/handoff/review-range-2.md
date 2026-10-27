# Handoff — review a commit range (`yamt --diff=<range>`, threads → GitLab, AI behind `--ai`), session 30

Written 2026-10-27 on the owner's word (#1630: "stop, it ran 26m and only is at 17/791, that will effectively never
end I need to handover because the token context is overflowing again"). **No agent is running**; the final run was
cancelled and its `cargo mutants` process is gone. `.omp/run/slices.json` is `{}`. Branch `feat/review-range` off main
`bc69714`, tree clean, nothing pushed. Previous handoff: `review-range-1.md`.

## State: the feature is done; the final run passes (session 31, HEAD after `40698ea`)

- Board "Review a commit range" (`docs/slices/SLICES.md`) rows 1–14a **accepted / done**. Final run `RVVerify2`
  (`174b2dc`) + `RVVerify3` (`40698ea`): `just check` pass, fixture page and real app (real `omp acp`) pass, both range
  browser files 13/13 twice after thread-rows round 3 (`a93c774`, test-only: the two tests scrolled before CodeMirror's
  first measure). Next findings id: **#1636**.
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

1. The owner has been reported to (session 31): what works, the open question — **delete or edit his own comments
   before they are sent?** (#120 default: neither), the defaults he may veto (#103, #115, #120, #122), his real-GitLab
   check. His answer to the question becomes a slice in this section (a product change, not a fix round).
2. Release notes in his compact form (OR-h6) only if he asks for a release.
3. Next retro (before the next feature's first spawn): curator gets `findings.jsonl` since the last retro; #1630/#1631
   are already applied (the mutation-run limit).

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
