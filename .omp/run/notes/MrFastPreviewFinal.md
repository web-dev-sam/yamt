# MrFastPreviewFinal

Agent output (`agent://MrFastPreviewFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewFinal.md), collected 2026-11-04T23:29:22.785Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "A `just check` (repo root, HEAD 6fb6cc8b, once)",
      "observed": "`just check 2>&1 | tail -40; echo EXIT ${PIPESTATUS[0]}` → last lines: golden `ok vue-core-script-context … ok vueuse-use-magic-keys`, `$ tsx scripts/check-sfc-order.ts`, hooks-test `ℹ tests 18 ℹ pass 18 ℹ fail 0`, `EXIT 0` (67 s wall, warm cache). Only the tail was kept, so the map-check line was not captured; the exit status covers every recipe, map-check included.",
      "pass": true
    },
    {
      "recipe": "B1 A1 local (fixture `--diff --mr list --open-mr --size 1600x1000`, d01 = src/board.ts:12) dark+light",
      "observed": "Preview box at once: `<p>Looks <strong>good</strong>, see <code>code</code>.</p><ul><li><p>one</p></li><li><p>two</p></li></ul>`. JS read at 0 ms after Preview.click(): the same text, never \"Loading…\". Log: only `mergeRequests.preview_local {iid: 637, blocks: 2}`, no fixture_preview. Same in light.",
      "pass": true
    },
    {
      "recipe": "B2 A1 blocks RICH dark+light",
      "observed": "`<h2>Plan</h2><table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td><code>x</code></td><td><strong>y</strong></td></tr></tbody></table><pre><code><span>const</span>…</code></pre><blockquote><p>note</p></blockquote>`. th fontWeight 600. Log: only `preview_local {iid: 637, blocks: 4}`. d01's code comment is Ruby, so `const` was compared with its keyword `def`. Dark: preview `ͼx rgb(224, 152, 107) 400` vs thread `def` `ͼv rgb(224, 152, 107) 400`. Light: `ͼx rgb(0, 51, 179)` vs `ͼv rgb(0, 51, 179)`.",
      "pass": true
    },
    {
      "recipe": "B3 A2 switch dark+light",
      "observed": "HI_ANNA: read at 0/60 ms gives \"Loading…\", then `<p><strong>Hi</strong> there <a role=\"link\" aria-description=\"https://gitlab.com/anna\">@anna</a></p>`. Log: `fixture_preview {iid: 637}` + `preview_read {iid: 637, kind: \"read\", ms: 300}`. `see #12`: \"Loading…\" at 60 ms, then one more `fixture_preview {iid: 637}`. The answer is `<p>see #12</p>` (the fixture links nothing).",
      "pass": true
    },
    {
      "recipe": "B4 A3 one look dark+light",
      "observed": "Dark. HI (local): strong `700 ; 13px ; rgb(214, 212, 221) ; system-ui, sans-serif`; p `13px ; 19.5px ; rgb(214, 212, 221)`; pLeft 9, pTop 5. HI_ANNA (GitLab): the same values exactly. Light: HI and HI_ANNA both strong `700 ; 13px ; rgb(0, 0, 0) ; system-ui, sans-serif`, pLeft 9, pTop 5. Only the @anna link differs.",
      "pass": true
    },
    {
      "recipe": "B5 A3 posted dark+light",
      "observed": "THANKS preview (local): strong `700 ; 13px ; rgb(214, 212, 221) ; system-ui, sans-serif`, p `13px ; system-ui, sans-serif ; rgb(214,212,221)`. Add comment logs `fixture_write {kind: \"comment\", iid: 637, discussion: \"0…01\"}`, `thread_write {… kind: \"sent\"}`, `fixture_thread`, `thread_read {… comments: 5}`. The posted p and strong have the same values. Light: preview and posted both `700 ; 13px ; rgb(0, 0, 0)`, p `rgb(0, 0, 0)`. One fixture_write, comments: 6.",
      "pass": true
    },
    {
      "recipe": "B6 A4 dark+light",
      "observed": "Empty field → \"Nothing to preview.\", log `[]`. FAIL → \"Could not preview: glab timed out\", log `fixture_preview` + `preview_read {kind: \"failed\"}`. Write after: `{focus:true, s:11, e:11, v:\"fail now #1\"}`. An earlier Write after PLAIN gave value intact with s=e=40 and focus true.",
      "pass": true
    },
    {
      "recipe": "B7 B2 Refresh + box reload dark+light",
      "observed": "Refresh: first line `fixture_ask_again {}`, then `fixture_discussions {iids: \"639,638,637…\"}`, `fixture_thread`, `discussions_read…`. One ask, panelOpen true. Box reload: `fixture_ask_again {}`, `fixture_thread {iid: 637…}`, `fixture_discussions {iids: \"637\"}`, `thread_read`, `discussions_read {asked: 1…}`, `discussions_reloaded {iid: 637, kind: \"open\"}`. Panel still open.",
      "pass": true
    },
    {
      "recipe": "B+ discussions Off with d01 shown, box reload (added step)",
      "observed": "Settings→Off (pressed: Dark|Subpixel|Off), then Merge requests. The UI cannot open a thread in Off, so, as R2 did, it was shown via the MergeRequestDiscussions instance `mergeRequests.showThread(637, \"0…01\")`: `fixture_thread` + `thread_read`. Hovered the count: one Reload button, icon `size-4`, no spin. Real webdriver click with a MutationObserver: first change `{spin:true, logs:1}`; log `fixture_ask_again {}`, `fixture_thread {iid: 637…}`, `thread_read {iid: 637, kind: \"read\", comments: 5, ms: 400}`; end `{spin:false, logs:3}`. One ask, one thread read, no fixture_discussions.",
      "pass": true
    },
    {
      "recipe": "B8 shot RICH dark/light",
      "observed": "/tmp/mfv-scratch/rich-dark.png and /tmp/mfv-scratch/rich-light.png (source page): panel src/board.ts:12 with Plan heading, a|b table, `const x: number = 1;` with const in orange (dark) / blue (light), and the quote \"note\".",
      "pass": true
    },
    {
      "recipe": "C1 B1 once (start-app --diff --dir /tmp/mfv-scratch/mfv --glab mr-threads --mr, RUST_LOG=info)",
      "observed": "After the list, !90's box and d01's panel (Thread: src/board.ts:12): 12 argv lines. Exactly one `argv: auth status` (line 1) and one `argv: api projects/:fullpath` (line 4).",
      "pass": true
    },
    {
      "recipe": "C2 A1 none",
      "observed": "PLAIN preview at once (`<p>Looks <strong>good</strong>…<ul>…`), window log `preview_local {iid: 90, blocks: 2}`. argv count still 12.",
      "pass": true
    },
    {
      "recipe": "C3 one call",
      "observed": "HI_ANNA: \"Loading…\" at 0 ms, then `<p><strong>Preview</strong> of <a … aria-description=\"https://gitlab.com/anna\">@anna</a></p>`, which is markdown.json's answer. Count 12→13; the new line is `argv: api --method POST markdown --input -`.",
      "pass": true
    },
    {
      "recipe": "C4 reuse",
      "observed": "d02 (\"Should the empty lane hide?\", row 12) then d01: 4 new lines, `api graphql … MergeRequestDiscussions` + `api --paginate …/merge_requests/90/draft_notes` twice. Add comment `Thanks`: `api --include --method POST projects/taskboard%2Ftaskboard/merge_requests/90/discussions/0…01/note`, MergeRequestDiscussions, draft_notes. auth status / projects/:fullpath still only at lines 1 and 4.",
      "pass": true
    },
    {
      "recipe": "C5 Refresh",
      "observed": "Next lines: `argv: auth status`, `argv: api projects/:fullpath`, `api graphql … MergeRequestPage(…`, MergeRequestDiscussions ×2, draft_notes. Panel still open. The HI_ANNA preview after it adds only `argv: api --method POST markdown --input -`.",
      "pass": true
    },
    {
      "recipe": "C6 logs",
      "observed": "`INFO yamt_merge_requests::project: asked glab for the login and the project outcome=\"found\"`; `INFO frontend: event=\"mergeRequests.preview_local\" fields=blocks=2 iid=90`; `INFO yamt_merge_requests::project: forgot GitLab's login and project reason=\"refresh\"`; `… asked glab for the login and the project outcome=\"found\"`. No path or text.",
      "pass": true
    },
    {
      "recipe": "C7 shot dark/light",
      "observed": "/tmp/mfv-scratch/app-dark.png: d01 panel with GitLab's \"Preview of @anna\" and posted \"Thanks\" row. /tmp/mfv-scratch/app-light.png: yamt Light, d01 panel with RICH previewed (Plan, table, blue const, quote).",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.0; pnpm 12.0.0; WebKit: MiniBrowser via just app-session (private display); app target/debug/yamt from `cargo tauri build --debug --no-bundle` after the gate; Linux 7.2.11-arch1-1 x64. Fixture log via a console.info capture installed by `read`."
}
