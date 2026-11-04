# MrFastPreviewSmoke

Agent output (`agent://MrFastPreviewSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewSmoke.md), collected 2026-11-04T22:51:21.019Z.

{
  "gate": "not-run",
  "failures": [],
  "smoke": [
    {
      "recipe": "B1 A1 local (dark+light): d01 panel of !637, PLAIN, Preview, read at once",
      "observed": "Box read right after the click, the same in both themes: <p>Looks <strong>good</strong>, see <code>code</code>.</p><ul><li><p>one</p></li><li><p>two</p></li></ul>. A MutationObserver saw \"Loading…\" 0 times. Captured console: [\"info [info] mergeRequests.preview_local {iid: 637, blocks: 2}\"]. No fixture_preview line.",
      "pass": true
    },
    {
      "recipe": "B2 A1 blocks RICH (dark+light)",
      "observed": "<h2>Plan</h2><table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td><code>x</code></td><td><strong>y</strong></td></tr></tbody></table><pre><code><span>const</span>…</code></pre><blockquote><p>note</p></blockquote>. th fontWeight 600, td 400, strong y 700, code x in JetBrains Mono. Log: preview_local {iid: 637, blocks: 4}, no fixture_preview, Loading… seen 0 times. const colour: dark rgb(224, 152, 107), light rgb(0, 51, 179). The keyword in d01's code block is the same colour in both themes, but that block is Ruby (`def snooze(card)`), not TypeScript.",
      "pass": true
    },
    {
      "recipe": "B3 A2 switch (dark+light): HI_ANNA, then `see #12`",
      "observed": "HI_ANNA: Loading… seen 1 time, then <p><strong>Hi</strong> there <a role=\"link\" aria-description=\"https://gitlab.com/anna\">@anna</a></p>. Log: fixture_preview {iid: 637}, preview_read {iid: 637, kind: \"read\", ms: 305}. `see #12`: one more fixture_preview {iid: 637} and preview_read ms 300; the box shows <p>see #12</p>.",
      "pass": true
    },
    {
      "recipe": "B4 A3 one look: HI (local), then HI_ANNA (GitLab)",
      "observed": "Dark, both reads: strong [700, 13px, rgb(214, 212, 221), system-ui, sans-serif]; p [13px, rgb(214, 212, 221), lineHeight 19.5px, marginTop 0px]; p left 9 and top 5 inside the box. Only the link differs (false, then true). Light: the same values with colour rgb(0, 0, 0), left 9, top 5.",
      "pass": true
    },
    {
      "recipe": "B5 A3 posted: THANKS previewed, then Add comment (dark+light)",
      "observed": "Preview: strong [700, 13px, rgb(214, 212, 221) dark / rgb(0, 0, 0) light, system-ui]. After Add comment: one `fixture_write {kind: \"comment\", iid: 637, discussion: \"0000…0001\"}` and thread_write kind \"sent\". The posted P>strong \"Thanks\" is [700, 13px, the same colour, system-ui, sans-serif]; its p is 13px with line-height 19.5px, the same as the preview.",
      "pass": true
    },
    {
      "recipe": "B6 A4: empty Preview, Write after a preview, FAIL (dark+light)",
      "observed": "Empty field: <p>Nothing to preview.</p> with no log lines (cap []), Loading… seen 0 times. Write after previewing `abc def`: value \"abc def\", selectionStart and selectionEnd 7, focus on the TEXTAREA. FAIL: <p role=\"alert\">Could not preview: glab timed out</p>, log fixture_preview and then preview_read kind \"failed\" ms 300; the textarea still holds \"fail now #1\".",
      "pass": true
    },
    {
      "recipe": "B7 B2 Refresh and Reload discussions (dark+light)",
      "observed": "Refresh: the first line is `mergeRequests.fixture_ask_again {}` (exactly 1), then fixture_discussions, thread and discussions_read; the panel stays open (textarea present). The fixture logs no explicit list-load line. Reload discussions: fixture_ask_again {}, then fixture_thread 637, fixture_discussions {iids: \"637\"}, discussions_read, discussions_reloaded {iid: 637, kind: \"open\"}.",
      "pass": true
    },
    {
      "recipe": "B8 shot of the panel with RICH previewed",
      "observed": "/tmp/mfv-scratch/b8-rich-dark.png and /tmp/mfv-scratch/b8-rich-light.png (page). Both show the heading Plan, the a|b table, the const line in keyword colour and the note quote.",
      "pass": true
    },
    {
      "recipe": "B setup note: light theme",
      "observed": "`start-fixture --settings` failed: `app-session: unknown option --settings`. Light theme was set through Settings > Theme yamt Light instead; data-theme was \"light\".",
      "pass": true
    },
    {
      "recipe": "C1 B1 once: list, !90's box and d01's panel",
      "observed": "calls.log after the panel opened, 12 argv lines: 1× `argv: auth status`, 1× `argv: api projects/:fullpath`, plus MergeRequestPage, 2× MergeRequestDiscussions, draft_notes, avatars and an upload.",
      "pass": true
    },
    {
      "recipe": "C2 A1 none: PLAIN previewed",
      "observed": "argv count 12 before and 12 after. Box <p>Looks <strong>good</strong>…<ul>…; window log preview_local {iid: 90, blocks: 2}.",
      "pass": true
    },
    {
      "recipe": "C3 one call: HI_ANNA",
      "observed": "argv count went from 12 to 13; the new line is `argv: api --method POST markdown --input -`. Box <p><strong>Preview</strong> of <a …gitlab.com/anna>@anna</a></p>, which matches tests/glab/mr-threads/markdown.json.",
      "pass": true
    },
    {
      "recipe": "C4 reuse: Shift over d02, back to d01, Add comment Thanks",
      "observed": "New lines 14–20: MergeRequestDiscussions, draft_notes, MergeRequestDiscussions, draft_notes, `api --include --method POST projects/taskboard%2Ftaskboard/merge_requests/90/discussions/0000…0001/notes --input -`, MergeRequestDiscussions, draft_notes. No `auth status` or `projects/:fullpath` among them.",
      "pass": true
    },
    {
      "recipe": "C5 Refresh, then a preview",
      "observed": "Lines 21–26: `argv: auth status`, `argv: api projects/:fullpath`, MergeRequestPage, 2× MergeRequestDiscussions, draft_notes. A HI_ANNA preview afterwards added only line 27: `argv: api --method POST markdown --input -`.",
      "pass": true
    },
    {
      "recipe": "C6 Rust log (RUST_LOG=info)",
      "observed": "`INFO yamt_merge_requests::project: asked glab for the login and the project outcome=\"found\"`; at Refresh: `forgot GitLab's login and project reason=\"refresh\"`, then `asked glab for the login and the project outcome=\"found\"`. Neither line holds a path or text. Window log: `INFO frontend: event=\"mergeRequests.preview_local\" fields=blocks=2 iid=90` for step 2.",
      "pass": true
    },
    {
      "recipe": "C7 shot dark and light",
      "observed": "/tmp/mfv-scratch/c7-app-dark.png shows the d01 panel with the GitLab preview \"Preview of @anna\" and the posted Thanks. /tmp/mfv-scratch/c7-app-light.png is a restart with --settings theme light, RICH previewed locally (no new argv line, count 12): Plan heading, table, const in blue.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28), node v26.13.0, pnpm 12.0.0. HEAD 54f6813b. Fixture: MiniBrowser through `just app-session start-fixture` on a private display. App: target/debug/yamt from `cargo tauri build --debug --no-bundle`, Xvfb :3. Console capture: a console wrapper injected through `read`. All sessions stopped."
}
