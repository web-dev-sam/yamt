# Slice mr-description-app — the `read_description` command, offers before the reply, uploads through the picture scheme, the CSP

Feature: a merge request's description in a floating panel. Sources:

- Request `docs/slices/request-mr-description.md`: rules 4–7 (the shell's side) and the Rust acceptance.
- Design `docs/slices/briefs/mr-description-design.md` option A, §1.4–§1.6.
- Proposed plan §2 #172, #173; RK41 (rewritten), RK53 (amended), RK66.

Runs in wave 2, after `mr-description-rust` is committed. After this slice lands, the orchestrator runs `just bindings`
and `mr-description-state` starts.

## Target

**Owned:**

- `src-tauri/src/merge_requests.rs`
- `src-tauri/src/merge_requests/description.rs` (new)
- `src-tauri/src/merge_requests/pictures.rs`
- `src-tauri/src/merge_requests/tests.rs` (the `mod` list only)
- `src-tauri/src/merge_requests/tests/description.rs` (new)
- `src-tauri/src/merge_requests/tests/csp.rs`
- `src-tauri/src/merge_requests/tests/picture_scheme.rs`
- `src-tauri/src/commands.rs` (the command list only)
- `src-tauri/tauri.conf.json` (the two CSP strings only)

The people feature splits `merge_requests.rs`. If the commands, `offer` or `MergeRequestState` now live in a sibling
file under `src-tauri/src/merge_requests/`, that file is owned too. Name it in `deviations_from_brief`.

**Read-only:** everything else.

- `crates/merge-requests/**`: use its Contract (`mr-description-rust.md`) as it is.
- `tests/glab/mr-description/**`, `scripts/fake-glab/glab`: the rust slice's; use them.
- `frontend/**`: the bindings come from the orchestrator's `just bindings` (PM4).
- `src-tauri/AGENTS.md` and `docs/**`: lines in `deviations_from_brief`.

**Non-goals:**

- Any window code.
- A webview navigation guard (design row #171, rejected).
- Any CSP change but `img-src`.

## Contract

Given: the crate's `read_description`, `ReadDescription { reply, pages, uploads }`, `OfferedUpload { key, address }`,
`DescriptionReply`, `UploadKey` and `PictureAddress` (`mr-description-rust.md`).

Fixed here (add-only beyond this):

```rust
// merge_requests/description.rs — the shape of merge_requests/discussions.rs (:10-26)
/// No GitLab project → Failed(NO_PROJECT); else `read_description`, its pages offered into `pages` and its uploads
/// into the picture shelf (`offer`, never holding both locks) before the reply is returned.
pub(super) fn description_reply(state: &MergeRequestState, glab: Option<&Glab>, iid: MergeRequestIid)
    -> DescriptionReply;

#[tauri::command]
#[specta::specta]
pub(crate) async fn read_description<R: Runtime>(window: WebviewWindow<R>, iid: MergeRequestIid)
    -> Result<DescriptionReply, IpcError>;   // blocking_reply, as rerequest_review

// merge_requests/pictures.rs
impl Pictures {
    /// Remembers the uploads a description offered, by key; a key's latest address wins.
    pub(crate) fn offer_uploads(&self, uploads: Vec<OfferedUpload>);
}
```

- `offer` (`merge_requests.rs:93-100`) gains the uploads, or a sibling does. Either way the pages, then the pictures,
  are locked one after the other, never together.
- `read_description` is registered in `commands.rs` after `change_people` (`commands.rs:87`). The generated TS is
  `commands.readDescription(iid: MergeRequestIid): Promise<Result<DescriptionReply, IpcError>>`.
- **`picture_answer`** (`pictures.rs:108-127`): the path's name is one of two kinds.
  - `/<username>`, as today (`is_username`).
  - `/upload~<32 lowercase hex>`, an offered upload.
  - Both live in the one `offered` map, keyed by the name (`~` is in no username, `pictures.rs:129-132`).
  - Both share `turn`, `done`, the `PICTURE_FETCHES` 4 limit, the once-per-run `fetched` shelf and `fetch_picture`.
  - Anything else, or a name not offered, → 404 with an empty body, and no glab run.
- The scheme's doc (`pictures.rs:11`) names both kinds of path.
- **CSP**, both `csp` and `devCsp` (`tauri.conf.json:14-15`): `img-src 'self' data: yamt-picture:
  http://yamt-picture.localhost https:`. The two Gravatar hosts are dropped; `https:` covers them. Nothing else in
  either string changes.

## Change

1. `merge_requests/description.rs` and the command; `mod description;`; `commands.rs`.
2. `Pictures::offer_uploads` and `picture_answer`'s second kind; the scheme doc.
3. `tauri.conf.json` and `tests/csp.rs`.
4. `tests/description.rs` in the `run_with_fakes` shape of `tests/discussions.rs` (scenario `mr-description`, the
   fake xdg-open). Then the `picture_scheme.rs` additions.

## Acceptance

**Tests** (`cargo nextest run -p yamt-app merge_requests` with the hermetic prefix as `just test`), each named for the
bug it catches:

- `tests/description.rs`:
  - `a_described_page_is_offered_before_the_reply` (RK41, rule 4):
    - `https://docs.example/x` and `https://gitlab.example/taskboard/taskboard/-/issues/12` are not offered before
      reading !52, and are after;
    - `open_page` of each answers `opened`, and the fake xdg-open logs it;
    - `http://plain.example/` opens too.
  - `an_address_no_reply_named_is_not_offered` (RK41):
    - `mailto:anna@example.com`, `javascript:alert(1)` and `https://evil.example/` → `open_page` answers
      `notOffered`;
    - the fake xdg-open logs nothing.
  - `an_upload_is_offered_before_the_reply_and_served` (rule 5, RK53):
    - `picture_answer("/upload~<hex A>")` is 404 before reading !52;
    - after, it is the PNG with `image/png` and `nosniff`, fetched by `argv: api projects/7/uploads/<hex A>/shot.png`.
  - `an_upload_the_api_does_not_know_is_served_from_its_web_path` (hex B)
  - `an_upload_no_reply_offered_gets_404_and_runs_no_glab` (RK53): an unoffered `upload~<32 hex>`, a malformed
    `upload~xyz` and `upload~<hex A>/../x` each give 404, with no new `argv:` line.
  - `another_sites_image_is_never_fetched` (rule 6): after reading !52 and asking every offered key, no `argv:` line
    names `images.example` or `evil.example`.
  - `no_gitlab_project_fails_the_read`
  - `read_description_answers_through_the_command` (`invoke`: the JSON reply of !52 has `kind: "read"`, and !51 has
    `blocks: []`)
- `tests/picture_scheme.rs`: `an_avatar_and_an_upload_share_the_four_fetches_at_once` (the `slow_pictures` shape, mixed
  names).
- `tests/csp.rs`:
  - `the_csp_admits_the_scheme_and_any_https_image_only` (renamed from
    `the_csp_admits_the_scheme_and_gravatars_two_hosts_only`): `img-src` exactly `['self', data:, yamt-picture:,
    http://yamt-picture.localhost, https:]` in both strings.
  - `the_csp_loads_scripts_frames_media_and_fonts_from_the_app_only` (RK66, rule 6):
    - `default-src 'self'` and `font-src 'self'`;
    - no `script-src`, `frame-src`, `child-src`, `media-src`, `object-src` or `form-action` directive;
    - `'unsafe-inline'` only inside `style-src`.

**Commands:**

- `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all --check` and `just arch-check`: their
  summary lines.
- `cargo run -p yamt-app --features bindings --bin export-bindings -- target/bindings-description.ts`, then `diff -u
  frontend/src/ipc/bindings.ts target/bindings-description.ts`: exactly the types listed in design "Shared edits",
  `hasDescription` and `readDescription`.
- `just mutants HEAD` in your workspace (SP11).

**Smoke** (proves the shell end to end before the window exists):

1. Run `scripts/local-conflicts-repo.sh <scratch>/mpv`, then `cargo tauri build --debug --no-bundle`, then `just
   app-session start-app --name mpd --diff --dir <scratch>/mpv --glab mr-description`.
2. In the session's console (WebDriver `execute`), run `await window.__TAURI_INTERNALS__.invoke("read_description", {
   iid: 52 })`: the reply's kind is `read`, with its blocks.
3. Then load `yamt-picture://localhost/upload~<hex A>` (Windows: `http://yamt-picture.localhost/…`) as an image:
   `const i = new Image(); i.src = …; await i.decode()`. `naturalWidth` is above 0. `fetch` would be refused by
   `connect-src`.
4. The fake glab log shows the uploads route. Paste the lines.

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (RK41, RK53; proposed RK66),
`skill://verification`.
