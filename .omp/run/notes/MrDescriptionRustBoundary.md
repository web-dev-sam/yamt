# MrDescriptionRustBoundary

Agent output (`agent://MrDescriptionRustBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionRustBoundary.md), collected 2026-11-04T00:01:41.136Z.

{
  "verdict": "fail",
  "checked": [
    "Contract matches the brief: derives, serde tags (HeadingLevel lowercase), UploadKey Ord+as_str, MAX_NESTING, described/link_of/image_of/linked signatures. Accepted: UploadKey in address.rs, web_images, element.rs",
    "PM1 holds: description/* import only url, dom_query and yamt_gitio::Glab, with no tauri. fetched's injected `Get` follows discussions.rs `Fetch`/list.rs; outcome() follows the job_log/people_search/rerequest pattern",
    "Reused, not copied: NO_PROJECT, NO_MERGE_REQUEST, graphql_data, merge_request_args, logged_in_project, From<NoProject> (as people_search.rs/rerequest.rs), MERGE_REQUESTS_SEGMENT, PARENT_SEGMENT, is_web_path, is_number",
    "List: Node.description only folds into has_description (page.rs:213), and the text goes nowhere else. The struct_excessive_bools expect is accepted because the Contract fixes a bool. The list query's comment score is updated to 172",
    "Fake glab: the description route sits before the iid route; reply and serve_file exit. The upload route uses serve_file. The comment above graphql(), the README table and the scenario paragraph match the brief",
    "Risks accepted: sub-path REST route for old `<project>/uploads/` form (address.rs:101) only on pre-17.4 servers, which lack the uploads API, so the web fallback serves. Loose task-list shape is [INFERENCE]"
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/picture.rs",
      "line": 16,
      "severity": "block",
      "rule_id": "vision-2",
      "problem": "REFUSED_ENDINGS copies the fact behind job_log.rs:13 NOT_FOUND (\"(HTTP 404)\") instead of sharing it: glab's error line ends `(HTTP <code>)`, cited to the same tests/glab/README.md. The two modules now each own a copy, and a third REST caller would make a third.",
      "fix": "Keep one crate-visible pair NOT_FOUND/FORBIDDEN next to the other glab-answer facts (e.g. page.rs). Use it in both job_log.rs and picture.rs (REFUSED_ENDINGS = [FORBIDDEN, NOT_FOUND]), as the patch already did for ESCAPED_SLASH."
    },
    {
      "file": "crates/merge-requests/AGENTS.md",
      "line": 11,
      "severity": "should",
      "problem": "Line 1 of this owned file still says `avatar_source` is the only maker of PictureAddress, WebPage has three makers and fetch_picture stops at 1 MiB, while line 11 corrects them as an errata note. The file now contradicts itself, and every later agent reads both claims.",
      "fix": "Edit those clauses in line 1 in place (makers of WebPage and PictureAddress, the per-kind limit, the score of 172) and delete the 'What the description changes above' paragraph."
    },
    {
      "file": "crates/merge-requests/src/description.rs",
      "line": 1,
      "severity": "should",
      "rule_id": "RS6",
      "problem": "The file is 408 lines, over RS6's 400, and holds two jobs: the IPC tree and the reading. Each later field or variant pushes it further over the limit, and the clippy detector does not count file length.",
      "fix": "Move DescriptionLink, DescriptionImage and OfferedUpload into description/address.rs, their only maker, next to UploadKey. Re-export them from description.rs as UploadKey already is, so public paths and the bindings stay the same."
    },
    {
      "file": "crates/merge-requests/src/description/address.rs",
      "line": 6,
      "severity": "should",
      "problem": "address.rs imports ESCAPED_SLASH from job_log.rs, so the description depends on the job-log module for a URL-path fact. job_log becomes a home for shared constants with no relation to job logs, which gets harder to see as more callers arrive.",
      "fix": "Move ESCAPED_SLASH to web_page.rs beside MERGE_REQUESTS_SEGMENT and is_web_path, the path rules both callers already import, and import it from there in job_log.rs and address.rs."
    }
  ]
}
