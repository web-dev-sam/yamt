# MrDescriptionRustR2Correct

Agent output (`agent://MrDescriptionRustR2Correct`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionRustR2Correct.md), collected 2026-11-04T00:27:23.410Z.

{
  "verdict": "pass",
  "checked": [
    "#2280: upload_of offers an upload only if base origin is exactly https://gitlab.com and the URL shares it. PictureAddress::upload (pub(crate)) has no other caller. Self-managed uploads become Web{absolute}.",
    "#2280 tests fail if the gate is removed: the unit self-managed test (Web, no OfferedUpload) and the integration test (uploads empty, no /uploads/ argv). Inverting the gate breaks the gitlab.com tests; :8443 pins the origin check.",
    "#2278: fetched falls back only on '(HTTP 403)'/'(HTTP 404)'. The redirect test would fail if a 3xx were retried: 2222's web path holds a PNG and exactly 3 routes are answered. It still runs after R2 (scenario now on gitlab.com).",
    "is_key uses the same rule as the maker (UPLOAD_KEY_PREFIX + is_secret, address.rs:31 vs :142). The test rejects 31/33 digits, uppercase, no prefix, no '~', a username and 'upload~'. Shell adoption (#2282) is the app slice's job.",
    "Accepted R2 deviation: project_of drops [<segments>] (dead when only gitlab.com is fetched); the gitlab.com sub-path form is pinned as web. Nested scenario self-managed/ works as is; RK53 and the plan row are for the docs keeper.",
    "Mutation: R1 4 mutants (3 caught, 1 unviable), R2 11 mutants (10 caught, 1 unviable); 0 survivors kept, so no VF7 check needed. I ran no test; no block depended on one."
  ],
  "findings": []
}
