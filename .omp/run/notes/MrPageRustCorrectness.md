# MrPageRustCorrectness

Agent output (`agent://MrPageRustCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T19-31-04-168Z_01a18e4b-5568-7113-b48d-cb43e7b9c05a/MrPageRustCorrectness.md), collected 2026-10-30T19:47:51.263Z.

{
  "verdict": "fail",
  "checked": [
    "Address rule (RK41): project_page holds the one https+authority and full-path check for both kinds; WebPage::job rebuilds origin+web_path byte-for-byte as before; ok/refused cases are pinned in web_page.rs tests 157-207",
    "Recorded before sent: forward_page adds every row.page and failed job page under the lock, then sends; it is the only row sender. The app test fails without row recording or the NotOffered guard",
    "A deleted or wrong row page fails tests: snooze_a_reminder compares the whole row incl. page (page/tests.rs:52); the no-origin test asserts every row.page is None; tests/list.rs:68 checks it via fake glab",
    "Rename is clean: no JobPage/JobOpened/open_job_page/job_pages in crates, src-tauri, scripts or tests; commands.rs registers open_page; both AGENTS.md files name the new types; the bindings diff matches the contract",
    "Accepted: bindings.ts in 4389bbb leaves the frontend failing to type-check until MrPageWeb (planned in the brief); old docs belong to the docs keeper; RK41 already names the new tests",
    "Survivor web_page.rs:95: it would not compile on Windows (Command has no Default). Its reason names a CI test kill; see the nit. Mutation evidence otherwise present: 49 mutants, 27 caught, 21 unviable. No test file run"
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/page.rs",
      "line": 163,
      "severity": "block",
      "rule_id": "plan-137",
      "problem": "Some GitLab servers are installed under a sub-path (https://host/gitlab). There a row's page is built as https://host/<path_with_namespace>/-/merge_requests/N, which drops /gitlab and 404s, while job pages from GraphQL webPath keep /gitlab and open. So in one list the row is a broken link and its CI job links work.",
      "fix": "In project.rs keep the project's web path (web_url minus web_origin, e.g. gitlab/grp/proj) next to full_path and pass it to WebPage::merge_request; add a project.rs test with a /gitlab web_url."
    },
    {
      "file": ".omp/run/mutants/MrPageRust.survivors.txt",
      "line": 2,
      "severity": "nit",
      "rule_id": "VF7",
      "problem": "The kept reason says Windows CI's windows_opens_a_page_with_the_url_protocol_handler kills `opener -> Default::default()`. That is false: std::process::Command has no Default, so on Windows the mutant does not compile. On Linux the cfg(windows) function is not built, so it is (a) equivalent. Nothing gets harder.",
      "fix": "Record it as (a) equivalent: cfg(windows) code that is not compiled on this host, and unviable where it is compiled."
    }
  ]
}
