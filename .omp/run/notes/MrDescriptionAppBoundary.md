# MrDescriptionAppBoundary

Agent output (`agent://MrDescriptionAppBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionAppBoundary.md), collected 2026-11-04T00:18:03.764Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: every changed file is Owned. The tests.rs helpers made pub(super) (open, opened_log, log_after) and the command placed in description.rs (RS6: merge_requests.rs is 390 of 400 lines) are declared deviations; both accepted.",
    "Contract: read_description is registered after change_people (commands.rs:88) with the brief's signature; offer_uploads matches; the scheme doc (pictures.rs:11-12) names both kinds; CSP img-src matches in both strings, nothing else changed.",
    "Skipping the 32-hex re-check is accepted: the offered map takes exact names only, so an unoffered `upload~…` gets 404 before any glab run (turn's `?`). Uploads share turn, done, PICTURE_FETCHES and fetched (pictures.rs:67-104).",
    "Edges: description.rs imports only super (MergeRequestState, NO_PROJECT, offered), crate::ipc_error and yamt_merge_requests, so no new crate edge (PM1). The pictures shelf lock is never held across glab runs and never with `pages`.",
    "Comments: INLINE_KEYWORD_END's reason is real (arch-check.sh:107 runs `grep -w 'unsafe'`). The macOS opener note cites web_page.rs (CP1). Accepted the open_page doc left stale on purpose to keep the bindings diff exact (declared).",
    "Accepted open_risks: `https:` in img-src (design option A, RK66) and the UploadKey invariant (address.rs is its only maker)."
  ],
  "findings": [
    {
      "file": "src-tauri/src/merge_requests/description.rs",
      "line": 20,
      "severity": "block",
      "rule_id": "PM-state",
      "problem": "description_reply writes `pages` and the picture shelf itself (`offered(&state.pages).extend` and then `offer_uploads`) and does not go through `offer`. That is a second writer of `pages` and a second copy of the never-lock-both rule. state.md row 65 says `pages` is written only through `offer`, and the Contract and design §148 both name `offer`.",
      "fix": "Put a sibling of `offer` in merge_requests.rs, e.g. `offer_described(state, pages, uploads)`, that locks pages and then calls `offer_uploads` (or let `offer` take the uploads too). Call it from description_reply and drop the `offered` import."
    },
    {
      "file": "src-tauri/src/merge_requests/pictures.rs",
      "line": 20,
      "severity": "should",
      "rule_id": "vision-2",
      "problem": "UPLOAD_KEY_PREFIX repeats the crate's private `\"upload~\"` (crates/merge-requests/src/description/address.rs:15). If the crate renames the prefix, the shell's filter returns 404 for every upload. The prefix test adds nothing, because `turn` already serves only exact offered names.",
      "fix": "Remove UPLOAD_KEY_PREFIX and is_picture_name's prefix arm and leave the offered-map lookup in `turn` as the only gate, or have the crate expose an `UploadKey::is_key`/prefix and use that."
    },
    {
      "file": "src-tauri/src/merge_requests/tests/description.rs",
      "line": 38,
      "severity": "should",
      "problem": "`asked` and `is_not_found` are copied word for word from tests/picture_scheme.rs:35-42, so the next picture test file will copy them a third time.",
      "fix": "Move `asked` and `is_not_found` next to `invoke` in tests.rs (or make picture_scheme's pub(super)) and import them in both test files."
    },
    {
      "file": "src-tauri/src/merge_requests/tests/picture_scheme.rs",
      "line": 140,
      "severity": "should",
      "problem": "The mixed test passes an absolute temp path as `scenario`. That works only because `Path::join` replaces the base with an absolute path, and run_with_fakes' doc (tests.rs:227) still says the scenario is `tests/glab/<scenario>`. A reader who trusts the doc misreads the test, and refactoring the join breaks it silently.",
      "fix": "Add a `run_with_fakes_in(test, scenario: &Path)` that run_with_fakes calls with `tests/glab/<scenario>`, and call it from the mixed test, or at least update run_with_fakes' doc to say it accepts an absolute path."
    },
    {
      "file": ".omp/run/notes/MrDescriptionApp.md",
      "line": 1,
      "severity": "should",
      "rule_id": "PM6",
      "problem": "The docs-keeper list in deviations_from_brief names tree.md and architecture but not state.md rows 65 (`pages` writers: add description_reply) and 67 (`offered` written by `offer_uploads` too, keyed by username or upload key). Those rows would stay wrong after the feature closes.",
      "fix": "Add state.md rows 65 and 67, with the writers above, to the docs-keeper lines in deviations_from_brief."
    }
  ]
}
