# MrDescriptionRustR2Boundary

Agent output (`agent://MrDescriptionRustR2Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionRustR2Boundary.md), collected 2026-11-04T00:27:59.503Z.

{
  "verdict": "fail",
  "checked": [
    "#2274 fixed: page.rs:22-25 holds the one FORBIDDEN/NOT_FOUND pair, used by job_log.rs:101 and picture.rs:16; no other '(HTTP 40x)' literal remains in the crate's non-test src.",
    "#2275 fixed: AGENTS.md line 1 names image_of beside avatar_source, four WebPage makers, per-kind limits and 172 of 250. The errata paragraph is deleted; line 9 states the gitlab.com rule and is_key.",
    "#2276/#2277 fixed: description.rs is 365 lines and re-exports the moved address types (lib.rs:37-41 same, bindings diff empty per R2). ESCAPED_SLASH is at web_page.rs:6, used by job_log.rs and address.rs.",
    "#2280: upload_of (address.rs:122-128) offers an upload only on exactly https://gitlab.com. It is the only PictureAddress::upload maker and the rule is one constant. Pinned by unit and self-managed integration tests.",
    "#2282: UploadKey::is_key (address.rs:29-33) uses the same UPLOAD_KEY_PREFIX and is_secret that build the key at :142. The test rejects 31/33 digits, uppercase, a missing ~ and a bare prefix. The shell's switch is MrDescriptionApp's.",
    "Deviations accepted: project_of narrowed (no sub-path install on gitlab.com), the nested self-managed scenario sits in Owned, and only !53 has a 3xx .status. The avatar login on self-managed predates #2280's scope."
  ],
  "findings": [
    {
      "file": "tests/glab/mr-description/project.json",
      "line": 1,
      "severity": "block",
      "rule_id": "RV8",
      "problem": "R2 moved this shared scenario to gitlab.com, but the shell tests from 4a538e89 (an ancestor of d7cdeef1) assume gitlab.example. Now failing: described_pages_on_paths_opener (ISSUE_PAGE), a_web_path_upload_on_paths_glab (web-path argv), slow_mixed_names_on_path_s_glab (crowd's gitlab.example project offers no uploads). R2 tested only -p yamt-merge-requests.",
      "fix": "In MrDescriptionApp's fix round, change ISSUE_PAGE and the web-path argv in src-tauri tests/description.rs to gitlab.com. Give crowd_and_description a gitlab.com, id 7 project.json (link mr-description's). Then run nextest -p yamt-app."
    }
  ]
}
