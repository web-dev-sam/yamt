# LocalConflictsDesign

Agent output (`agent://LocalConflictsDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T16-50-40-839Z_01a19d2b-9247-72e3-a0e7-6b1cfa74978f/LocalConflictsDesign.md), collected 2026-11-02T17:18:04.255Z.

{
  "options": [
    {
      "name": "A - checks follow the end on the load's channel; the shell holds the run's memory",
      "summary": "After End, the same blocking worker runs check_conflicts: git version, remote_for, one ls-remote, the rule-5 head comparison, one cat-file, at most one fetch_without_refs, then merge-tree two at a time (10 s each, 60 s per load). Each changed row goes out as ListMessage::Checked { row: CheckedRow }. Readiness gains mergesCleanly, with no payload. MergedPairs sits in MergeRequestState.merged behind a Mutex held for the whole check, so a Refresh's check waits and merges nothing twice.",
      "visions": [
        2,
        5,
        1,
        4
      ],
      "cost": "About 2,200 changed lines over 3 slices; one IPC variant, one struct, one message kind, and a changed listMergeRequests(onPage, onChecked); the 3.9 'nothing cached' rule is amended and 3.5 updated; the command keeps running after its End."
    },
    {
      "name": "B - a second command per load",
      "summary": "ListMessage stays as it is. The slice calls a new check_merge_requests command on a second Channel after each end, and Rust checks the rows it kept from the last list (a last_listed Mutex plus the merged Mutex).",
      "visions": [],
      "cost": "A plus about 300 lines, two Mutexes, one command and one Source method. The window and Rust both say which rows belong to which load (two writers, vision 2), which leaves a race on Refresh."
    },
    {
      "name": "C - a run-long checker thread in the crate",
      "summary": "yamt-merge-requests owns a ConflictChecker (a Mutex of MergedPairs, a queue and a worker thread) fed page by page. Rule 7 allows one ls-remote per load and later pages bring new targets, so it still has to wait for the last page: no earlier results than A.",
      "visions": [],
      "cost": "A plus about 400 lines. It reverses 3.9 (state, a thread and a lifecycle in the crate), which goes against visions 5 and 1."
    }
  ],
  "recommendation": "Option A. It adds one message kind to the channel the list already streams on and keeps the crate stateless: the run's memory is a plain MergedPairs value that src-tauri holds behind one lock, and 3.9 is amended by one sentence. Holding that lock for a whole check is also what guarantees 'never merged twice' without any cancellation. Cost: three sequential slices, one IPC variant (mergesCleanly: 'No conflicts (checked locally). GitLab has not checked the rest yet', Lucide circle-dashed-check, muted) and plan rows 149-150 to record.",
  "design_doc": "docs/slices/briefs/local-conflicts-design.md",
  "briefs_written": [
    "docs/slices/briefs/local-conflicts-gitio.md",
    "docs/slices/briefs/local-conflicts-check.md",
    "docs/slices/briefs/local-conflicts-page.md"
  ],
  "slice_graph": "Runs in order, one implementer at a time: gitio (crates/gitio), then check (merge-requests, src-tauri merge_requests*, tests/glab/local-conflicts, four recorded pages, scripts/local-conflicts-repo.sh), then the orchestrator runs just bindings, then page (frontend ipc/ui/mergeRequests; wires the window, real-app run), then the verifier. Each compiles against the one before, and bindings.ts is generated. The docs keeper may run beside the page slice. tree.md must name the new script before just check.",
  "open_questions": [
    "On git 2.38-2.49 (stock macOS git 2.39, Debian 13's 2.47) the check can only merge by leaving a few unreferenced objects per merge in the object store. git's gc prunes them later, and no ref, branch, index or file changes. The alternative is no local check below git 2.50, where those rows keep GitLab's possibly stale answer. Keep it?"
  ]
}
