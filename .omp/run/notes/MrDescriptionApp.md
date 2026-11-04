# MrDescriptionApp

Agent output (`agent://MrDescriptionApp`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionApp.md), collected 2026-11-04T00:14:32.687Z.

{
  "summary": "The `read_description` command exists now (`merge_requests/description.rs`). Before it replies, it offers the description's pages to `open_page`, then its uploads to the picture shelf, taking one lock at a time. The picture scheme also serves `/upload~<key>` for offered uploads. These share the avatars' 4-fetch limit and once-per-run shelf, and any other name gets 404 with no glab run. CSP `img-src` is now `'self' data: yamt-picture: http://yamt-picture.localhost https:` in both strings. Every acceptance item has a named test.",
  "files_changed": [
    "src-tauri/src/merge_requests.rs",
    "src-tauri/src/merge_requests/description.rs",
    "src-tauri/src/merge_requests/pictures.rs",
    "src-tauri/src/merge_requests/tests.rs",
    "src-tauri/src/merge_requests/tests/description.rs",
    "src-tauri/src/merge_requests/tests/csp.rs",
    "src-tauri/src/merge_requests/tests/picture_scheme.rs",
    "src-tauri/src/commands.rs",
    "src-tauri/tauri.conf.json"
  ],
  "tests_added": [
    {
      "name": "description::a_described_page_is_offered_before_the_reply",
      "proves": "RK41/rule 4: docs.example/x, the resolved issues/12 page and http://plain.example/ answer notOffered before !52 is read; afterwards open_page answers opened and the fake xdg-open logs each one in order."
    },
    {
      "name": "description::an_address_no_reply_named_is_not_offered",
      "proves": "RK41: after reading !52, mailto:, javascript: and https://evil.example/ answer notOffered, and the opener log stays empty."
    },
    {
      "name": "description::an_upload_is_offered_before_the_reply_and_served",
      "proves": "Rule 5/RK53: /upload~<A> is 404 before the read. After it, the answer is shot.png's bytes with image/png and nosniff, and the last argv is `api projects/7/uploads/<A>/shot.png`."
    },
    {
      "name": "description::an_upload_the_api_does_not_know_is_served_from_its_web_path",
      "proves": "Upload B is served as old.png; the last two argv lines are the REST route, then the web path."
    },
    {
      "name": "description::an_upload_no_reply_offered_gets_404_and_runs_no_glab",
      "proves": "RK53: an unoffered upload~<32 hex>, upload~xyz, upload~<A>/../x, uppercase hex and a path without the leading slash all give an empty 404, with no new argv line."
    },
    {
      "name": "description::another_sites_image_is_never_fetched",
      "proves": "Rule 6: the reply's uploaded keys are exactly A, B, C; after asking each, no argv names images.example or evil.example."
    },
    {
      "name": "description::no_gitlab_project_fails_the_read",
      "proves": "A repo with no GitLab remote gives {kind: failed, message: NO_PROJECT}."
    },
    {
      "name": "description::read_description_answers_through_the_command",
      "proves": "Through invoke: !52 is kind read, its first block is a heading, and the reply equals description_reply's; !51 is {kind: read, description: {blocks: []}}."
    },
    {
      "name": "picture_scheme::an_avatar_and_an_upload_share_the_four_fetches_at_once",
      "proves": "6 slow avatars plus 3 slow uploads, all asked at once: at most 4 glab picture runs are under way at any time, and all 11 runs end."
    },
    {
      "name": "csp::the_csp_admits_the_scheme_and_any_https_image_only",
      "proves": "img-src in both csp and devCsp is exactly ['self', data:, yamt-picture:, http://yamt-picture.localhost, https:], and there is only one img-src."
    },
    {
      "name": "csp::the_csp_loads_scripts_frames_media_and_fonts_from_the_app_only",
      "proves": "RK66: default-src and font-src are 'self'; there is no script-src, frame-src, child-src, media-src, object-src or form-action; only style-src holds the inline keyword."
    }
  ],
  "smoke_evidence": [
    {
      "command": "<hermetic prefix> cargo nextest run -p yamt-app merge_requests --no-fail-fast",
      "observed": "All 11 tests above PASS. Summary [6.354s] 37 tests run: 37 passed, 205 skipped. The whole crate (-p yamt-app): 210 tests run: 210 passed, 32 skipped."
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings ; cargo fmt --all --check ; just arch-check",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 4.18s / fmt-ok / arch-check: ok"
    },
    {
      "command": "cargo run -p yamt-app --features bindings --bin export-bindings -- target/bindings-description.ts; diff -u frontend/src/ipc/bindings.ts target/bindings-description.ts",
      "observed": "Added: readDescription: (iid: MergeRequestIid) => typedError<DescriptionReply, IpcError>; types CellAlign, Description, DescriptionBlock/Cell/Image/Inline/Item/Link/Reply/Row, HeadingLevel, ListNumbering, TaskBox, UploadKey; MergeRequestRow hasDescription: boolean. The only other change is the rust slice's WebPage doc. No openPage change."
    },
    {
      "command": "scripts/local-conflicts-repo.sh /tmp/mrd-smoke-mpv; cargo tauri build --debug --no-bundle; just app-session start-app --name mpd --diff --dir /tmp/mrd-smoke-mpv --glab mr-description",
      "observed": "Built application at: target/debug/yamt; the session started on display :3 with the glab log at <session>/glab/calls.log"
    },
    {
      "command": "WebDriver execute: await window.__TAURI_INTERNALS__.invoke(\"read_description\", { iid: 52 })",
      "observed": "{\"kind\":\"read\",\"blocks\":17,\"kinds\":[\"heading\",\"heading\",\"heading\",\"paragraph\",\"code\",\"code\",\"code\",\"paragraph\",\"list\",\"list\",\"list\",\"table\",\"quote\",\"rule\",\"details\",\"paragraph\",\"paragraph\"]}"
    },
    {
      "command": "WebDriver execute: new Image(), src = yamt-picture://localhost/upload~0a1b2c3d4e5f60718293a4b5c6d7e8f9, await i.decode(); then fetch(i.src)",
      "observed": "{\"naturalWidth\":32,\"naturalHeight\":32,\"refused\":\"fetch refused: TypeError: Load failed\"}"
    },
    {
      "command": "grep ^argv <session>/glab/calls.log",
      "observed": "argv: auth status | argv: api projects/:fullpath | argv: api graphql -f query=query MergeRequestDescription(...) -f fullPath=taskboard/taskboard -f iid=52 | argv: api projects/7/uploads/0a1b2c3d4e5f60718293a4b5c6d7e8f9/shot.png"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 22 mutants; 22 mutants tested in 4m: 8 caught, 14 unviable, 0 missed (no TypeScript changes)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The read_description command is in merge_requests/description.rs, as the Contract's code block places it; in merge_requests.rs that file would be 406 lines (RS6: 400), now 390. So `mod description` is pub(crate) and commands.rs registers `merge_requests::description::read_description::<tauri::Wry>`. The generated TS is unchanged.",
    "The picture scheme serves a name only if it is a username or starts with `upload~`, and only if it was offered. It does not re-check the 32-lowercase-hex form: the crate's UploadKey (made only in address.rs) guarantees it, and its rule is private.",
    "tests.rs: besides the mod list, through_glab's `open`, `opened_log` and `log_after` became pub(super) so tests/description.rs can use them.",
    "picture_scheme.rs: FETCH_END is now \"answered: \" (uploads log `answered: projects/…`); shared helpers ask_at_once and fetches_at_once. tests/glab is read-only, so the mixed test builds a temp scenario: symlinks to crowd's and mr-description's files plus 1 s .sleep files for the three uploads.",
    "pictures.rs: the warn text is now \"a picture was not fetched\" instead of \"a profile picture …\", because uploads use the same path.",
    "open_page's doc still says \"a list of this window sent it\" (stale since discussions). I left it so the bindings diff stays exactly what the brief lists. Docs keeper: change it to \"a reply\" in the next bindings run.",
    "Docs keeper: tree.md needs src-tauri/src/merge_requests/description.rs and tests/description.rs. architecture §3.5 needs read_description and the new img-src. RK41/RK53/RK66 can cite the tests above. Plan #172/#173 can cite the csp tests.",
    "The smoke steps 2–4 ran before the command moved into description.rs. The command name and behaviour did not change: the invoke test and the bindings diff pass after the move."
  ],
  "open_risks": [
    {
      "location": "src-tauri/tauri.conf.json:14-15",
      "risk": "`img-src https:` lets a description load an image from any https host, which can leak the viewer's IP or act as a tracking pixel. Design option A accepts this; scripts, frames and connect-src stay app-only."
    },
    {
      "location": "src-tauri/src/merge_requests/pictures.rs:145-148",
      "risk": "The upload name check relies on the crate's UploadKey invariant. A future second maker of OfferedUpload with an unchecked key would be served without a secret check here."
    }
  ]
}
