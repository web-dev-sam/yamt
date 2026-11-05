# MrPersonDiscussionsRustCorrectness

Agent output (`agent://MrPersonDiscussionsRustCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsRustCorrectness.md), collected 2026-11-05T13:43:00.446Z.

{
  "verdict": "pass",
  "checked": [
    "open_discussion (turn.rs:46-90): starter is earlier[0], else last; time kept as sent; bodyHtml goes through described_on (RK60/RK66); offers gets last.page, then the starter's pages and uploads. System notes already dropped (RK61).",
    "Tests fail without the feature: single-note test checks open[0].first = anna's note, not last; reducer test needs images.example kept; Offers test checks dedupe and order; shell tests pin every first and the upload's 404 then 200.",
    "Thread read: comments_of and open_discussion share one Offers, so describing the starter twice adds no offer. The pages/uploads expected values in thread tests.rs:418 are unchanged.",
    "Shell discussions_reply offers read.pages and the pictures, then offer_uploads, all after glab returns (RK41/RK53). Log line pages=5 uploads=1 (103,104,201,303 + issue 12) matches the fixture.",
    "Deviations accepted: fixture on gitlab.com since RK53 offers uploads only there (as mr-description); 2 graphql calls = batch + !79's d-2 page; mr-review-mode README line and docs go to the docs keeper.",
    "Survivor log_read→() is valid VF7 (b), gate-covered: yamt-app a_read_logs_its_counts_and_score_but_no_name_or_body kills it. Committed bindings.ts adds only FirstComment and OpenDiscussion.first. No tests run."
  ],
  "findings": []
}
