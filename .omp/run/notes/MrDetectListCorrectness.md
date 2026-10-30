# MrDetectListCorrectness

Agent output (`agent://MrDetectListCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrDetectListCorrectness.md), collected 2026-10-30T14:02:12.779Z.

{
  "verdict": "fail",
  "checked": [
    "Paging (list.rs): MAX_PAGES=500/100; 5 pages plus a cursor → Cut{500} with no 6th call, exactly 5 → Loaded, cursor passed on, a page failing keeps the earlier pages sent: list::tests catch each boundary.",
    "Parsing (page.rs, by hand vs design §2.2): query matches field by field; null counts → 0, saturating; every status maps; errors win over data; recorded !13 compared whole, jobs in GitLab's order.",
    "JobPage::built rejects http, userinfo, /-ended origin, //evil, '..', ?, #, foreign or empty segments. detect covers scp, ssh:port, https creds, file://, drive letters; GITLAB_HOST/GL_HOST via a child test.",
    "tests/list.rs: argv suffixes for both pages; cwd and env on all 4 calls; GlabMissing; NotLoggedIn after auth status only; timeout → TIMED_OUT under 25 s; 404. Review GETs use --method GET, so POST-on-fields is safe.",
    "Review cutover: Glab::get/auth_status do what answer/require_logged_in did; first/last-line test uses distinct lines; the moved exit_words asserts live in gitio. Mutation run: 0 kept survivors, nothing to check against VF7.",
    "Risks accepted: null GraphQL nodes [INFERENCE: GitLab drops unauthorized items]; inherited GIT_DIR (design §2.2; glab inherits it too, so they agree). B3 must own query.rs for DETAILS_QUERY. No test run."
  ],
  "findings": [
    {
      "file": "crates/gitio/src/names.rs",
      "line": 123,
      "severity": "block",
      "rule_id": "vision-2",
      "problem": "`is_found_or_no_match` and `NO_MATCH_STATUS` (git config --get-regexp exits 1 when nothing matches) are now copied in both names.rs and merge_config.rs. A change to that rule in one copy would not reach the other; this is a copied rule (growth harm, block (2)).",
      "fix": "Make merge_config.rs's `is_found_or_no_match` pub(crate) and import it in names.rs, deleting the copy and its constant. Add merge_config.rs to this slice's Owned for the fix round."
    },
    {
      "file": "crates/gitio/tests/glab.rs",
      "line": 1,
      "severity": "should",
      "rule_id": "RS6",
      "problem": "The file is now 414 lines, over RS6's 400. Every gitio test added later makes it longer; nothing else depends on its size.",
      "fix": "Move the names tests (branch names, remote_names, remote_urls) to a new crates/gitio/tests/names.rs, with that file added to Owned."
    }
  ]
}
