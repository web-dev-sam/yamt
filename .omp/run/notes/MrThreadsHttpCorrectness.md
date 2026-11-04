# MrThreadsHttpCorrectness

Agent output (`agent://MrThreadsHttpCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsHttpCorrectness.md), collected 2026-11-04T11:55:15.379Z.

{
  "verdict": "pass",
  "checked": [
    "Parse unchanged from old http_answer_from (HTTP/ prefix, u16, body after first CRLFCRLF, else empty). posted keeps every Outcome; reason() keeps message>stderr line>HTTP code.",
    "Tests bite: body with an inner CRLFCRLF catches last-split and missing +len; is_success checked at 199/200/299/300; send test needs headers stripped and the stdin log, so it fails if send is deleted or drops the body.",
    "Every case of the deleted error_message_from test is now in gitio's reason/json-text tests (string, object, null->error, error only, Bad Gateway, {}), plus a non-string error.",
    "RK33: send.rs tests and send_queue untouched; send.rs:176 posts the same args and body; post_draft_note keeps --include (gitlab.rs:82-91); old names gone from crates/ and src-tauri.",
    "VF7: 25 mutants, 20 caught, 5 unviable, 0 kept; nothing to check against (a)/(b)/(c). Deviations accepted: the sent wrapper; the literal no-answer text in the review test (const kept private).",
    "Open risk accepted: send's --include precondition is in the fixed contract, and the fake glab prints headers only with --include (tests/glab/README.md:68), so caller tests catch a miss. No tests run."
  ],
  "findings": []
}
