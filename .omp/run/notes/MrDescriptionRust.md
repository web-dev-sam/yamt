# MrDescriptionRust

Agent output (`agent://MrDescriptionRust`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionRust.md), collected 2026-11-03T23:57:33.163Z.

{
  "summary": "yamt-merge-requests can read an MR description: one GraphQL call for `descriptionHtml`, parsed by `dom_query` and reduced by an allow-list walk to the Contract's typed tree, nesting capped at 32. Links resolve with `url` to `WebPage::linked` or refused; images become uploaded/web/refused, uploads made only in `address.rs`. `fetch_picture` gets an upload by the uploads API, then its web path on 403/404, up to 10 MiB. Rows carry `hasDescription`. The fake glab gains description and upload routes, plus scenario `mr-description`.",
  "files_changed": [
    "crates/merge-requests/src/description.rs",
    "crates/merge-requests/src/description/html.rs",
    "crates/merge-requests/src/description/address.rs",
    "crates/merge-requests/src/description/element.rs",
    "crates/merge-requests/src/description/tests.rs",
    "crates/merge-requests/src/lib.rs",
    "crates/merge-requests/src/picture.rs",
    "crates/merge-requests/src/picture/tests.rs",
    "crates/merge-requests/src/project.rs",
    "crates/merge-requests/src/query.rs",
    "crates/merge-requests/src/query/tests.rs",
    "crates/merge-requests/src/page.rs",
    "crates/merge-requests/src/page/tests.rs",
    "crates/merge-requests/src/row.rs",
    "crates/merge-requests/src/list.rs",
    "crates/merge-requests/src/web_page.rs",
    "crates/merge-requests/src/job_log.rs",
    "crates/merge-requests/tests/description.rs",
    "crates/merge-requests/tests/list.rs",
    "crates/merge-requests/AGENTS.md",
    "scripts/fake-glab/glab",
    "tests/glab/README.md",
    "tests/glab/mr-description/ (project.json, graphql-page-1.json, graphql-description-48/50/51/52.json, graphql-description-49.err/.exit, uploads/7/uploads/0a1b…/shot.png, pictures/-/project/7/uploads/f9e8…/old.png)"
  ],
  "tests_added": [
    {
      "name": "description::tests walk set (rule 3, code, lazy image, anchor, task boxes, table, details, ol start, runs, empty)",
      "proves": "Each element in the brief becomes its Contract block or inline, using the measured GitLab shapes (!267727 code, !200000 lazy image, !50000 task boxes)."
    },
    {
      "name": "planted_script_style_frame_object_media_and_form_leave_nothing",
      "proves": "RK66: no text, address or attribute from script/style/iframe/object/embed/media/form/svg/noscript/template/title/textarea/select survives (scenario !50)."
    },
    {
      "name": "no_key_but_the_contracts_crosses",
      "proves": "In the planted and rich trees, every serialised key is a Contract field name, and no string holds onerror/onclick/onload/display:none/color:red."
    },
    {
      "name": "a_base_or_meta_element_changes_no_address",
      "proves": "A relative link after <base> or <meta refresh> still resolves on gitlab.example."
    },
    {
      "name": "nesting_past_32_levels_is_left_out",
      "proves": "40 nested quotes give 32 levels; 40 nested <em> give 31; the deepest text is gone and later blocks stay."
    },
    {
      "name": "link tests: an_https_or_http_link_is_a_page, a_relative_link_resolves_…, mailto_file_javascript_…_refused_…",
      "proves": "Rule 4 and RK41: http/https links become pages; /x, x, #frag and sub-path links resolve on the MR page; other schemes and unreadable addresses are refused as written."
    },
    {
      "name": "a_described_page_has_no_space_quote_or_control_character, without_an_https_origin_a_relative_link_is_refused",
      "proves": "RK41: a page holds no space, quote, angle bracket or control character; with no https base, relative links and images are refused."
    },
    {
      "name": "an_upload_on_the_projects_origin_is_uploaded_in_both_path_forms, an_upload_shaped_address_that_breaks_a_rule_is_a_web_image",
      "proves": "Rule 5 and RK53: both path forms, a sub-path and a query give the exact route and web address; 13 look-alike paths do not."
    },
    {
      "name": "an_upload_path_on_another_host_…, http_data_and_file_images_are_refused, an_upload_key_is_never_a_username",
      "proves": "Rule 6 and RK53: other hosts and ports are web images; http/data/file/javascript/empty images are refused; the key is `upload~<secret>`."
    },
    {
      "name": "pages_and_uploads_…_once_each_in_order, glabs_or_gitlabs_failure_…, the_log_names_each_replys_kind_…",
      "proves": "Offers are deduplicated in document order; the fetch replies map as specified; the log's outcome equals the IPC kind."
    },
    {
      "name": "picture::tests upload route, 10 MiB upload limit, 1 MiB avatar limit",
      "proves": "Exact argv for both route forms; only 403/404 fall back to the web path; 10 MiB limit for uploads, 1 MiB for avatars; an avatar is asked once."
    },
    {
      "name": "query/page tests: description query, list query asks description, white space or none is no description",
      "proves": "Exact description argv; the list query asks `description` (not `descriptionHtml`) and stays one line; hasDescription is false for white space, empty, null or missing."
    },
    {
      "name": "tests/description.rs (12 tests on scenario mr-description)",
      "proves": "!52 tree, pages, uploads; A by REST; B by REST 404 then web path; C fails both; no argv names another site; !51 empty; !50 planted; !49, !48 failures; glab missing or logged out; hasDescription; read-only argv."
    }
  ],
  "smoke_evidence": [
    {
      "command": "env -u GIT_CONFIG_PARAMETERS … XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-merge-requests --no-fail-fast",
      "observed": "Summary [2.257s] 234 tests run: 234 passed, 1 skipped"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings ; cargo fmt --all --check ; just arch-check",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.52s / fmt-ok / arch-check: ok"
    },
    {
      "command": "sh -n scripts/fake-glab/glab",
      "observed": "no output, exit 0"
    },
    {
      "command": "cargo run -p yamt-app --features bindings --bin export-bindings -- target/bindings-description.ts && diff -u frontend/src/ipc/bindings.ts target/bindings-description.ts",
      "observed": "Two hunks only: +hasDescription: boolean (doc \"GitLab's description holds more than white space.\") in MergeRequestRow, and the WebPage doc now naming `::linked`."
    },
    {
      "command": "cargo nextest run -p yamt-app -p yamt-gitio --no-fail-fast (hermetic prefix)",
      "observed": "413 tests run: 413 passed, 37 skipped (other users of the fake glab are unaffected)"
    },
    {
      "command": "step 1: glab --version",
      "observed": "glab 1.126.0 ()"
    },
    {
      "command": "step 1: time glab api graphql -f query='query MergeRequestDescription(…){ queryComplexity { score limit } project(…){ mergeRequest(iid){ descriptionHtml } } }' -f fullPath=gitlab-org/gitlab -f iid=200000",
      "observed": "queryComplexity score 10 limit 250 (logged in), real 0m1.014s. HTML matches design §1.1: h2 with an empty a.anchor href=#…; &#x000A; between blocks; td holding a.no-attachment-icon around img with data:gif src and data-src=/-/project/278964/uploads/<hex>/….png; inline code; external link rel=nofollow."
    },
    {
      "command": "step 1: playground list query with `description` (samubr/glab-yamt-playground, first: 100), with and without the field",
      "observed": "With description: score 172 limit 250. Without: 170. All six playground MRs hold \"Made by yamt's scripts/gitlab-playground.sh.\" No uploads, so the private-project upload bullet could not be measured."
    },
    {
      "command": "step 1: glab api projects/278964/uploads/4c42…/Screenshot_2025-08-01_at_4.25.21_pm.png | wc -c ; | head -c 8 | od -An -tx1 ; same on https://gitlab.com/-/project/278964/uploads/…",
      "observed": "REST: 156053 bytes, 89 50 4e 47 0d 0a 1a 0a (PNG), although the user is no member. Web path: 156053, PNG. Missing file: REST says \"glab: 404 Not Found (HTTP 404)\", web path says \"glab: HTTP 404\"."
    },
    {
      "command": "step 1: sizes of !200000's other three uploads",
      "observed": "158111, 62001 and 66498 bytes, all well under 10 MiB."
    },
    {
      "command": "just mutants HEAD",
      "observed": "Found 156 mutants; 156 mutants tested in 8m: 114 caught, 42 unviable."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 156 mutants, 114 caught, 42 unviable, 0 missed (first run: 3 missed, killed by adding the white-space-first task item and the_log_names_each_replys_kind_as_the_window_does)",
    "survivors": []
  },
  "acceptance_not_run": [
    "Step 1's last bullet (both upload routes on a private project) was not measured: no playground merge request holds an upload; their descriptions are plain text."
  ],
  "deviations_from_brief": [
    "UploadKey is defined in description/address.rs and re-exported from description.rs and lib.rs, so the compiler enforces 'only address.rs makes one'. `pub(crate) mod address` lets picture/tests.rs call image_of.",
    "I added module description/element.rs (code language, ol start, heading level, task box, cell align) to keep html.rs at 379 lines. description.rs is still 408 lines (RS6 asks for ≤400); nearly all of it is the Contract's documented IPC types, which the Contract places there.",
    "`Described` gains `web_images: usize` for the required info log. `PictureAddress` now holds a private enum Address { Avatar, Upload { route, web } }, built by the crate-internal `PictureAddress::upload`. `fetch_picture` delegates to `fetched` with an injected getter, as discussions.rs and list.rs do, so the argv is unit-tested. The size error now reads 'larger than {N} MiB'.",
    "Existing constants are now crate-visible so they are reused, not copied: web_page.rs MERGE_REQUESTS_SEGMENT and PARENT_SEGMENT, job_log.rs ESCAPED_SLASH.",
    "MergeRequestRow gets #[expect(clippy::struct_excessive_bools, reason = …)]: hasDescription is its 4th bool and the Contract fixes it as a bool.",
    "Choices the brief left open: `div` ends an inline run, like a block; a `summary` outside `details` gives nothing; the task box is the item's first element or non-blank text, or its first <p>'s (loose list); a link with only white-space content is dropped; an upload secret must be lowercase hex in both forms; an empty or blank img address is Refused with an empty caption.",
    "The REST route for the project-path upload form uses the web path seen in the MR page, which includes a sub-path. On a GitLab installed under a sub-path that route gets 404, and the web-path fallback serves the image.",
    "crates/merge-requests/AGENTS.md: I added a description paragraph and a short 'what changes above' paragraph instead of rewriting the very long first paragraph. Its old clauses about WebPage's makers, PictureAddress's only maker and the 170 score are now outdated; the docs keeper may fold them in.",
    "Docs keeper, outside my globs: tree.md needs description.rs, description/{html,address,element,tests}.rs and tests/description.rs; architecture §3.9 needs the opener's 4th maker WebPage::linked, MAX_UPLOAD_BYTES and list score 172; plan rows #171–#174 and RK41/RK53/RK66 can cite the tests named above."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/description/element.rs:44-49",
      "risk": "The loose task-list shape (<li><p><input class=task-list-item-checkbox>…) is [INFERENCE] from GitLab's renderer; only the tight shape (!50000) was measured."
    },
    {
      "location": "crates/merge-requests/src/description/address.rs:101-109",
      "risk": "For the older `<project web path>/uploads/…` form on a sub-path install, the REST route includes the sub-path and gets 404, so loading always takes the fallback; private projects that require authentication for media then show the caption."
    },
    {
      "location": "crates/merge-requests/src/description/html.rs:186-206",
      "risk": "Each image or link inside a link is lifted after it, and a nested <a> gives only its content. Unusual raw-HTML link nesting renders flatter than GitLab shows it."
    },
    {
      "location": "crates/merge-requests/src/description.rs",
      "risk": "408 lines, over RS6's 400; a reviewer may ask to move the reading half (fetch_description, html_of, answer structs) into a child module, which would change the Contract's placement."
    }
  ]
}
