# Slice mr-fast-preview-panel — the thread panel previews at once when yamt can; Refresh asks GitLab again (window)

Feature: an instant comment preview, and GitLab's login and project asked once. Sources:

- Request `docs/slices/request-mr-fast-preview.md` A1, A3, A4, B2 ("The page's Refresh button asks both again") and
  the WebKit acceptance "a plain comment previews with no `fixture_preview` and no 'Loading…' …; typing `#12` or
  `@anna` previews through `fixture_preview`".
- Design `docs/slices/briefs/mr-fast-preview-design.md` §1.3 (one preview state), §1.4 (Refresh), §3.1 rows #186–#187.

Runs in round 3, once `mr-fast-preview-local` and `mr-fast-preview-remembered` are committed and the orchestrator has
run `just bindings` (`commands.askGitlabAgain`). **This slice wires the window**: its commit starts the smoke pass.

## Target

**Owned:**

- `frontend/src/ui/mergeRequestPreview.ts`
- `frontend/src/ui/mergeRequestThread.ts`, `frontend/src/ui/mergeRequestThread.test.ts`
- `frontend/src/ui/MergeRequestThreadPanel.test.ts`
- `frontend/src/ui/mergeRequests.ts`, `frontend/src/ui/mergeRequests.test.ts`
- `frontend/src/ui/MergeRequestDiscussions.vue` (the reload button's click only), `frontend/src/ui/MergeRequestDiscussionsBox.test.ts`
- `frontend/src/ipc/MergeRequestSource.ts`, `frontend/src/ipc/tauriMergeRequests.ts`,
  `frontend/src/ipc/tauriMergeRequests.test.ts`, `frontend/src/ipc/fixtureMergeRequests.ts`,
  `frontend/src/ipc/fixtureMergeRequests.test.ts`
- `frontend/src/ui/AGENTS.md`, `frontend/src/ipc/AGENTS.md`

**Read-only:** everything else.

- `frontend/src/editor/**`: `localPreview` as `mr-fast-preview-local` built it (`import { localPreview } from
  "../editor"`; the Markdown fence forbids only `MarkdownView` there, `frontend/scripts/markdownFence.ts:33-47`).
- `frontend/src/ipc/bindings.ts`: generated (PM4).
- `frontend/src/ui/MergeRequestReplyField.vue`, `MergeRequestThread.vue`: unchanged — "Loading…" follows the state
  (`MergeRequestReplyField.vue:80-99`), which a local read never enters.
- `frontend/src/ipc/fixtureMergeRequestThreads.ts`: its `previewMarkdown` stays the GitLab stand-in.
- `crates/**`, `src-tauri/**`, `docs/**`: lines in `deviations_from_brief`.

**Non-goals:** a visible mark telling local from GitLab (A3: one look); caching GitLab's answers (request non-goal); the
AI chat; previews outside the thread panel.

## Contract

Fixed; you may add, never change.

```ts
// ui/mergeRequestPreview.ts — `Preview` (lines 10-19) and `readPreview` unchanged.

/** `text` drawn by yamt itself when `localPreview` renders it as GitLab would (plan §2 #186): a read at once, no
 *  call; null when GitLab must. Logs `mergeRequests.preview_local { iid, blocks }` (counts only, never the text).
 *  The caller words a blank text. */
export function previewHere(iid: MergeRequestIid, text: string): Preview | null;

// ipc/MergeRequestSource.ts
/** An explicit refresh (the page's Refresh and its Retry, the discussions box's reload button; owner #2423): the next
 *  GitLab action asks glab for the login and the project again (plan §2 #187). */
askGitLabAgain(): Promise<SourceResult<null>>;

// ui/mergeRequests.ts — the slice gains (owner #2423)
/** The discussions box's reload button: `askGitLabAgain`, then `reloadDiscussions(iid)`. */
refreshDiscussions(iid: MergeRequestIid): void;
```

- `mergeRequestThread.ts` `preview` (`:197-214`): blank → `empty` as today; then `previewHere(shown.iid, text)` — a read
  → `patch(state, shown, { preview: read })` and return, with no `loading` and no source call; null → `loading` and
  `readPreview` exactly as today.
- `tauriMergeRequests.ts`: `askGitLabAgain` returns `toResult(await commands.askGitlabAgain())` (a failure as every
  other method's). `fixtureMergeRequests.ts`: logs `mergeRequests.fixture_ask_again {}`, answers `{ ok: true, value:
  null }`.
- `mergeRequests.ts` `refresh` (`:285`): `askGitLabAgain()` through `attempt`, awaited, then `loadList(state)`; a failure
  logs `mergeRequests.ask_again_failed { kind }` and the list loads anyway. `show` (`:134-142`, the first load and the
  30 s stale reload) does not ask again.
- `mergeRequests.ts` `refreshDiscussions(iid)` (owner #2423: every explicit refresh button asks again):
  `askGitLabAgain()` through `attempt`, awaited, then the existing `reloadDiscussions(iid)` (`:187-190`); a failure logs
  `ask_again_failed` and reloads anyway. `MergeRequestDiscussions.vue:268` calls `refreshDiscussions`. The reload a
  submit triggers (`mergeRequestThread.ts:193` → `reloadDiscussions`) does not ask again: it is no button press.

## Change

1. `previewHere` and the `preview` step.
2. `askGitLabAgain` in the interface, the Tauri source, the fixture; `refresh`.
3. Tests (below); the existing preview tests whose texts are now local get a trigger so they still exercise GitLab's
   path: `a_preview_shows_gitlabs_rendering_of_the_text` uses `` `${SECRET} @anna` `` (or another text with a trigger),
   `MergeRequestThreadPanel.test.ts`'s `"fail here"` becomes `"fail here #1"` (the fixture fails texts starting `fail`).
   `mergeRequests.test.ts`'s hand-built source (`:168`) gains `askGitLabAgain`.
4. `ui/AGENTS.md`: the preview's local step and its log line; Refresh asks again. `ipc/AGENTS.md`: the method, the
   fixture's log line.

## Acceptance

**Tests** (`pnpm -C frontend test`), each named for the bug it catches:

- `a_plain_preview_is_read_at_once_without_a_call` (`mergeRequestThread.test.ts`) — **owns A1 in the panel**: the text
  `PLAIN` below → right after `showPreview()` (no timer advanced) the shown preview is `{ kind: "read" }` with a
  paragraph and a list; `live.previews` empty; it never was `loading`.
- `a_preview_with_a_reference_goes_to_gitlab` — `see #12` and `thanks @anna` → `loading`, one `previewMarkdown` call with
  the text, then GitLab's answer — **owns A2's switch**.
- `a_late_gitlab_answer_never_replaces_a_local_read` — `@anna` previewed (loading), Write, the text edited to a plain
  one, Preview (a local read), then the held GitLab answer resolves → the local read stays.
- the existing `a_blank_preview_is_empty_without_a_call`, Write keeps the text, and the failure sentence tests green
  (A4).
- `a_plain_preview_shows_no_loading_and_asks_nothing` (`MergeRequestThreadPanel.test.ts`, on the fixture): a plain
  text's Preview → its blocks in the first render after the click, no "Loading…", no `fixture_preview` in the log;
  then `**Preview** of @anna` → "Loading…", then the mention link, one `fixture_preview`.
- `refresh_asks_gitlab_again_before_listing` (`mergeRequests.test.ts`) — **owns the window's half of "Refresh runs both
  again"**: `refresh()` calls `askGitLabAgain` once, before the list load; `show()` (first and stale) calls it never; a
  failed `askGitLabAgain` still lists and logs `ask_again_failed`.
- `the_discussions_reload_button_asks_gitlab_again` (`mergeRequests.test.ts` or `MergeRequestDiscussionsBox.test.ts`) —
  **owns #2423's second button**: `refreshDiscussions(iid)` calls `askGitLabAgain` once before the row's reload; a
  submit's reload calls it never; a failed ask still reloads.
- `askGitLabAgain_calls_the_command` and the `WorkerStopped` row for it (`tauriMergeRequests.test.ts`); the fixture's
  `fixture_ask_again` line (`fixtureMergeRequests.test.ts`).

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused` (`localPreview` now has its caller),
`sfc-order`; `just mutants HEAD`.

**Smoke (WebKit fixture, the wiring):** `just app-session start-fixture --name mfp --diff --mr list --size 1600x1000`,
the merge-requests page, !637's d01 panel (Shift over its row in the discussions box): type `PLAIN`, press Preview → the
blocks in the first `read` after the click, no "Loading…", no `fixture_preview` in the session log, one
`preview_local`; Write → the text and caret as typed; append ` #12`, Preview → "Loading…", then the text, one
`fixture_preview`; press the page's Refresh → one `fixture_ask_again` before the list's load lines. `shot` dark, and
light (`--settings '{"theme":"light"}'`). `just app-session stop --name mfp`.

`PLAIN`, the plain comment of the tests and the smoke (a JSON string):

```json
"Looks **good**, see `code`.\n\n- one\n- two"
```

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://ipc-contract` (one source method),
`skill://risk-register` (RK67, RK72, RK73: the panel's state and stale answers), `skill://verification`.
