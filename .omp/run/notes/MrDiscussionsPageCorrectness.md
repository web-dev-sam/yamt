# MrDiscussionsPageCorrectness

Agent output (`agent://MrDiscussionsPageCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsPageCorrectness.md), collected 2026-11-03T15:34:17.432Z.

{
  "verdict": "fail",
  "checked": [
    "Box follows brief: Off/count 0 keeps old span; else useHoverBox area @click.stop, opener aria-expanded without tooltip, People box classes; no v-html/title; openPage('discussion') reports step 'discussion' (mergeRequests.ts:215)",
    "Types and offering: note createdAt is ms (mergeRequestDomain.ts:71), so agoText fits; MergeRequestPicture takes Person|null; read_discussions offers note pages before replying (discussions.rs:20), so RK41 holds",
    "Text refactor keeps words: listFailureText and rerequestReplyText give the 9a3423db texts; mergeRequestsText.test.ts:73-110 pins list ends and refused answers; no-default switch stays exhaustive (TS2366)",
    "New tests fail if the feature is deleted. settingsStore test only pins identity, but the seam is type-enforced (`setDiscussionDetails: nothing` fails typecheck without the Pick); smoke 3-5 cover it",
    "Mutation run covers the 4 changed .ts (.vue not mutated, VF7). The 16 no-cov are `never` arms (gate-covered)",
    "Accepted: deviations (component :is line, wrap-break-word, error colour, one home for words, AGENTS agrees with R1), open_risks. No test run: the block is read from the code"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestDiscussions.vue",
      "line": 60,
      "severity": "block",
      "problem": "Under \"Load lazily\", a box left open while a Refresh's swap lands shows \"Loading discussions…\" forever with nothing asked. Rows are keyed by iid, so `open` survives; replaced→dropped clears the entry, lazy listed asks none, and watch(open) never fires again (design §1.7).",
      "fix": "Ask while open with no entry: `watch(() => open.value && load.value === undefined, (unasked) => { if (unasked) askDiscussions(props.row.iid); })`. askDiscussions does nothing outside lazy, so this also covers the first open.",
      "rule_id": "R-design-1.7"
    },
    {
      "file": ".omp/run/mutants/MrDiscussionsPage.survivors.txt",
      "line": 2,
      "severity": "nit",
      "problem": "problemText.ts:169 `found ?? []` was kept as \"line not changed by this slice\", which is not a VF7 (a)/(b)/(c) reason. It really is (a) equivalent: destructuring skips index 0. Nothing gets harder, but that wording could excuse a real gap.",
      "fix": "Restate it as \"(a) equivalent: destructuring skips index 0, so a one-element array gives the same what/line/column as []\".",
      "rule_id": "VF7"
    }
  ]
}
