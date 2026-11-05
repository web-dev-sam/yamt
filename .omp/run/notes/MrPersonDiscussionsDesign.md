# MrPersonDiscussionsDesign

Agent output (`agent://MrPersonDiscussionsDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsDesign.md), collected 2026-11-05T13:24:12.673Z.

{
  "options": [
    {
      "name": "A — first comment in the read, keyed threads, core groups",
      "summary": "Rust adds OpenDiscussion.first {createdAt, body: Description} via described_on, with its pages/uploads offered (one Offers collector shared with the thread read). mergeRequestThread.ts becomes a map of threads by DiscussionId (panel + expanded), per-discussion read tokens, public window-wide `writing`. The panel body is split out for inline reuse. Core personDiscussions.ts does the order; the queue gains wantRows/retryRows/reloadRows/viewLeft.",
      "visions": [
        1,
        2,
        4,
        5
      ],
      "cost": "~55 files over six slices; no new command or dependency. GitLab cost: none (bodyHtml already queried). IPC: one Description per discussion (the rust slice measures it). Under lazy/off, the first opening on a big project takes minutes."
    },
    {
      "name": "B — A's Rust, per-entry thread objects",
      "summary": "A factory createThread(...) gives a ThreadHandle. The panel and each expanded entry (useThread) own their own handle. The slice keeps replyTexts, a WriteLock and a registry Set<ThreadHandle> so refreshes and submits reach every handle.",
      "visions": [],
      "cost": "Like A, plus disposal and registry code. Thread state then has two owners (handle and registry, against vision 2), and a write in flight can land in an unmounted handle."
    },
    {
      "name": "C — no Rust change, first comment via thread reads",
      "summary": "The view fills firstComments: Map<DiscussionId, FirstLoad> by calling readDiscussionThread for each entry as it scrolls into view. Everything else as in A.",
      "visions": [],
      "cost": "2–4 glab runs per entry for text the first read already sent (each run re-reads the whole MR). It adds a second load path, which #183 rejected, and the text arrives late."
    }
  ],
  "recommendation": "Option A. One builder of OpenDiscussion, one owner of thread state keyed by discussion (records cannot cross), one shared body for the panel and the entry, one pure core order, keptInPlace shared by rows and entries. Formatted first comments cost GitLab nothing: bodyHtml is already queried (19.7 s → 23.5 s, paid since #179). Cost: ~55 files, one-time `first` churn in test literals, and a slow first opening on big projects under lazy/off (progress shown, Retry per failed row).",
  "design_doc": "docs/slices/briefs/mr-person-discussions-design.md",
  "briefs_written": [
    "docs/slices/briefs/mr-person-discussions-rust.md",
    "docs/slices/briefs/mr-person-discussions-core.md",
    "docs/slices/briefs/mr-person-discussions-threads.md",
    "docs/slices/briefs/mr-person-discussions-ipc.md",
    "docs/slices/briefs/mr-person-discussions-state.md",
    "docs/slices/briefs/mr-person-discussions-view.md",
    "docs/slices/briefs/mr-person-discussions-verify.md"
  ],
  "slice_graph": "R1 in parallel: rust, core, threads. Then orchestrator `just bindings` (after rust). R2: ipc (needs rust + bindings + threads committed; adds `first` to test literals in 3 ui test files, line-scoped). R3: state (needs core, threads, ipc). R4: view (needs state; WIRES THE WINDOW, both compare and range via MergeRequestsView.vue). R5: docs keeper, then verify (smoke after view; final `just check` after docs). R6: owner check on the playground.",
  "open_questions": []
}
