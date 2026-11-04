# MrThreadsCrateBoundary

Agent output (`agent://MrThreadsCrateBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsCrateBoundary.md), collected 2026-11-04T14:25:51.851Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all files in crates/merge-requests/{src/**,tests/{discussions,threads}.rs,AGENTS.md}. description.rs: re-export line only. No Cargo/gitio/fixture/src-tauri/docs edits. Images' AGENTS line applied (AGENTS.md:9).",
    "PM1: only yamt_gitio, dom_query and serde_json used; no new crate edge. review's draft_notes_from/posted can't be shared (PM1 forbids merge-requests→review), so the drafts.rs/write.rs copies are accepted.",
    "Contract: brief derives, camelCase and tag=kind; lib.rs re-exports all new types plus ImageSize/ImageLength. read_discussions signature kept. From<NoProject> x3 in project.rs:163-188. Plan #179 amends #162 (DR1 ok).",
    "Deviations accepted: file splits for RS6, DiscussionId moved to id.rs, expects with repo precedent. Open risks (23.5 s batch, ISO compare) are escalated to Main and are the correctness lens's; edit_of comment is CP1 with source.",
    "One turn builder: turn.rs open_discussion serves rows and thread. person_notes is the only system-note filter (RK61). bodyHtml reaches the window only via described_on (RK60/RK66). All argv in query.rs/rest.rs; bodies via serde_json.",
    "Comments: lib.rs //! updated (CP3). Doc comments cite RFC 9110 §15.5, UserReferenceFilter and note.rb. No narration, TODO or section headers found."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/discussion_thread/read.rs",
      "line": 174,
      "severity": "should",
      "rule_id": "principles §1",
      "problem": "GitLab's discussion gid is parsed in two places (turn.rs:23 open_notes and here). Here it allocates a DiscussionId for every discussion (up to 1,000) just to compare it. A third reader would parse it again, and the 'unreadable id' rule has no single home.",
      "fix": "Parse once in answer.rs: make DiscussionNode.id an Option<DiscussionId> (deserialize_with calling from_gid), then use `.ok_or(ODD_ID)` in open_notes and `found.id.as_ref() == Some(discussion)` here."
    },
    {
      "file": "crates/merge-requests/src/discussion_thread/read.rs",
      "line": 166,
      "severity": "should",
      "rule_id": "principles §3",
      "problem": "found_discussion repeats every_discussion's per-page sequence (fetch(&[iid], after) → parsed_batch → merge_requests.remove(&iid) → not_sent, discussions.rs:290-298). A change to how one merge request's page is read must be made twice.",
      "fix": "Extract `pub(crate) fn merge_request_page(iid, after, fetch) -> Result<MergeRequestNode, String>` in discussions.rs and call it from every_discussion's loop and from found_discussion."
    },
    {
      "file": "crates/merge-requests/src/discussion_thread/write.rs",
      "line": 83,
      "severity": "should",
      "problem": "Write::Reply/Write::DraftReply repeat ReplyKind's comment/draft split under a third name ('Reply' for what ReplyKind and the log call 'comment'). A new reply kind would need changes to two enums and three matches.",
      "fix": "Make it `Write::Reply { discussion, kind: ReplyKind, text }`, matching `kind` inside `request` and `kind()`."
    },
    {
      "file": "crates/merge-requests/src/discussion_thread/tests.rs",
      "line": 484,
      "severity": "should",
      "rule_id": "RS11",
      "problem": "query/rest.rs has no tests of its own. Its builders (draft_notes_args, markdown_args/body and, through `request`, the write routes) are pinned in discussion_thread/tests.rs, against the note's own RS11 deviation. Someone editing rest.rs won't find them.",
      "fix": "Move the_drafts_and_the_preview_are_asked_as_gitlab_documents and the pure route/body asserts into query/tests.rs. Keep only the Write→request wiring in discussion_thread/tests.rs."
    },
    {
      "file": "crates/merge-requests/src/discussions/id.rs",
      "line": 48,
      "severity": "nit",
      "problem": "This is a third lowercase-hex closure (also links/target.rs:162 and description/address.rs:159). Nothing gets harder except that a fourth copy becomes likely.",
      "fix": "Optionally add `pub(crate) fn is_lower_hex(c: char) -> bool` to web_page.rs beside is_path_segment and use it in id.rs and links/target.rs."
    }
  ]
}
