# MrPersonDiscussionsStateR1

Agent output (`agent://MrPersonDiscussionsStateR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsStateR1.md), collected 2026-11-05T14:47:20.603Z.

{
  "summary": "All five findings are fixed. #2510 and #2514: under 'lazy' or 'off', Back now drops the running call's unanswered iids (they go to `unhovered`) and every `loading` entry a pending ask holds, so GitLab is asked nothing after Back. Reloading read rows are still sent, as the Contract says. #2512: every writer of the Queue's fields, and its constructor `createQueue`, now lives in `mergeRequestDiscussionQueue.ts`. #2511: the forward-referenced closure is gone; `state.viewReplaced` is set once by `personViewOf`. #2513: `findProject` is back in `mergeRequests.ts`.",
  "files_changed": [
    "frontend/src/ui/mergeRequestDiscussionQueue.ts",
    "frontend/src/ui/mergeRequestDiscussions.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequestsPages.ts",
    "frontend/src/ui/mergeRequestDiscussions.test.ts",
    "frontend/src/ui/mergeRequestPersonView.test.ts"
  ],
  "tests_added": [
    {
      "name": "mergeRequestDiscussions.test.ts leaving_under_lazy_or_off_sends_nothing_more (extended)",
      "proves": "#2510: with a running call of 12 iids and Rust answering 10, after viewLeft under lazy/off the 2 unanswered and the unsent iids lose their entries and no 3rd call is made; under full they are asked in call 2."
    },
    {
      "name": "mergeRequestDiscussions.test.ts leaving_during_a_reloads_ask_sends_only_the_reloads",
      "proves": "#2514: reloadRows marks a failed and a missing row `loading`; viewLeft comes before the ask answers. Under lazy/off both entries are gone and the only call holds the reloading read row. Under full all three are sent."
    },
    {
      "name": "mergeRequestPersonView.test.ts back_before_a_refresh_is_answered_reads_nothing",
      "proves": "#2514 end to end over the ?mr=list slice: open, refreshPersonView, Back before the ask answers → 1 ask, 0 readDiscussions, no entries."
    },
    {
      "name": "mergeRequestDiscussions.test.ts a_switch_back_to_full_keeps_the_running_calls_rows",
      "proves": "Switching full→lazy→full during a call clears `unhovered`, so the iids the answer lacks stay loading and are asked next. This kills the becameFull survivor."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  309 passed (309); Tests  4640 passed (4640). This ran before the last test was added; after it, the discussions file was rerun: 45 passed (45)."
    },
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; unused",
      "observed": "vue-tsc -b: no output; lint exit 0 (oxlint --type-aware && eslint, no findings); fmt:check: 'All matched files use the correct format.'; knip --include exports,types: no output"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 445 mutants over 4 files; 436 killed, 2 timeout, 5 survived, 2 no coverage (98.43%)",
    "survivors": [
      "src/ui/mergeRequestDiscussionQueue.ts:93 [] → [\"Stryker was here\"] — equivalent: the set is only probed with numeric iids (settle, moved verbatim)",
      "src/ui/mergeRequestDiscussionQueue.ts:162 [] → [\"Stryker was here\"] — equivalent: the string never matches an iid; in unhovered it is only deleted or probed by iid",
      "src/ui/mergeRequestDiscussionQueue.ts:147 generation += 1 → -= 1 — equivalent: generations are only compared for equality (dropped, unchanged)",
      "src/ui/mergeRequestDiscussions.ts:76 exhaustive default (no coverage) — equivalent: unreachable `never` arm",
      "src/ui/mergeRequests.ts:202 viewReplaced?.() → viewReplaced() — equivalent: the field is set synchronously in createMergeRequests before any list load can call rowsReplaced; `?.` only serves the null type",
      "src/ui/mergeRequests.ts:144 stale guard → true — not a changed line (show(), shifted); equivalent: listing.at is undefined unless done, so NaN >= n is false"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "#2512: the Queue construction moved too (`createQueue`), and so did asked, reload, retried, becameLazy, becameFull, leftView and rowsReloaded. isReloading, sentFirst, marked, afterAsk, LOADING and RUNNING are now private to the queue file. `entries` contents are still also written by threadRead/boxClosed in mergeRequestDiscussionRows.ts (not Owned, unchanged).",
    "Docs keeper, state.md row 88: name the private `Queue` of `ui/mergeRequestDiscussionQueue.ts` (createQueue and its functions) as the only writer of queued/unhovered/running/generation/reloads. Add that viewLeft drops pending-ask `loading` entries and puts the running call's iids in `unhovered`.",
    "Docs keeper, tree.md: name mergeRequestDiscussionQueue.ts and mergeRequestsPages.ts (Opening, openChanges, openPage, pageProblem; no findProject).",
    "I added two sentences to the viewLeft Contract doc comment in mergeRequestDiscussions.ts describing the two added drops. The signature is unchanged, and so is the meaning ('no call after Back').",
    "#2511: I took the reviewer's first option, a mutable `viewReplaced: (() => void) | null` on State. A one-job helper `personViewOf` sets it, so createMergeRequests stays within the 40-line cap.",
    "#2513: findProject went back into mergeRequests.ts and onto the MergeRequests type, not into a new mergeRequestsProject.ts. Pages no longer has findProject or project."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestDiscussionQueue.ts:178 leftView",
      "risk": "Under lazy, a box reload pressed with no entry and its ask still pending is also dropped by Back; its loading entry goes, and the row is asked again only on a hover. I followed the finding's fix wording; the box is probably unreachable while the view is open [INFERENCE]."
    },
    {
      "location": "frontend/src/ui/mergeRequestDiscussionQueue.ts:153 unsentDropped",
      "risk": "A reloading read row is still sent after Back (it is kept, per the Contract's 'not reloading'). So Back during a Reload's ask over read rows still makes one readDiscussions call for them."
    }
  ]
}
