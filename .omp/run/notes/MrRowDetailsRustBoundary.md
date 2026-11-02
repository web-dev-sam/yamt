# MrRowDetailsRustBoundary

Agent output (`agent://MrRowDetailsRustBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsRustBoundary.md), collected 2026-11-02T20:37:40.217Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: every touched file is in Owned. commands.rs touches only the command list, scheme registration and its doc line. tauri.conf.json touches only csp/devCsp. bindings.ts is not in the patch (PM4).",
    "PM1: merge-requests uses only yamt-gitio among yamt-* (public Glab::get/run, GlabRun, TIMED_OUT, last_line). src-tauri pictures.rs gets Glab via the yamt_merge_requests re-export. No new Cargo dependency.",
    "Contract: types, derives, serde tags and signatures match the brief and plan §2 #151–#153. The accepted type-placement deviation re-exports from lib.rs (394 lines, RS6).",
    "No copied decisions: picture.rs reuses web_page.rs' segment/path/number rules. rerequest.rs reuses graphql_data, Nodes, listed, NO_PROJECT, OPENED, logged_in_project via From<NoProject>. is_awaiting_review uses the one fold.",
    "State: MergeRequestState.pictures is written only in pictures.rs (offer/turn/picture_answer), never locked with pages/merged, released around fetch. Other deviations accepted. state.md/architecture rows: docs keeper.",
    "Comments CP1/CP4: change_size cites design §1.4, review_state cites GitLab's vue file, fake-glab picture() names the printf NUL fact. No narration/TODO. rerequested() follows opened()'s NO_PROJECT shape."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/rerequest.rs",
      "line": 168,
      "severity": "should",
      "rule_id": "promote",
      "problem": "rereviewed repeats Glab::get's GlabRun→words match with its own fallback, GLAB_FAILED. So a silent glab failure here reads \"glab failed without saying why\", while get (the brief's named rule) says \"glab exited with status N\", and review/glab_answer.rs repeats the match again. Each new glab write adds another copy whose words drift.",
      "fix": "In a gitio follow-up, expose a stdin-taking `Glab::post(cwd, args, body) -> Result<Vec<u8>, String>` (get's rule with a body), call it here, and delete GLAB_FAILED and the hand-written match."
    },
    {
      "file": "src-tauri/src/merge_requests.rs",
      "line": 78,
      "severity": "should",
      "problem": "The picture gate's Condvar `picture_turns` sits on MergeRequestState while the shelf it guards, and every wait/notify, lives in pictures.rs. A reader of the gate has to read two files, and each future picture field widens MergeRequestState again.",
      "fix": "Give pictures.rs one `Pictures { shelf: Mutex<PictureShelf>, turns: Condvar }` (Default) and hold it as MergeRequestState's single `pictures` field."
    },
    {
      "file": "src-tauri/src/merge_requests/pictures.rs",
      "line": 39,
      "severity": "nit",
      "problem": "`shelf` is `pub(crate)` but only pictures.rs calls it. Nothing gets harder as the app grows.",
      "fix": "Drop `pub(crate)` from `fn shelf`."
    }
  ]
}
