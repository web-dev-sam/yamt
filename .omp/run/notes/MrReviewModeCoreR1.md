# MrReviewModeCoreR1

Agent output (`agent://MrReviewModeCoreR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T17-39-00-632Z_01a1a27e-2d98-762d-8985-51a9589317bb/MrReviewModeCoreR1.md), collected 2026-11-03T18:37:28.043Z.

{
  "summary": "Fix round 1 (#2219, #2220). discussions.ts now has one `viewerPossessive(viewer, at: \"start\" | \"inside\")`. `turnText` and the review order's sorted and failed words all use it, and the clashing local in `reviewSortedText` is renamed `whose`. `DueDates.dueOf(iid)` is now the only due-day lookup: `datedFirst` uses it as `byDueDate(rows, dueOf)`, and the review order in `mergeRequestsShown.ts` gets it passed in. No exported name or signature changed; `dueOf` is the only addition. Each fix has a test that fails if its two users drift apart.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/discussions.ts",
    "frontend/src/mergeRequests/internal/reviewOrder.ts",
    "frontend/src/mergeRequests/internal/reviewOrder.test.ts",
    "frontend/src/mergeRequests/AGENTS.md",
    "frontend/src/ui/mergeRequestDueDates.ts",
    "frontend/src/ui/mergeRequestDueDates.test.ts",
    "frontend/src/ui/mergeRequestsShown.ts"
  ],
  "tests_added": [
    {
      "name": "reviewOrder.test.ts: the review words name %s as the turn words do (me, a named reviewer, a lowercase-username reviewer)",
      "proves": "The possessive in reviewSortedText and reviewFailedText equals turnText's possessive (lowercased for me). A drift in either user fails the test."
    },
    {
      "name": "mergeRequestDueDates.test.ts: due_of_is_the_day_dated_first_orders_by_and_follows_the_repository",
      "proves": "dueOf gives each row's stored day or null and follows a change of repository; datedFirst orders by exactly those days (equal to byDueDate(rows, dueOf)). The review order reads the same dueOf."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend fmt:check && typecheck && lint && unused && sfc-order",
      "observed": "\"All matched files use the correct format.\"; vue-tsc -b, oxlint --type-aware + eslint, knip and check-sfc-order all finished with no errors. The first lint run flagged unbound-method on `dueOf`; fixed by typing it as a readonly function property."
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files 273 passed (273), Tests 4131 passed (4131). One earlier full run failed `fences.test.ts > the real source tree has no fence violations`. Run alone it passed 52/52, and the next full run passed everything."
    },
    {
      "command": "just mutants HEAD",
      "observed": "All files 96.51% (304 killed, 9 survived, 2 no coverage); mergeRequestDueDates.ts 100%."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 304 killed, 0 timeout, 9 survived, 2 no-cov; dueDates 100%, shown 95.74%, discussions 95.49%, reviewOrder 95.65%",
    "survivors": [
      "frontend/src/mergeRequests/internal/reviewOrder.ts:77 \"inside\"→\"\" in viewerPossessive — equivalent: any `at` other than \"start\" gives the inside form, and \"\" fails vue-tsc (`at` is \"start\"|\"inside\"), so typecheck covers it",
      "frontend/src/mergeRequests/internal/reviewOrder.ts:81 \"inside\"→\"\" — equivalent, same reason as line 77"
    ]
  },
  "acceptance_not_run": [
    "No WebKit or app-session run: this fix round only refactors the possessive and the due-day lookup, and every on-screen word stays the same (the existing word tests pass unchanged). The round names no WebKit acceptance."
  ],
  "deviations_from_brief": [
    "Added one paragraph to frontend/src/mergeRequests/AGENTS.md (owned) naming viewerPossessive as the only place the possessive is spelled.",
    "viewerPossessive takes `at: \"start\"|\"inside\"` instead of capitalising its result, so a name is never re-cased: a username fallback \"ben\" stays \"ben's turn\".",
    "DueDates.dueOf is typed `(iid: number) => CalendarDay | null`, not MergeRequestIid, to match reviewOrdered's and byDueDate's callback parameter.",
    "ui/AGENTS.md (owned by the page slice) line 51 should say: \"Due dates (…) put dated rows first (`datedFirst`, by `dueOf`, the one day lookup the review order reads too)\"."
  ],
  "open_risks": [
    {
      "location": "frontend/src/mergeRequests/internal/discussions.ts:24,25,30,32; reviewOrder.ts:23; ui/mergeRequestsShown.ts:55",
      "risk": "Mutants survive on lines I did not change in this round (TURN_RANK {}, NO_TURNS {}, WAITING_TEXT \"\", reviewDetails {kind:\"none\"}). They come from round 1 and fall outside this fix's changed lines."
    },
    {
      "location": "frontend/scripts/fences.test.ts",
      "risk": "Failed once in a full parallel run and passed alone and on the rerun. It looks like a timeout under load, not something these edits cause."
    }
  ]
}
