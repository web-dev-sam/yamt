# MrDescriptionRustR2

Agent output (`agent://MrDescriptionRustR2`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionRustR2.md), collected 2026-11-04T00:25:19.157Z.

{
  "summary": "Block #2280 is fixed. An upload is now fetched with the login only when the merge request's origin is exactly https://gitlab.com. On any other origin, either upload path form becomes `web { address }` with its absolute https address: no OfferedUpload is made and it counts in web_images. The rule's one comment cites R1's measurement and RK53. As asked mid-round (#2282), `UploadKey::is_key(name)` exists: `upload~` plus the 32 lowercase hex secret, built from the same `is_secret` rule. Bindings are unchanged.",
  "files_changed": [
    "crates/merge-requests/src/description/address.rs",
    "crates/merge-requests/src/description/tests.rs",
    "crates/merge-requests/src/picture/tests.rs",
    "crates/merge-requests/tests/description.rs",
    "crates/merge-requests/AGENTS.md",
    "tests/glab/README.md",
    "tests/glab/mr-description/project.json",
    "tests/glab/mr-description/self-managed/project.json",
    "tests/glab/mr-description/self-managed/graphql-description-52.json"
  ],
  "tests_added": [
    {
      "name": "tests/description.rs an_upload_on_a_self_managed_server_is_a_web_image_never_fetched_with_the_login",
      "proves": "On scenario mr-description/self-managed (origin https://gitlab.example), both upload forms come back as web images with absolute gitlab.example addresses. read.uploads is empty, and no glab argv line names /uploads/."
    },
    {
      "name": "description/tests.rs an_upload_on_a_self_managed_origin_is_a_web_image_with_its_absolute_address",
      "proves": "image_of on a self-managed base and on a sub-path base gives (Web{absolute}, None) for /-/project/ and web-path uploads. described() offers no upload and counts web_images 1."
    },
    {
      "name": "description/tests.rs an_upload_key_is_upload_tilde_and_32_lowercase_hex_digits",
      "proves": "UploadKey::is_key accepts upload~<32 lowercase hex>. It rejects 31 or 33 digits, uppercase hex, no prefix, `upload` without `~`, a username, and `upload~` alone."
    }
  ],
  "smoke_evidence": [
    {
      "command": "env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-merge-requests --no-fail-fast",
      "observed": "PASS an_upload_on_a_self_managed_origin_is_a_web_image_with_its_absolute_address; PASS an_upload_key_is_upload_tilde_and_32_lowercase_hex_digits; PASS yamt-merge-requests::description an_upload_on_a_self_managed_server_is_a_web_image_never_fetched_with_the_login; Summary [2.260s] 238 tests run: 238 passed, 1 skipped"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 42.33s (no warnings)"
    },
    {
      "command": "cargo fmt --all --check; just arch-check; sh -n scripts/fake-glab/glab",
      "observed": "fmt-ok / arch-check: ok / sh-ok (sh -n printed nothing)"
    },
    {
      "command": "cargo run -q -p yamt-app --features bindings --bin export-bindings -- target/bindings-description.ts; diff -u frontend/src/ipc/bindings.ts target/bindings-description.ts",
      "observed": "no diff output, diff-exit=0"
    },
    {
      "command": "just mutants HEAD",
      "observed": "Found 11 mutants to test; 11 mutants tested in 89s: 10 caught, 1 unviable; mutants: no TypeScript changes since HEAD"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 11 mutants: 10 caught, 1 unviable, 0 missed",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "project_of now accepts only `/-/project/<id>`, with no `[<segments>]` prefix. Uploads are offered only on gitlab.com, which has no sub-path install, so that branch was dead. A gitlab.com `/gitlab/-/project/…` upload is now a 'breaks a rule → web' case. The sub-path upload case moved to the self-managed unit test, where it is a web image.",
    "The mr-description scenario's project.json and the integration tests' remote are now on gitlab.com. The self-managed case is a nested scenario, tests/glab/mr-description/self-managed/ (own project.json and graphql-description-52.json), because only tests/glab/mr-description/** is Owned. README documents it.",
    "picture/tests.rs an_upload_is_asked_through_the_uploads_api_route now uses a gitlab.com base, since uploads are only offered there. The file was in Owned crates/merge-requests/** but not named in this round's task.",
    "Added UploadKey::is_key (#2282, Main's mid-round message): an inherent method, so it reaches the shell through the existing UploadKey re-export. No bindings change.",
    "Docs keeper, outside my globs: RK53 and a plan §2 row need the rule. Uploads are fetched with the login only on https://gitlab.com; on a self-managed GitLab they are web images loaded without a login. Report this to the owner (#2280)."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/description/address.rs:127",
      "risk": "The origin is matched exactly ('https://gitlab.com', default port). A gitlab.com project seen through another host name (e.g. www.gitlab.com) would get web images, which are safe but not login-fetched. [INFERENCE] GitLab's web_url is always https://gitlab.com."
    },
    {
      "location": "crates/merge-requests/tests/description.rs:216",
      "risk": "The self-managed integration test reuses the gitlab.com git remote, while the scenario's project.json says gitlab.example. The origin comes from project.json only, so the outcome is unaffected, but the setup is not fully realistic."
    }
  ]
}
