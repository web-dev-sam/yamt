# MrPeopleDesign

Agent output (`agent://MrPeopleDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleDesign.md), collected 2026-11-03T21:36:59.507Z.

{
  "options": [
    {
      "name": "A: GitLab autocomplete per paused keystroke; one APPEND or REMOVE per change; per-MR queue",
      "summary": "search_people(text) uses autocompleteUsers, the query GitLab's own dropdown sends, 250 ms after the last key; only the newest answer is shown. change_people(iid, change) sends one mergeRequestSetAssignees or SetReviewers with APPEND or REMOVE of one username and asks for both lists back. Rust answers changed or unchanged (Free case) from that answer. Pictures are offered before the reply. The window queues changes per MR.",
      "visions": [
        2,
        4,
        5
      ],
      "cost": "About 20 Rust, 5 core, 19 state and 8 page files over 4 slices. A GitLab older than 16.3 has no search. mayRerequest keeps its name; its doc names all three uses."
    },
    {
      "name": "B: Load the project's people once, filter in the window",
      "summary": "list_project_people pages through projectMembers once per window and caches it in the slice; the search is a local filter, so there is no pause and no race. Writes as in A.",
      "visions": [
        5
      ],
      "cost": "Fails rule 2: projectMembers missed 3 of 7 people who have access through an invited group (measured on gitlab-org/gitlab). Thousands of members on large projects, stale after load, a second copy of membership."
    },
    {
      "name": "C: Fresh read, then a whole-list REPLACE",
      "summary": "Rust reads the MR's lists afresh, computes the new list itself, and writes it with operationMode REPLACE, as GitLab's own page does. It could answer NotOpen before writing.",
      "visions": [
        3
      ],
      "cost": "Two calls per change. A change made on GitLab between the read and the write is lost (breaks rule 8). It still cannot know the tier before writing. yamt would compute a list GitLab owns."
    }
  ],
  "recommendation": "Option A. It finds the same people as GitLab's own dropdown (same query, same 250 ms pause). Each change is one write that GitLab applies to its own current list (rule 8). The row shows only what GitLab answered, and when the answer lacks the change, the box says so (rule 6, RK64). Cost: four implementer slices, at most two at once; no search on GitLab older than 16.3; mayRerequest is not renamed, because a rename would touch files of every slice.",
  "design_doc": "docs/slices/briefs/mr-people-design.md",
  "briefs_written": [
    "docs/slices/briefs/mr-people-rust.md",
    "docs/slices/briefs/mr-people-core.md",
    "docs/slices/briefs/mr-people-state.md",
    "docs/slices/briefs/mr-people-page.md",
    "docs/slices/briefs/mr-people-verify.md"
  ],
  "slice_graph": "Wave 1: rust and core in parallel (core needs nothing). Then the orchestrator runs just bindings (only new types and commands, so the frontend stays green). Wave 2: state (needs rust plus bindings, and core). Wave 3: page (needs state; wires the window and runs the first real-app proof). Wave 4: the docs keeper beside verify's smoke pass; verify's final just check runs after the docs keeper. Owned files are pairwise disjoint.",
  "open_questions": [
    "On a self-managed GitLab older than 16.3 (Aug 2023), typing a name shows GitLab's error. Me and people on loaded rows can still be added. Supporting it costs a second search (projectMembers), which on newer GitLab misses people who have access through invited groups. OK as is?",
    "On GitLab Free, adding a second assignee or reviewer shows a 'GitLab did not add' sentence. GitLab's own page swaps the person instead. Swapping costs two writes and two notifications, decided without knowing the tier. Keep the sentence?",
    "If a change takes a row out of the active filters (e.g. Reviewer: None, then you add a reviewer), the row and its box vanish at once. Keeping it until the box closes costs a pinned-row state, and the list briefly disagrees with its filters. OK?"
  ]
}
