# MrDescriptionRustR1

Agent output (`agent://MrDescriptionRustR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionRustR1.md), collected 2026-11-04T00:15:57.878Z.

{
  "summary": "Fixed #2274–#2278. page.rs holds one FORBIDDEN/NOT_FOUND pair, used by job_log.rs and picture.rs. ESCAPED_SLASH is in web_page.rs. The link, image and offered-upload types moved to description/address.rs and are re-exported; description.rs is 365 lines. AGENTS.md line 1 was edited in place, errata deleted. RK53: gitlab.com answers 200 on both upload routes, no redirect. A 3xx is refused and never retried, pinned through the fake glab (!53).",
  "files_changed": [
    "crates/merge-requests/src/page.rs",
    "crates/merge-requests/src/job_log.rs",
    "crates/merge-requests/src/web_page.rs",
    "crates/merge-requests/src/picture.rs",
    "crates/merge-requests/src/description.rs",
    "crates/merge-requests/src/description/address.rs",
    "crates/merge-requests/src/description/tests.rs",
    "crates/merge-requests/tests/description.rs",
    "crates/merge-requests/AGENTS.md",
    "scripts/fake-glab/glab",
    "tests/glab/README.md",
    "tests/glab/mr-description/graphql-description-53.json",
    "tests/glab/mr-description/uploads/7/uploads/2222cccc3333dddd4444eeee5555ffff/moved.png.status",
    "tests/glab/mr-description/pictures/-/project/7/uploads/2222cccc3333dddd4444eeee5555ffff/moved.png",
    "tests/glab/mr-description/pictures/-/project/7/uploads/6666aaaa7777bbbb8888cccc9999dddd/moved.png",
    "tests/glab/mr-description/pictures/-/project/7/uploads/6666aaaa7777bbbb8888cccc9999dddd/moved.png.status"
  ],
  "tests_added": [
    {
      "name": "tests/description.rs a_redirect_on_either_route_is_refused_and_never_retried",
      "proves": "In !53, an API 302 (its web path holds a PNG) and an API 404 followed by a web 302 both give Err(\"glab: HTTP 302\"). Only those 3 routes are asked, so a 3xx never triggers the other route."
    }
  ],
  "smoke_evidence": [
    {
      "command": "glab api --include projects/278964/uploads/4c42842bb87d2c84d498a2c3c6cf4adb/Screenshot_2025-08-01_at_4.25.21_pm.png (cwd ../glab-yamt-playground, glab 1.126.0)",
      "observed": "HTTP/2.0 200 OK, Content-Length: 156053, Gitlab-Lb: haproxy-main-39-lb-gprd, Gitlab-Sv: gke-cny-api, Ratelimit-*, X-Goog-Hash/X-Goog-Stored-Content-Length: 156053. GitLab itself proxies object storage; no redirect."
    },
    {
      "command": "glab api --include https://gitlab.com/-/project/278964/uploads/4c42…/Screenshot_2025-08-01_at_4.25.21_pm.png",
      "observed": "HTTP/2.0 200 OK, Content-Disposition: inline; filename=\"Screenshot_2025-08-01_at_4.25.21_pm.png\", Content-Length: 156053"
    },
    {
      "command": "curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' on both upload URLs (no follow, logged out)",
      "observed": "200 (web path) and 200 (api/v4 route). Neither redirects."
    },
    {
      "command": "curl -w '%{http_code} %{redirect_url}' https://gitlab.com/gitlab-org/gitlab.git ; glab api --include https://gitlab.com/gitlab-org/gitlab.git",
      "observed": "curl: 302 → https://gitlab.com/gitlab-org/gitlab. glab: HTTP/2.0 200 OK, so glab follows a GET's redirect silently. Source v1.126.0 internal/api/redirect.go only refuses method-changing redirects; api.go: StatusCode > 299 → 'glab: HTTP %d'."
    },
    {
      "command": "env -u GIT_CONFIG_PARAMETERS XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-merge-requests --no-fail-fast",
      "observed": "Summary [2.269s] 235 tests run: 235 passed, 1 skipped"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings ; cargo fmt --all --check ; just arch-check ; sh -n scripts/fake-glab/glab",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 47.17s / fmt-ok / arch-check: ok / sh-ok (no output from sh -n)"
    },
    {
      "command": "cargo run -p yamt-app --features bindings --bin export-bindings -- target/bindings-description.ts && diff -u frontend/src/ipc/bindings.ts target/bindings-description.ts",
      "observed": "Only round 1's two hunks: +hasDescription: boolean in MergeRequestRow, and the WebPage doc naming ::linked. The bindings.ts at HEAD predates round 1, so the export is the same as round 1's."
    },
    {
      "command": "wc -l crates/merge-requests/src/description.rs crates/merge-requests/src/description/address.rs",
      "observed": "365 description.rs, 160 address.rs"
    },
    {
      "command": "just mutants HEAD",
      "observed": "Found 4 mutants to test; 4 mutants tested in 30s: 3 caught, 1 unviable; mutants: no TypeScript changes since HEAD"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 4 mutants, 3 caught, 1 unviable, 0 missed",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "#2278: glab follows a GET's redirect itself (measured), so yamt can only ever see a 3xx glab did not follow. That arrives as Err 'glab: HTTP 3xx' and was already refused without a fallback. No fetch logic changed. The new test pins it, and the comment at picture.rs fetched cites both measurements.",
    "Fake glab: `answer` now treats a 3xx as glab 1.126.0 does (stderr 'glab: HTTP <code>', exit 1; before it exited 0). `serve_file` answers a `<file>.status` status with no body. Scenario mr-description gains !53's description and its .status files. The README documents all of it. No other scenario uses a 3xx.",
    "picture.rs REFUSED_ENDINGS is now [FORBIDDEN, NOT_FOUND] from page.rs; job_log's NOT_FOUND doc moved to page.rs.",
    "Docs keeper, outside my globs: RK53 needs the redirect question and the open risk below; tree.md needs no new file."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/picture.rs:207-209",
      "risk": "[INFERENCE] Self-managed GitLab with object storage and proxy_download off may 302 both upload routes to presigned storage. glab follows and Go keeps PRIVATE-TOKEN across hosts (only Authorization is dropped), so a PAT could leak. glab has no no-follow flag; RK53 needs a decision."
    },
    {
      "location": "scripts/fake-glab/glab:75-81",
      "risk": "The 3xx stderr text 'glab: HTTP <code>' comes from reading glab's api.go source, not from a measured non-followed 3xx."
    }
  ]
}
