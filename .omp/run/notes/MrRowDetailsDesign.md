# MrRowDetailsDesign

Agent output (`agent://MrRowDetailsDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T18-27-31-593Z_01a19d84-3c89-72d1-885b-0286d2017e79/MrRowDetailsDesign.md), collected 2026-11-02T19:41:15.968Z.

{
  "options": [
    {
      "name": "A — list carries every field; yamt-picture scheme + Gravatar by CSP; one tooltip directive",
      "summary": "The list query adds author, avatars, approver names, approved/reviewState, updateMergeRequest, label colours and diffRefs (about 149/250, no new version floor). Uploaded avatars are fetched by `glab api` and served on a `yamt-picture:` scheme by username; Gravatar addresses are loaded by the window directly, with a CSP entry for exactly its two hosts. The only write is `mergeRequestReviewerRereview`, after a fresh is-still-a-reviewer check. `v-tooltip`, useHoverBox, useHoverMenu.",
      "visions": [
        2,
        3,
        4,
        5
      ],
      "cost": "5 implementer runs in 3 waves: Rust about 20 files and 1,200 lines, core, state+ipc, hover primitives, page (about 15 files). A CSP entry. Frontend typecheck red from `just bindings` until the page slice."
    },
    {
      "name": "B — uploaded pictures as data: URLs on the list channel; tooltip component",
      "summary": "Same fields as A, with Gravatar handled as in A. After End and the local check, Rust sends `ListMessage::Picture` with base64 data, using a hand-written encoder or the base64 crate (DR3). The window keeps a second picture map. Tooltips wrap each element in `<HoverTip>`.",
      "visions": [
        5
      ],
      "cost": "No scheme, but uploaded pictures wait up to 60 s for the list and the local check and travel as JSON a third larger. Adds a second store and about 15 wrappers that change the row's flex layout."
    },
    {
      "name": "C — lean list, people asked on hover",
      "summary": "The list adds only author, label colours and diffRefs. Hovering the stack or the approvals runs `merge_request_people(iid)` and shows 'Loading…' first. Pictures and tooltip as in A.",
      "visions": [
        1
      ],
      "cost": "Contradicts plan #131's rejection of per-hover calls while the score fits (DR1). Hovers wait 1–2 s on glab. Adds a command, a loading state per row and a box state machine."
    }
  ],
  "recommendation": "Option A, revised for #2104 and #2105. Re-request is GitLab's own control: rotate-ccw left of the state icon, only for reviewers whose review is done and only when `mayRerequest`. Rust re-asks the reviewers first: a non-reviewer gets no write, a still-requested one is not asked twice. Gravatar: GitLab's defaults are `https://secure.gravatar.com` and `https://www.gravatar.com` `/avatar/<hash>` (1_settings.rb:525-526). Rust accepts only those; the window loads them with no-referrer, never via glab. Custom Gravatar hosts get initials. No dependency.",
  "design_doc": "docs/slices/briefs/mr-row-details-design.md",
  "briefs_written": [
    "docs/slices/briefs/mr-row-details-rust.md",
    "docs/slices/briefs/mr-row-details-core.md",
    "docs/slices/briefs/mr-row-details-state.md",
    "docs/slices/briefs/mr-row-details-hover.md",
    "docs/slices/briefs/mr-row-details-page.md",
    "docs/slices/briefs/mr-row-details-verify.md"
  ],
  "slice_graph": "Wave 1: rust ∥ core. Then the orchestrator runs `just bindings`. Wave 2: state (needs rust and core) ∥ hover (needs nothing; generic ui/ files only). Wave 3: page (needs state and hover; owns every MergeRequest*/CiStatus* .vue; wires the window; real-app proof). Then verify (smoke after page; final pass after the docs keeper). Revised: rust, core (adds `reviewDone`), state, page, verify; hover unchanged.",
  "open_questions": []
}
