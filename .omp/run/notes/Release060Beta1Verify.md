# Release060Beta1Verify — final run before tagging 0.6.0-beta.1 at ce2cf46 (verifier, 8m19s)

Verbatim output:

**Release 0.6.0-beta.1 at `ce2cf46`: the gate and every step of recipes 1–4 passed, with no failures.**

I ran `just check` exactly once. There was no mutation run. I edited no tracked file, and `git status --short` is empty at the end. Scratch files, logs and screenshots are in `/tmp/yamt-rel-0.6.0/`.

**Environment (VF5):**
- rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.1, pnpm 12.0.0, tauri-cli 2.12.4.
- `dpkg-deb` is not installed, so I read the .deb with `bsdtar`.
- Every app run used the release binary through an exit-status wrapper (`/tmp/yamt-rel-0.6.0/yamt-wrap`), on the private display `:3`.
- Windows were closed with `WM_DELETE_WINDOW` from a scratch libX11 sender (`wmclose.py`).
- Mesa printed only the DRI3 warning. There were no Gtk-CRITICAL lines or panics in `yamt-stderr.log`.

**Two things in my own setup to know about (neither touches the product):**
- **First close in 4.1 was lost:** my sender script never flushed the X connection, so that close message never left. I fixed the scratch script (XSync) and sent it again, and the app closed with the expected exit 1. Every later close worked on the first send.
- **Two read commands were blocked:** the ownership hook refused them because they contained `>`. I reran them without `>`; nothing was written.

