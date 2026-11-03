# MrDiscussionsPageR1

Agent output (`agent://MrDiscussionsPageR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsPageR1.md), collected 2026-11-03T15:52:03.545Z.

{
  "summary": "#2214: `glabRefusalText` (local `GlabRefusal` union) holds the glab words; the box, `listFailureText` and `rerequestReplyText` call it; words unchanged. #2215: the box gets its entry from `useRowDiscussions`, which asks on open and again when an open box loses its entry at a swap. #2217/#2218: no double ask. On Back, `show()` reloads a list 30 s or older (`RECHECK_PAUSE_MS`) and its swap re-asks one round, as designed. Reproduced in WebKit; a test pins it.",
  "files_changed": [
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/MergeRequestDiscussions.vue",
    "frontend/src/ui/mergeRequestDiscussions.ts",
    "frontend/src/ui/mergeRequestDiscussions.test.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "mergeRequestDiscussions.test.ts: an_open_box_asks_again_when_a_refresh_swap_drops_its_entry_and_a_closed_one_waits",
      "proves": "#2215, lazy: an open box whose entry a swap drops asks again (loading, call [639]); a closed box does not ask until it opens. Fails with the old watch(open): expected undefined to deeply equal { kind: 'loading' }"
    },
    {
      "name": "mergeRequests.test.ts: switching_to_full_asks_one_round_and_only_a_show_after_30_s_reloads_and_asks_it_again",
      "proves": "#2217: Off→full asks one round; a show before 30 s starts no load and no call. A show at 30 s reloads, asks nothing before the swap, then exactly one more round."
    },
    {
      "name": "mergeRequestsText.test.ts: refused answers test now calls glabRefusalText",
      "proves": "#2214: the box's refused words are the same glab words as the list's"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend fmt:check; lint; typecheck; unused",
      "observed": "All matched files use the correct format. / oxlint --type-aware && eslint, vue-tsc -b, knip: no findings, exit 0"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  271 passed (271) / Tests  4076 passed (4076)"
    },
    {
      "command": "#2215 fails before: useRowDiscussions temporarily back to watch(open, …), vitest run mergeRequestDiscussions.test.ts -t an_open_box",
      "observed": "× an_open_box_asks_again_… AssertionError: expected undefined to deeply equal { kind: 'loading' }; passes with the fix"
    },
    {
      "command": "WebKit just app-session start-fixture --name md --diff --mr list --size 1600x1000; Load lazily; focus() the !638 opener; Refresh .click() with focus kept; OLD watch (HMR)",
      "observed": "before Refresh: \"1 of 2 waits for you\", iids \"638\". After 3 s: activeElement still the opener, aria-expanded true, status \"Loading discussions…\", log only \"LIST busy=true / LIST busy=false\": nothing asked"
    },
    {
      "command": "same sequence with the fix",
      "observed": "after Refresh: [true,true,\"true\",\"1 of 2 waits for you\",\"LIST busy=true / fixture_discussions {iids: \\\"638\\\"} / LIST busy=false / discussions_read {asked: 1, answered: 1}\"]"
    },
    {
      "command": "WebKit md, B6 quick: Settings → Off, clear log, Load fully, 3 s, Back, Merge requests (list loaded ~20 s before)",
      "observed": "one round only: fixture_discussions 26 iids from 639 / 16 from 624 / 6 \"609,…,602\" with discussions_read 26/10/2, 16/10/0, 6/6/0"
    },
    {
      "command": "WebKit md, B6 again with the last list load ~36 s old (a MutationObserver logs aria-busy on the list)",
      "observed": "36364–37570: the round 26/16/6 from the switch; then at Back: \"40740 LIST busy=true / 40740 fixture_discussions {iids: 26 from 639} / 40759 LIST busy=false / 41142 discussions_read {asked: 26, …}\": the second round follows a list reload started by show()'s stale check"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 94.90% (335 killed, 4 survived, 14 no coverage); mergeRequestDiscussions.ts 96.25%, mergeRequestsText.ts 93.78% (100% covered)",
    "survivors": [
      "mergeRequestDiscussions.ts:207 `load.value === undefined`→`!==` in the watch source — equivalent: the source only signals each flip of that boolean, and its negation flips at the same moments; the callback reads only isOpen",
      "Not on changed lines (pre-existing): mergeRequestDiscussions.ts:88, :137, :145 and :167, and mergeRequestsText.ts :140, :181, :202, :242, :266 and :284. The :167 and mergeRequestsText ones are exhaustive defaults (TS3)."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "#2214 renames the page Contract's `discussionsRefusedText(answer: Exclude<DiscussionsAnswer,…>)` to `glabRefusalText(answer: GlabRefusal)`, as the finding's fix asks. The `DiscussionsAnswer` import left mergeRequestsText.ts.",
    "#2215: the ask rule is the exported `useRowDiscussions(discussions, iid, open)` in mergeRequestDiscussions.ts, which the box calls, instead of an inline watch in the .vue: ui/ has no component tests, so this makes it testable. It watches [open, entry is undefined], not the reviewer's `open && undefined`, so opening a box still calls askDiscussions and keeps the queue's `unhovered` rule reachable.",
    "#2217/#2218: no code fix: the second round is the stale reload on show (≥ RECHECK_PAUSE_MS since the last load), whose swap re-asks by design (§1.7). The new slice test pins this.",
    "Docs keeper: project-map state.md/tree.md should name `useRowDiscussions` (mergeRequestDiscussions.ts) as the box's asker; ui/AGENTS.md is updated."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequests.ts:178-187",
      "risk": "Under \"full\", every show 30 s or more after the last load reloads the list and asks every row's discussions again. The owner may not expect that cost from going Back. It is the existing stale rule, not changed here."
    },
    {
      "location": "frontend/src/ui/mergeRequestDiscussions.ts:201-213",
      "risk": "A box-side composable now lives in the state module. If reviewers count that as a second job, it moves to a use*.ts file, which needs a tree.md row."
    }
  ]
}
