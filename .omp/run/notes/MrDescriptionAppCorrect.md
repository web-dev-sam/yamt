# MrDescriptionAppCorrect

Agent output (`agent://MrDescriptionAppCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionAppCorrect.md), collected 2026-11-04T00:17:52.072Z.

{
  "verdict": "pass",
  "checked": [
    "Offered before reply: description.rs:20-22 offers pages, then uploads (temp guards, never held together), then returns. Tests: described_pages notOffered→opened; an_upload_on_paths_glab 404→PNG+nosniff.",
    "Unoffered never fetched: `turn` exits on `offered.get(name)?` first. unoffered_uploads_on_paths_glab: evil.example's 5555… key, xyz, ../x, uppercase, no slash → 404, argv log unchanged.",
    "Shared limit: uploads use the same turn/done/fetched. If uploads skipped the limit, the mixed test would see 7 runs at once. The fake logs `answered:` on every serve (glab:164-171).",
    "CSP: only img-src changed in both strings. csp.rs asserts exact sources and a single img-src, default/font 'self', six directives absent, inline keyword only in style-src.",
    "Mutants: my `cargo mutants --in-diff --list` gives the same 22. None kept. `is_picture_name -> true` dies on /plus+one (picture_scheme.rs:110); `|| -> &&` dies on the upload test.",
    "Deviations accepted: command in description.rs (RS6), pub(super) helpers, widened FETCH_END, warn text, smoke before the move (the invoke test still covers it). readDescription is at bindings.ts:90."
  ],
  "findings": [
    {
      "file": "src-tauri/src/merge_requests/pictures.rs",
      "line": 146,
      "severity": "should",
      "rule_id": "RK53",
      "problem": "`is_picture_name` accepts any name starting with a copied `\"upload~\"`, not the Contract's `upload~<32 lowercase hex>`. Lists offer GitLab usernames unchecked (see `/plus+one`), so a list name starting `upload~` now skips the username filter. The crate's key format also now lives in two places to keep in step.",
      "fix": "Have `is_picture_name` check the Contract's full shape: `UPLOAD_KEY_PREFIX` followed by exactly 32 `[0-9a-f]`. Say in its doc that the crate's `address.rs::is_secret` is the rule it mirrors."
    }
  ]
}
