# MrDetectListBoundary

Agent output (`agent://MrDetectListBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrDetectListBoundary.md), collected 2026-10-30T14:01:21.004Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: all touched files are in Owned. Cargo.lock is generated, so it is accepted.",
    "PM1/arch-check: only gitio among the yamt crates; the rule allows range|gitio|merge-core; yamt-app's list adds merge-requests. No yamt-range dependency yet (deviation) is accepted: it would be unused in B1.",
    "§6 B1→B3 API and §2.1 types match in names, visibility, signatures and NotLinedUp's serde/specta attrs (detect, list, project, JobPage, constants, Glab::get/auth_status, remote_urls).",
    "Review cutover has no second copy: TIMED_OUT, the line helpers, exit_words and auth status live only in gitio; the exit_words asserts moved there. Old GETs pass --method GET, so the fake's POST-on-fields changes no scenario.",
    "Comments cite their sources (CP1). AGENTS.md matches range/review. page/tests.rs follows src-tauri's mod tests; pattern. No #[expect] on the env read is accepted: no lint.",
    "Growth: one job per merge-requests file. No state and no Mutex (RS5), so no state.md row in B1. Architecture/map lines are deferred to the docs keeper per the brief."
  ],
  "findings": [
    {
      "file": "crates/gitio/src/names.rs",
      "line": 123,
      "severity": "block",
      "rule_id": "vision-2",
      "problem": "remote_urls copies merge_config.rs's decision on reading `git config -z --get-regexp`: NO_MATCH_STATUS, is_found_or_no_match (exit 1 = none) and the `<key> NL <value> NUL` split loop. Two places now own one git rule, and a fix to either misses the other (implementer's own flag).",
      "fix": "Extract one pub(crate) `Repo::config_entries(regexp) -> Result<Vec<(Vec<u8>, Vec<u8>)>>` used by both merge_config and remote_urls. The orchestrator adds merge_config.rs to Owned for the fix round."
    },
    {
      "file": "crates/gitio/tests/glab.rs",
      "line": 356,
      "severity": "should",
      "rule_id": "RS6",
      "problem": "The file is 414 lines (> 400) because names tests sit in the glab test file under `#![cfg(unix)]`. remote_urls' integration test therefore never runs on the Windows CI (plan §2 #59), and each further names test grows the wrong file.",
      "fix": "Move the branch_names, remote_names and remote_urls tests into a new crates/gitio/tests/names.rs without cfg(unix); the orchestrator widens Owned."
    },
    {
      "file": "crates/merge-requests/src/project.rs",
      "line": 7,
      "severity": "should",
      "problem": "The https-only rule for job pages is written twice, as two `HTTPS` constants: project.rs web_origin and job_page.rs JobPage::built. Changing which origins may get a page means editing both.",
      "fix": "Make job_page.rs's `HTTPS` pub(crate) and import it in project.rs, so the crate has one constant for the scheme."
    },
    {
      "file": "crates/merge-requests/src/page.rs",
      "line": 121,
      "severity": "nit",
      "problem": "`parsed(json, origin)` breaks the `<thing>_from(json)` naming that project_from and review's listed_from/merge_request_from use. Nothing gets harder as the app grows.",
      "fix": "Rename to `page_from`."
    }
  ]
}
