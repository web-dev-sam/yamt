# MrMentionsDesign

Agent output (`agent://MrMentionsDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsDesign.md), collected 2026-11-05T09:24:35.076Z.

{
  "options": [
    {
      "name": "A — own list over textareas, second search, Post people from loaded row",
      "summary": "Core mentions.ts: word, order, edit. createPeopleSearch made twice per slice (peopleSearch, mentionSearch), so rule 6 holds by construction. Pure view in mergeRequestMentionLines.ts, mirror caret measure in textareaCaret.ts, one composable useMentions and one MergeRequestMentionList.vue placed inside the field. Keys taken before boxKeydown. insertText writes the pick. The Post box knows the loaded row whose page = linedUp webUrl, else search only.",
      "visions": [
        1,
        2,
        3,
        4,
        5
      ],
      "cost": "Frontend only, 4 slices, about 35 files, no Rust, IPC or dependency. The caret measure is proven only in WebKit smoke. insertText undo is measured first, with a setRangeText fallback. The Post box needs the merge-request page loaded.",
      "": ""
    },
    {
      "name": "B — A plus the lined-up merge request's people over IPC",
      "summary": "Like A, but yamt-review's MergeRequestRef gains author, assignees and reviewers from the REST merge request it already reads, plus an /approvals call. The pictures are offered to the window's pictures (RK53). Bindings are regenerated and reviewDomain converts the people. The Post box knows its people without the merge-request page.",
      "visions": [
        2
      ],
      "cost": "About 12 more files: a Rust slice, a new picture-offer path in a crate that has none, one more GitLab call per check, bindings. All for people the search finds one key later."
    },
    {
      "name": "C — CodeMirror comment fields with @codemirror/autocomplete",
      "summary": "Both textareas become small EditorViews through a new editor/ controller. Mentions become a CompletionSource over the same search, and the library does placement, keys and the undoable edit.",
      "visions": [],
      "cost": "A direct dependency against plan.md:407-409, a second editor seam (PM2), and fields rewritten off v-model. RK35 and RK73 must be re-proved. It reopens the Markdown-editor non-goal, and clipping and key order stay."
    }
  ],
  "recommendation": "A. Boring and frontend-only: two instances of one search factory, so the people box and the list cannot collide. One pure core for word and order, one list and one composable serve both fields. No Rust: search_people asks autocompleteUsers over the same authorized_users as GitLab's @ backend, and participants-first comes from the slice. Costs: the Post box shows the merge request's people only after its page loaded (else search only), caret placement is proven in WebKit smoke, and insertText undo is measured first with a fallback.",
  "design_doc": "docs/slices/briefs/mr-mentions-design.md",
  "briefs_written": [
    "docs/slices/briefs/mr-mentions-core.md",
    "docs/slices/briefs/mr-mentions-search.md",
    "docs/slices/briefs/mr-mentions-list.md",
    "docs/slices/briefs/mr-mentions-post.md",
    "docs/slices/briefs/mr-mentions-verify.md"
  ],
  "slice_graph": "Round 1, in parallel: mr-mentions-core and mr-mentions-search. Round 2: mr-mentions-list needs both; it wires the reply field (compare window and the range window's MR page) and starts smoke pass 1. Round 3: mr-mentions-post needs list; it wires the range Post box and starts smoke pass 2. Then the docs keeper (tree.md, state.md, plan rows #191-#192, RK amendments, CHANGELOG), then the mr-mentions-verify final pass. Owned globs are pairwise disjoint.",
  "open_questions": [
    "In the range window's Text to post box, typing @ lists the merge request's own people only after its merge-request page has loaded in that window; before that you get GitLab search results as you type. Acceptable, or worth a Rust change (about 12 more files) so they always show?"
  ]
}
