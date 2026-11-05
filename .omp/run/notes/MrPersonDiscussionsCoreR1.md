# MrPersonDiscussionsCoreR1

Agent output (`agent://MrPersonDiscussionsCoreR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsCoreR1.md), collected 2026-11-05T14:00:14.409Z.

{
  "summary": "Fixed both findings. #2503: `eachUsernameOnce` is no longer private to mentions.ts. It now lives in people.ts as an internal export. `knownMentions` and `personLines` both call it, so personLines no longer depends on `knownMentions`. #2505: `foldedWriters` now floors `fits` once at the top (`slots = Math.max(Math.floor(fits), 1)`), so the fold rule handles fractional widths itself. AGENTS.md is updated. The mention list behaves as before and its tests pass.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/people.ts",
    "frontend/src/mergeRequests/internal/people.test.ts",
    "frontend/src/mergeRequests/internal/mentions.ts",
    "frontend/src/mergeRequests/internal/personDiscussions.ts",
    "frontend/src/mergeRequests/internal/personDiscussions.test.ts",
    "frontend/src/mergeRequests/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "people.test.ts: each username once keeps the first, in order",
      "proves": "eachUsernameOnce keeps the first person for each username (by identity) and keeps the input order"
    },
    {
      "name": "personDiscussions.test.ts: the_fold_keeps_the_newest_writers (+ fits 3.5 and 1.5 assertions)",
      "proves": "A fractional fits is floored: 6 writers with fits 3.5 show 2 and fold 4; 2 writers with fits 1.5 fold both. This kills the no-floor and ceil mutants."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend fmt; pnpm -C frontend lint; pnpm -C frontend unused",
      "observed": "oxfmt: Finished on 843 files. oxlint --type-aware && eslint --max-warnings 0: no diagnostics. knip --include exports,types: no findings."
    },
    {
      "command": "pnpm -C frontend exec vitest run src/mergeRequests",
      "observed": "Test Files 24 passed (24); Tests 480 passed (480)"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Tests 1 failed | 4596 passed (4597). The failure was fences.test.ts 'the real source tree has no fence violations' at 5021ms (over the 5000ms default timeout, under load). The mention tests (mergeRequestMentions, mergeRequestMentionLines, mentions) all passed."
    },
    {
      "command": "pnpm -C frontend exec vitest run scripts/fences.test.ts",
      "observed": "Tests 52 passed (52)"
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "Fails only in ipc files I don't own (discussionDomain.test.ts:44, fixtureMergeRequestDiscussions.ts:155, tauriMergeRequests.test.ts:515,527): the 'first' property is missing on OpenDiscussion. These errors were already in the tree from the parallel ipc slice. No error in an owned file."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → mentions.ts 95 killed/2 survived, people.ts 52/11, personDiscussions.ts 106/6; total 253 killed, 19 survived, score 93.01",
    "survivors": []
  },
  "acceptance_not_run": [
    "Full `pnpm -C frontend typecheck` is not green. Errors in ipc/ files outside Owned (OpenDiscussion.first, sibling MrPersonDiscussionsIpc's work in progress) block it; the owned files have no type errors."
  ],
  "deviations_from_brief": [
    "None of the 19 surviving mutants is on a changed line. They are all on unchanged lines: mentions.ts:17,44; people.ts:4,10-21 (review-state tables, NO_PEOPLE_TEXT); personDiscussions.ts:16-21 (PERSON_GROUPS literals). I left them as they were.",
    "AGENTS.md: the personLines note now cites `people`'s `eachUsernameOnce` instead of `knownMentions`, and the `people` paragraph names the internal helper.",
    "No WebKit/browser run: this change touches only pure core functions with no DOM behaviour."
  ],
  "open_risks": [
    {
      "location": "frontend/scripts/fences.test.ts",
      "risk": "'the real source tree has no fence violations' runs close to the 5s vitest timeout and failed once in the full suite under load (5021ms). It passed when run alone."
    }
  ]
}