```
gate: "pass"
failures: []
smoke: [
 { recipe: "1. just check + readmer check", pass: true,
   observed: "EXIT=0 in 52.6 s (log /tmp/yamt-rel-0.6.0/check.log).
   fmt-check: 'All matched files use the correct format. Finished in 1039ms on 572 files'.
   clippy -D warnings: 'Finished `dev` profile … in 2.96s', no warnings.
   test: 'Summary [ 9.357s] 940 tests run: 940 passed, 18 skipped'.
   deny: 'advisories ok, bans ok, licenses ok, sources ok' (only duplicate-crate warnings, e.g. thiserror 1/2).
   bindings-check, fixtures-check: empty diffs.
   web-lint, web-typecheck: silent.
   web-test: 'Test Files 198 passed (198) / Tests 2711 passed (2711)'.
   web-unused (knip): silent.
   arch-check: ok; map-check: ok.
   golden: ok for all 10 cases.
   sfc-order: silent.
   hooks-test: 'ℹ tests 17 ℹ pass 17 ℹ fail 0'.
   readmer check → READMER=0." },

 { recipe: "2. Licences", pass: true,
   observed: "'third-party-licenses: 356 Rust crates, 82 JS packages, 2 icon sets -> THIRD_PARTY_LICENSES.txt (744605 bytes)'; git diff --exit-code → EXIT=0, no diff." },

 { recipe: "3. Bundle", pass: true,
   observed: "cargo tauri build --bundles deb EXIT=0: 'Bundling yamt_0.6.0-beta.1_amd64.deb … (5.71 MiB)'.
   control: Package: yamt / Version: 0.6.0-beta.1 / Architecture: amd64 (read with bsdtar, not dpkg-deb).
   Data files: usr/bin/yamt (the only file in usr/bin), usr/lib/yamt/{LICENSE, THIRD_PARTY_LICENSES.txt}, usr/share/applications/yamt.desktop and three icons.
   The bundled licence file equals the repository's (cmp → CMP_OK).
   target/release/yamt --version → 'yamt 0.6.0-beta.1'." },

 { recipe: "4.1 Conflict project", pass: true,
   observed: "The sidebar listed the 7 files, the same 7 as ls-files -u.
   Opened vOn.ts ('2 changes · 1 conflict') and clicked Mark resolved. The question 'Unprocessed Changes — 1 unresolved conflict and 2 unprocessed changes still remain' appeared; I answered Save Current Result.
   After that, ls-files -u lists 6 files; vOn.ts is stage 0 a1631e1…, the list shows 'vOn.ts resolved', and PersistQueryClientProvider.tsx is selected and open.
   WM close → 'exit=1', stderr 'yamt: 6 of 7 files still unresolved'.
   Shots: merge-open, merge-vOn-open, merge-after-mark, merge-after-resolved, merge-after-close.png." },

 { recipe: "4.2 Range window (--glab lined-up)", pass: true,
   observed: "13 files listed; headers 'merge base of main and feature (531ea52)' / 'feature (9c1ba3f)'.
   On board.ts: thread 'Release check thread one' plus reply 'Reply draft text'.
   Edit on the reply (field 'Comment text') → saved as 'Edited reply for 0.6.0-beta.1'.
   Delete on the first note → 'Delete Comment / Delete this comment?' → Delete → only the edited reply remains in thread :43.
   Second thread at :58 'Second thread to delete': the file row showed 2 and two marks. Delete → its box and mark are gone, and the row is back to 1 (range-second-deleted.png).
   Post → Queue → 'Send to GitLab (1)' → Send → '1 sent, 0 refused', 'Pending on GitLab https://gitlab.example/taskboard/taskboard/-/merge_requests/12/diffs'.
   Fake glab log (/tmp/yamt-rel-0.6.0/glab-calls-range.log) has exactly one POST to projects/7/merge_requests/12/draft_notes, with stdin {\"note\":\"Edited reply for 0.6.0-beta.1\", new_line 43, old_line 42, base 531ea52…, head 9c1ba3f…, start 4378055…}.
   WM close → exit=0.
   Reopened on the same home: the mark on :43 opens 'Edited reply for 0.6.0-beta.1 / Pending on GitLab'. Its buttons are 'Post | Copy', with no Edit and no Delete. WM close → exit=0.
   status --porcelain=v2 (empty) and the refs (feature 9c1ba3f…, main 4378055…) are the same before and after.
   Shots: range-open, range-thread-reply, range-delete-question, range-after-delete-first, range-second-thread, range-second-deleted, range-sent, range-reopen, range-reopen-pending.png." },

 { recipe: "4.3 AI, real omp acp", pass: true,
   observed: "--ai --home home-3 --settings {agent: env PI_CODING_AGENT_DIR=… omp acp}.
   Added a thread (it landed on board.ts:23) and clicked Ask AI. The thread showed 'Stop' and 'Thinking and steps working…', and 'bun …/omp acp' was running.
   About 5 s later came the answer: 'The new \"reminded\" kind (line 21; line 23 is the activity WeakMap) is the activity-log entry that remind() records when a card's reminder fires…'.
   Steps: 'I'm checking the diff … $ git diff 531ea52 9c1ba3f -- src/board/board.ts / Done'.
   WM close: no question (nothing changed) → exit=0. pgrep 'omp acp' → nothing (exit 1).
   Repo status and refs are unchanged.
   Shots: ai-working.png, ai-answer.png." },

 { recipe: "4.4 Compare window", pass: true,
   observed: "Window title 'Compare — yamt'.
   Left: {\"name\":\"yamt\",\"version\":\"0.5.1\"}; right: {\"name\":\"yamt\",\"version\":\"0.6.0-beta.1\"}.
   Both lines carry 'chunk-modified chunk-band', with chunk-word-modified on '5' (left) and '6.0-beta' (right).
   WM_DELETE_WINDOW → exit=0. Shot: compare-typed.png." },

 { recipe: "4.5 No leftovers", pass: true,
   observed: "Every stop reported tauri-driver and xvfb 'stopped' and the session folder removed.
   pgrep -af 'yamt-rel|yamt-app-session|target/release/yamt|tauri-driver|WebKitWebDriver|Xvfb|omp acp' matched nothing (exit 1).
   /tmp/yamt-rel-merge and /tmp/yamt-rel-range are removed; only /tmp/yamt-rel-0.6.0 is left.
   Exit log: 1 (merge), 0, 0 (range), 0 (AI), 0 (diff)." }
]
```

**Only the owner can check:**
- **Real GitLab merge request:** whether the pending note lands on board.ts new line 43 / old line 42 in the Changes view, whether the pending review can then be published, and glab's real HTTP-error output.
- **Windows and macOS builds:** only CI makes them.
- **Real `dpkg-deb`/`dpkg -i` install of the .deb:** I read the package with `bsdtar` because `dpkg-deb` is not installed here.