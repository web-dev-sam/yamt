# MrThreadsFixturesCorrectness

Agent output (`agent://MrThreadsFixturesCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsFixturesCorrectness.md), collected 2026-11-04T12:42:40.407Z.

{
  "verdict": "fail",
  "checked": [
    "Routes glab:269-278: 3 writes post→respond (no redirect), markdown via reply (not counted), per-iid drafts fall back to draft-notes.json. Ran fake, state=1: batch d01 ends \"Thanks\" (88); markdown 201, state kept",
    "jq: 90 and 91-90 nodes equal for base and k=1,3,4,5; only d01 changes (d05 too at k=5); resolve moves lastEditedAt of unedited notes only; drafts stay after-post-2 for posts 3-4, [] at 5; posts 201/201/200/200/204",
    "mr-threads: 40-hex ids; d01-d16 authors/mentions/system notes match the case table; !91 locked, d14 resolveNote false; scores 46/88; notes oldest first; 39 unique urls on own MR; refused copies byte-equal",
    "mr-discussions/mr-review-mode: all new fields present, only 19 pageInfo{hasPreviousPage} lines removed; description-54: 9 sized lazy images, distinct alts; refused post-1..4 and markdown status/err/exit match brief",
    "Accepted: empty post-5.json (204); jq replaces grep -c after; data-author=4; refused drafts copy; hasNextPage only in new files. No Rust/TS change, so the survivors 'no mutation run' line is right"
  ],
  "findings": [
    {
      "file": "tests/glab/mr-threads/graphql-discussions-90.json",
      "line": 64,
      "severity": "block",
      "rule_id": "RK53",
      "problem": "d01's upload `/uploads/-/system/note/attachment/903/shot.png` on https://gitlab.example is a Web image: `upload_of` (description/address.rs:123-145) offers only gitlab.com `/-/project/<id>/uploads/<32hex>/` paths. So mr-threads-app.md:90-92's RK53 check (upload served by the picture scheme) cannot pass, and pictures/…/903/shot.png is dead.",
      "fix": "Orchestrator amends the brief: put mr-threads on https://gitlab.com (project.json, note urls) with data-src `/-/project/7/uploads/<32 hex>/shot.png` served from `uploads/7/uploads/<hex>/shot.png`, or move the RK53 thread proof to a gitlab.com scenario; drop the dead pictures file."
    },
    {
      "file": "scripts/fake-glab/glab",
      "line": 108,
      "severity": "should",
      "problem": "An empty state file (the brief's `S=$(mktemp)`) makes reply() print `[: : integer expected` on stderr on every read (ran it on a draft_notes read), while post() treats empty as 0. As the app grows, a harness that pre-creates the state file gets a stray line inside glab's failure words, which Rust reads.",
      "fix": "Default an empty count to 0 before the loop (`posts=${posts:-0}`), as post()'s arithmetic already does."
    }
  ]
}
