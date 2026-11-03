# MrDiscussionsDesign

Agent output (`agent://MrDiscussionsDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsDesign.md), collected 2026-11-03T14:10:43.005Z.

{
  "options": [
    {
      "name": "A — one command answering a 20-row prefix; the window's queue drives every mode",
      "summary": "read_discussions(iids) answers ≤20 rows per glab call (iids query, notes(last:20), system notes skipped, WebPage::note, pages+pictures offered). Window queue (ui/mergeRequestDiscussions.ts): full = rows with open discussions as pages arrive / after refresh swap / on switch; lazy = hovered row first; off = nothing. Core holds turn rule, order, words for any viewer.",
      "visions": [
        1,
        2,
        4,
        5
      ],
      "cost": "~25 Rust, ~6 core, ~27 state (5 one-line), ~13 page files; 2 new commands; 2 extra glab runs per batch (login check); ~2 min to fill 500 rows on gitlab-org/gitlab."
    },
    {
      "name": "B — Rust drives 'fully' on the list channel; second entry for 'lazily'",
      "summary": "list_merge_requests(messages, details) sends ListMessage::Discussions after End from a second thread beside the conflict check; read_discussions(iid) for lazy; window applies like Checked (buffer-aware).",
      "visions": [
        2
      ],
      "cost": "Setting crosses into the list command; switch to 'fully' needs a reload or a third path; two senders on one channel; two entry points for one fact."
    },
    {
      "name": "C — discussions block inside the list query",
      "summary": "MergeRequestRow.discussions filled by the list (212/250 complexity), per-row mergeRequest(iid) query for lazy, a second list text for off/lazy.",
      "visions": [
        5
      ],
      "cost": "Measured 22.22 s for 100 rows > glab's 20 s deadline: list pages fail on busy projects (breaks rule 7); two query shapes; +1.2 MB per page."
    }
  ],
  "recommendation": "Option A: one command, one query text, one window queue for all three settings; batch size 20 measured at 4.47 s (100 took 22.22 s, over GLAB_TIMEOUT 20 s) and lives only in Rust; details never cost the list its rows (rule 7). Turn rule in the TS core takes any viewer (me now; review mode's reviewer next) and the map of per-row DiscussionLoad serves review mode unchanged. Cost: two commands (read_discussions, set_discussion_details), +2 glab login runs per batch, ~2 min to fill 500 busy rows.",
  "design_doc": "docs/slices/briefs/mr-discussions-design.md",
  "briefs_written": [
    "docs/slices/briefs/mr-discussions-rust.md",
    "docs/slices/briefs/mr-discussions-core.md",
    "docs/slices/briefs/mr-discussions-state.md",
    "docs/slices/briefs/mr-discussions-page.md",
    "docs/slices/briefs/mr-discussions-verify.md"
  ],
  "slice_graph": "Wave 1: rust ∥ core. Then orchestrator `just bindings` (typecheck red until state lands; run state right after). Wave 2: state (needs rust+bindings; may overlap core). Wave 3: page (needs state+core; wires the window: row count box, Settings slot in CompareApp/RangeApp). Wave 4: docs keeper ∥ verify smoke; verify final `just check` after docs. Shared edits: plan rows #162–#164, RK60–RK61, architecture §3.6/§3.9/§4/§5, ipc-contract, project map — docs keeper/orchestrator.",
  "open_questions": [
    "A bot's comment (GitLab Duo, gitlab-bot) counts as a discussion's last comment, so a bot reply last shows the reviewer \"Your turn\" even if the author never answered; skipping bots would show the human comment before it instead. Decided: bots count (row #164), veto possible."
  ]
}
