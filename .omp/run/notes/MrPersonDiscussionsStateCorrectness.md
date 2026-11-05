# MrPersonDiscussionsStateCorrectness

Agent output (`agent://MrPersonDiscussionsStateCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsStateCorrectness.md), collected 2026-11-05T14:36:00.451Z.

{
  "verdict": "fail",
  "checked": [
    "Queue entry points match the Contract: wantRows no-op when nothing missing (no loop); retry only refused/failed; reloadRows skips reloading rows; off reload needs an entry. Each tested in mergeRequestDiscussions.test.ts",
    "Held order: keptInPlace runs only while order matches; pick, refresh and rowsReplaced bump it. Killed by an_expanded_entry_keeps_its_place, picking_anna and a_list_refresh_lets_a_collapsed_entry. Pinned lists match smoke_evidence",
    "Open risks: (1) previous-value keptInPlace accepted (order bump on every re-sort); (2) in-flight row not re-asked accepted (same as reloadDiscussions' pressedAgain, design 2.5); (3) pre-flush demand watch accepted",
    "Box queue unchanged: listed via queuedLast is safe (switched('full') clears unhovered first); afterAsk's isWaiting cannot drop a box reload (pressedAgain returns early); core keptInPlace by key equals the old identity filter",
    "Kept survivors meet VF7(a): order/generation compared only for equality; string-seeded sets probed only with numeric iids; :86 unreachable never arm. Shown, Refresh, mergeRequests.ts:141 on unchanged lines",
    "No test files run: the block was found by reading the code (open → refreshPersonView → leavePersonView → askFirst resolves)"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestDiscussionQueue.ts",
      "line": 135,
      "severity": "block",
      "rule_id": "RK70",
      "problem": "Under 'lazy' or 'off', Back during a Reload's pending ask still sends readDiscussions after Back, even under Off. refreshPersonView marks unread or failed rows `loading` but queues them only once the ask answers. viewLeft clears only `queue.queued`, so those entries survive and afterAsk sends them, against 'no call after Back' (design #11).",
      "fix": "Under a non-'full' setting, make viewLeft drop every `loading` entry that is neither in the running call nor reloading, so afterAsk skips them. Add a test: open, refreshPersonView, Back before the ask answers → no readDiscussions."
    }
  ]
}
