# MrThreadsHttpBoundary

Agent output (`agent://MrThreadsHttpBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsHttpBoundary.md), collected 2026-11-04T11:56:19.401Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all 7 touched files are in Owned. PM1 holds: gitio gains no yamt-* dep; serde_json is the orchestrator's shared edit (plan #181).",
    "Contract kept: HttpAnswer/HttpCall fields and derives, gitlab_message/reason/is_success, http_call and Glab::send signatures, re-exported from lib.rs:44-47.",
    "Moved, not copied: review has no parser left (grep clean). posted gives the same Outcomes and the reason order matches the old closure; RK33 test names are unchanged.",
    "Deviations accepted: sent replaces run (brief allowed it), error_message_from had no other users, is_success is tested, no IPC change. Unenforced --include accepted: review's caller passes it (gitlab.rs:84).",
    "Comments: status_of cites glab 1.124.0 and its source (CP1); gitlab_message drops the 'Moved from' text; lib.rs //! updated (CP3). RS6 ok: http.rs 223 lines, glab.rs 192.",
    "Growth: no new state. glab.rs's HTTP reading is in its own file, http.rs. Glab::post (GraphQL) and Glab::send (REST with --include) do different jobs; neither copies the other."
  ],
  "findings": [
    {
      "file": "crates/gitio/AGENTS.md",
      "line": 15,
      "severity": "should",
      "problem": "The gitio glab row lists only run/get/auth_status, and the note's doc lines skip this row, so the docs keeper will leave gitio's agent guide without Glab::send, HttpCall and glab/http.rs. The next implementer then works from a stale guide.",
      "fix": "Add a deviations_from_brief line asking the docs keeper to add send(cwd, args, body) → HttpCall and glab/http.rs (HttpAnswer, reason order, http_call) to crates/gitio/AGENTS.md:15.",
      "rule_id": "PM6"
    },
    {
      "file": "crates/gitio/src/glab/http.rs",
      "line": 113,
      "severity": "nit",
      "problem": "The test helpers answered and with_body build the same HttpAnswer twice. Nothing gets harder as the app grows.",
      "fix": "Write answered as HttpCall::Answered(with_body(status, body, glab_line))."
    },
    {
      "file": "crates/gitio/tests/glab.rs",
      "line": 116,
      "severity": "nit",
      "problem": "Two tests (send_writes_the_body_on_stdin, a_failing_glab_keeps_its_exit_stdout_and_stderr) build the same --include argv with the same three lines. Nothing gets harder as the app grows.",
      "fix": "Add one helper, fn post_with_headers() -> Vec<&'static str>, next to POST and use it in both tests."
    }
  ]
}
