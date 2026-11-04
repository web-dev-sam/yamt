# MrFastPreviewPanel

Agent output (`agent://MrFastPreviewPanel`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewPanel.md), collected 2026-11-04T22:25:39.386Z.

{
  "summary": "Plain comments now preview at once in the thread panel, with no call and no \"Loading…\": `previewHere` uses `localPreview` and the text still goes to GitLab when it returns null. `MergeRequestSource.askGitLabAgain` is wired to the Tauri command `ask_gitlab_again`; in the fixture it logs `fixture_ask_again`. The page's Refresh/Retry and the discussions box's reload button now ask GitLab again before reloading, through the new `ui/mergeRequestsRefresh.ts`. `show()` and the reload after a submit do not ask.",
  "files_changed": [
    "frontend/src/ui/mergeRequestPreview.ts",
    "frontend/src/ui/mergeRequestThread.ts",
    "frontend/src/ui/mergeRequestThread.test.ts",
    "frontend/src/ui/MergeRequestThreadPanel.test.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/mergeRequestsRefresh.ts",
    "frontend/src/ui/mergeRequestReload.test.ts",
    "frontend/src/ui/MergeRequestDiscussions.vue",
    "frontend/src/ipc/MergeRequestSource.ts",
    "frontend/src/ipc/tauriMergeRequests.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequests.ts",
    "frontend/src/ipc/fixtureMergeRequests.test.ts",
    "frontend/src/ui/AGENTS.md",
    "frontend/src/ipc/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "a_plain_preview_is_read_at_once_without_a_call (mergeRequestThread.test.ts)",
      "proves": "PLAIN becomes `read` with blocks paragraph+list right after showPreview; preview kinds seen are only writing→read (never loading); no previewMarkdown call; logs preview_local {iid, blocks: 2} and never the text"
    },
    {
      "name": "a_preview_with_a_reference_goes_to_gitlab",
      "proves": "`see #12` and `thanks @anna` each go to loading, make one previewMarkdown call with the text, then show GitLab's answer"
    },
    {
      "name": "a_late_gitlab_answer_never_replaces_a_local_read",
      "proves": "a held GitLab answer for an @anna text that resolves after Write, a plain edit and a local Preview leaves the local read object in place"
    },
    {
      "name": "a_plain_preview_shows_no_loading_and_asks_nothing (MergeRequestThreadPanel.test.ts)",
      "proves": "on the fixture, PLAIN renders <strong>good</strong> and a list in the first render with no Loading… and no fixture_preview; `**Preview** of @anna` then shows Loading…, the mention link and exactly one fixture_preview"
    },
    {
      "name": "refresh_asks_gitlab_again_before_listing (mergeRequests.test.ts)",
      "proves": "show() (first and stale) never asks; refresh() asks once, then lists; with the ask held the list waits; a failed ask logs ask_again_failed {kind} and still lists to done"
    },
    {
      "name": "the_discussions_reload_button_asks_gitlab_again (mergeRequestReload.test.ts)",
      "proves": "a submit's discussions reload makes no ask; refreshDiscussions(iid) asks once, then the row's readDiscussions and reloads running"
    },
    {
      "name": "a_failed_ask_still_reloads_the_discussions",
      "proves": "a failed askGitLabAgain logs ask_again_failed and the row still reloads"
    },
    {
      "name": "askGitLabAgain_calls_the_command + `a askGitlabAgain failure comes back unchanged` (tauriMergeRequests.test.ts)",
      "proves": "the source calls commands.askGitlabAgain() once with no arguments → {ok:true,value:null}; WorkerStopped comes back unchanged"
    },
    {
      "name": "asking_gitlab_again_logs_fixture_ask_again_and_answers_at_once (fixtureMergeRequests.test.ts)",
      "proves": "the fixture logs exactly `mergeRequests.fixture_ask_again {}` and answers {ok:true,value:null}"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; unused; sfc-order",
      "observed": "vue-tsc -b clean; oxlint+eslint clean; 'All matched files use the correct format.'; knip clean; check-sfc-order clean"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files 300 passed (300); Tests 4495 passed (4495)"
    },
    {
      "command": "just app-session start-fixture --name mfp --diff --mr list --open-mr --size 1600x1000; hovered '13 open discussions' (!637), hovered d01, pressed Shift → 'Thread: src/board.ts:12'; typed PLAIN; clicked Preview",
      "observed": "first read after the click: STRONG:good CODE:code LI:one LI:two; a MutationObserver on the dialog saw Loading… 0 times; captured console: [\"[info] mergeRequests.preview_local {iid: 637, blocks: 2}\"] (no fixture_preview)"
    },
    {
      "command": "click Write; read textarea",
      "observed": "value \"Looks **good**, see `code`.\\n\\n- one\\n- two\", caret=40-40 (the end, as typed), visible"
    },
    {
      "command": "focus textarea, type ' #12', click Preview",
      "observed": "Loading… seen once, then the text; lines: fixture_preview {iid: 637}, preview_read {iid: 637, kind: \"read\", ms: 300} — one fixture_preview"
    },
    {
      "command": "click page Refresh",
      "observed": "exactly 1 fixture_ask_again, at index 0, before the swapped list's fixture_discussions/thread re-read/discussions_read lines (the fixture's list load itself logs no line)"
    },
    {
      "command": "click 'Reload discussions' (the box's reload button)",
      "observed": "fixture_ask_again {}, then fixture_discussions, fixture_thread, discussions_read, discussions_reloaded {iid}, thread_read"
    },
    {
      "command": "just app-session shot --name mfp /tmp/mfp-shots/dark-local-preview.png",
      "observed": "dark theme: panel Preview shows 'Looks good, see code.' plus the one/two bullets, with no Loading…"
    },
    {
      "command": "Settings → Light, back to the page, reopened d01, set PLAIN, Preview; shot /tmp/mfp-shots/light-local-preview.png",
      "observed": "data-theme=light; Loading… seen 0 times; lines [\"[info] mergeRequests.preview_local {iid: 637, blocks: 2}\"]; screenshot shows the same preview in light"
    },
    {
      "command": "just app-session stop --name mfp",
      "observed": "stopped webdriver and vite; folder removed"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (Stryker, 8 TS files): 747 killed, 25 survived, 2 no coverage, 3 errors; mergeRequestPreview.ts and mergeRequestsRefresh.ts 100%",
    "survivors": [
      "None on changed lines. All 25 survivors are on unchanged lines: fixtureMergeRequests.ts 53-82/143/176, tauriMergeRequests.ts:27, mergeRequests.ts:140/217, mergeRequestThread.ts:85/124/222"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "New file frontend/src/ui/mergeRequestsRefresh.ts (Main approved) holds `Refreshes` {refresh, refreshDiscussions} and `createRefreshes(state)`; mergeRequests.ts spreads it. Reason: mergeRequests.ts at 295/300 lines, createMergeRequests at 39/40. Docs keeper: tree.md needs a row for it (PM6).",
    "refreshDiscussions' contract doc sits on the `Refreshes` type, which `MergeRequests` now includes; `refresh()` moved there from the MergeRequests literal.",
    "frontend/src/ui/mergeRequestReload.test.ts edited (Main approved): its rig records askGitLabAgain/readDiscussions calls; a_list_refresh_rereads_the_shown_thread settles after refresh() (the list now starts after the awaited ask); the refreshDiscussions tests live here.",
    "mergeRequests.test.ts: an `await settled()` after each refresh() whose test drives the list load synchronously (same cause); the rig records the call order.",
    "Contract doc comments say `owner decision 2423` / `plan §2 row 186/187` instead of `#2423`/`#186`/`#187`: scripts/palette.test.ts flags `#NNN` in source as a hex colour literal.",
    "mergeRequestThread.ts preview: the blank check and previewHere share one branch (`text.trim() === \"\" ? EMPTY : previewHere(...)`) so the file stays at 299/300 lines; same behaviour as the brief's two steps.",
    "tauriMergeRequests.ts: findGitLabProject and askGitLabAgain moved into a `projectCalls()` helper (createTauriMergeRequests would be 42/40 lines). fixtureMergeRequests.ts: askGitLabAgain added to `pageScript` (no room for a helper of its own).",
    "Smoke: start-fixture has no --settings option, so light was set through the app's Settings → Light in the same session; --open-mr opens the page directly; the console was captured by wrapping console.info through `app-session read`."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestsRefresh.ts:30",
      "risk": "refreshDiscussions starts the reload only after the ask settles, so the reload button's spinner shows one IPC round-trip late (the ask waits for any glab lookup in flight; in the fixture it answers at once)."
    },
    {
      "location": "frontend/src/ui/mergeRequestPreview.ts:26",
      "risk": "Whether a text is local is decided entirely by localPreview, which this slice does not own; a missed trigger there shows plain text where GitLab would draw something else (RK74, its own slice)."
    }
  ]
}
