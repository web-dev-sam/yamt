# MrRowDetailsRustCorrectness

Agent output (`agent://MrRowDetailsRustCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsRustCorrectness.md), collected 2026-11-02T20:39:14.098Z.

{
  "verdict": "pass",
  "checked": [
    "avatar_source/is_uploaded_avatar traced by hand: look-alike host (.evil root), :port, @userinfo, //host, .., %, nested /uploads/ all fail is_web_path/is_path_segment; only origin+path reaches glab. picture/tests.rs pins each case",
    "Gravatar never reaches glab: only Uploaded builds PictureAddress, fetch_picture takes only that; Gravatar suffix/userinfo hosts fail on the /avatar/ strip. tests/list.rs and offered_pictures_on_path_s_glab check the log has no gravatar",
    "Gate: turn() takes running<4 under the shelf lock, marks Running, drops the guard before glab; decrement+Done+notify_all after; waiters re-read offered each wake. slow_pictures test: log START≤running≤4, fails at 3, 5 or no gate",
    "Rerequest: fresh REVIEWERS_QUERY → NotOpen/NotReviewer/awaiting (no write) → mutation with fresh gid; payload errors → Refused{first}; exit 1 → last stderr line. tests/rerequest.rs checks exact body and that 3 paths write no stdin",
    "Size rule (diffRefs Option<IgnoredAny>: null/missing → None), approved-first fold, label hex check, author/may_rerequest: page/tests.rs boundary tests would fail if each rule were deleted; CSP test exact list in both keys",
    "Deviations accepted (type placement, gate as shelf.running+Condvar, crowd scenario, GLAB_FAILED for empty stderr, name default); is_username mutants killed by plus+one sharing anna's address (one_fetch test). No bash test run"
  ],
  "findings": [
    {
      "file": "src-tauri/src/merge_requests/pictures.rs",
      "line": 60,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "Both kept survivors (answer_picture → (), warn_unknown_review_state → ()) are kept as (c) wiring but name no smoke that observed them. answer_picture also has a decision (try_state None → 404) and is the only path from the registered scheme to picture_answer. Until a smoke covers it, a broken handler or registration shows initials and no test fails.",
      "fix": "Name the smoke that kills them in the survivors file: verifier app-session with `--glab mr-row-details` after the page slice, showing anna's uploaded avatar rendered and the unknown-state warn line in the log. Add it to that slice's acceptance."
    }
  ]
}
