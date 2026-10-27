# Handoff — review a commit range (`yamt --diff=<range>`, threads → GitLab, AI behind `--ai`), session 30

Written 2026-10-27 on the owner's word (#1630: "stop, it ran 26m and only is at 17/791, that will effectively never
end I need to handover because the token context is overflowing again"). **No agent is running**; the final run was
cancelled and its `cargo mutants` process is gone. `.omp/run/slices.json` is `{}`. Branch `feat/review-range` off main
`bc69714`, tree clean, nothing pushed. Next findings id: **#1632**. Previous handoff: `review-range-1.md`.

## State: every build is accepted; only the final run is left

- Board "Review a commit range" (`docs/slices/SLICES.md`) rows 1–13 **accepted**, row 14 (final run) stopped.
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

1. **Final run** (#1630): spawn `verifier` alone with `docs/slices/briefs/3.RV-verify.md` as it is now — recipe 2 is
   already "no mutation run", and since #1631 no agent can start one over the feature (the `mutants` recipe refuses
   more than one patch's worth; `cargo mutants` outside it is hook-blocked; VF7, verifier.md). The per-slice mutation
   records are the evidence. Recipes 1 (`just check` — never run integrated yet), 3 (browser tests; Playwright WebKit
   cannot launch here, `libicudata.so.74`), 4 (WebKit fixture steps), 5 (real app incl. one real `omp acp` turn,
   Keep/Discard, reload mid-turn, the `GIT_DIR` step).
2. `gate: fail` → a fix round for the owning slice (§5), never a new slice.
3. Report to the owner in plain language: what works; the one open product question — **should he be able to delete
   or edit his own comments before they are sent?** (#120 default: neither); the defaults he may veto (#103, #115,
   #120, #122); his real-GitLab check (comments landing on the right lines, the pending review he then publishes —
   glab is not installed here); the release-notes block in his compact form (OR-h6) if he wants a release.
4. Gate D candidate for the next retro: #1630 (the final run mutates only lines changed since the last per-slice run,
   or not at all when every patch has its record).

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
