# CommentQueueFinal

Agent output (`agent://CommentQueueFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/CommentQueueFinal.md), collected 2026-11-24T19:09:33.242Z.

{
  "gate": "fail",
  "failures": [
    {
      "step": "just check → deny (advisories); fmt-check, clippy, test passed before it; the recipes after deny did not run inside just check",
      "excerpt": "error[vulnerability]: Stack overflow in `Url::origin()` on nested `blob:` URLs\n  Cargo.lock:348 url 2.5.8 — ID: RUSTSEC-2026-0592\nerror[vulnerability]: Private cookie nonces can repeat in processes that fork\n  ID: RUSTSEC-2026-0594 — cookie v0.18.2 (fixed in 0.18.3); version requirements of tauri 2.12.1, tauri-runtime 2.12.1 and wry 0.57.0 (cookie = '^0.18') rule out updating\nadvisories FAILED, bans ok, licenses ok, sources ok\nerror: recipe `deny` failed on line 22 with exit code 1\n(deny also lists IDs RUSTSEC-2024-0370 and RUSTSEC-2024-0436, which are not errors.) Both errors are new upstream advisories against dependencies. No code in this feature causes them. For information only, I ran the 11 recipes after deny one by one, and each exited 0: bindings-check, fixtures-check, web-lint, web-typecheck, web-test, web-unused, arch-check, map-check, golden, sfc-order, hooks-test."
    }
  ],
  "smoke": [
    {
      "recipe": "1 fixture (review/seeded/linedUp/ai, dark): new comment → Queue",
      "observed": "Line 10 new box with 'Final queued one': buttons 'Queue | Note | Ask AI | Cancel'. A real pointer click on Queue gave 'Unqueue / Edit / Delete / Queued for GitLab'. Send to GitLab went from (2) to (3). Shot /tmp/cqf/02-queued-dark.png",
      "pass": true
    },
    {
      "recipe": "1 Shift held/released (WebDriver keyDown/keyUp \\uE008)",
      "observed": "New box: Shift down showed 'Send | Note | Ask AI | Cancel'; Shift up, read straight away, showed 'Queue | …'. The reply box showed the same: 'Send', then 'Queue'. Shot /tmp/cqf/01-typed-dark.png",
      "pass": true
    },
    {
      "recipe": "1 Shift+click Send on a new comment, seeded queued kept",
      "observed": "One action set: keyDown Shift, pointer click, keyUp. Line 4 'Final shift sent' became 'Post / Pending on GitLab / https://gitlab.example.com/team/taskboard/-/merge_requests/12/diffs / Copy'. 'Final queued one' stayed Queued and the count stayed (3). Notice '1 sent, 0 refused'. Shot /tmp/cqf/03-shiftsend-dark.png",
      "pass": true
    },
    {
      "recipe": "1 reply box Queue and Shift+Send",
      "observed": "Reply 'Final reply queued' → Queue: 'Unqueue Edit Delete Queued for GitLab', count 3→4. Reply 'Final reply shift sent' in the line-10 thread → Shift+click: 'Post / Pending on GitLab / link'; the thread's 'Final queued one' stayed Queued and the count stayed 4.",
      "pass": true
    },
    {
      "recipe": "1 Note → local; Post → queued at once, no edit box",
      "observed": "'Final local note' → Note: 'Post / Edit / Delete', no queued label, count 4. Post: 'Unqueue / Edit / Delete / Queued for GitLab', count 5. After that the page held only 'Reply…' textareas, so no edit box opened. Shot /tmp/cqf/04-note-dark.png",
      "pass": true
    },
    {
      "recipe": "1 Ctrl+Enter → Note",
      "observed": "'Final ctrl enter' + Ctrl+Enter (pressed through WebDriver) gave 'Post / Edit / Delete' with no queued label; count stayed 5.",
      "pass": true
    },
    {
      "recipe": "1 AI answer Post box (Queue, Shift→Send) [changed in d9d494c4]",
      "observed": "Dark: the answer's Post opened textarea 'Text to post' holding the answer, buttons 'Queue | Cancel'. Shift down: 'Send | Cancel'. Shift up: 'Queue | Cancel'. Queue: the box closed, the answer showed 'Unqueue / Queued for GitLab', count 5→6. Light: same toggle; a real click on Queue took the count 2→3. A second answer with Shift+click Send became 'Post / Pending on GitLab / link' while the count stayed 4 (the others still queued). Shots /tmp/cqf/05-aipost-shift-dark.png, 12-aipost-shift-light.png",
      "pass": true
    },
    {
      "recipe": "1 Edit box Save [changed in d9d494c4]",
      "observed": "Edit on a queued message opened textarea 'Comment text' with 'Save | Cancel', and holding Shift did not change them. Text emptied: 'Save[disabled] | Cancel'. Save: 'Final queued one edited / Unqueue / Edit / Delete / Queued for GitLab', count unchanged. The light theme gave the same with 'Light queued edited'. Shots /tmp/cqf/06-edit-dark.png, 13-edit-shift-light.png",
      "pass": true
    },
    {
      "recipe": "1 blank text disables Queue/Send/Note",
      "observed": "Empty box: Queue[disabled title='Queue this comment as a draft on !12; Send to GitLab sends the queue'], Note[disabled 'Keep this comment in yamt; Post queues it later']. Empty box with Shift held: Send[disabled 'Send only this comment to !12 as a draft now'].",
      "pass": true
    },
    {
      "recipe": "1 Send to GitLab, and Send disabled during a send",
      "observed": "Send to GitLab (6) showed 'Sending 1 of 6…' through 'Sending 6 of 6…' (disabled), then '(0)' disabled, notice '6 sent, 0 refused', every message 'Pending on GitLab'. During a Shift+Send, a MutationObserver recorded the other box's 'Send[disabled: A send to GitLab is running; Send is off until it ends]' and the header 'Sending 1 of 1…[disabled]'. The probe ended as Pending. Shot /tmp/cqf/07-sentall-dark.png",
      "pass": true
    },
    {
      "recipe": "1 light theme (Settings → yamt Light)",
      "observed": "New box 'Light queued': Queue→Send→Queue with Shift. A real click on Queue gave Queued for GitLab, count 1→2. Shots /tmp/cqf/10-shift-light.png, 11-queued-light.png",
      "pass": true
    },
    {
      "recipe": "1 fixture restarted with --gitlab loggedOut",
      "observed": "Queue[disabled title='glab is not logged in: gitlab.example.com: No token found (checked config file, keyring, and environment variables).']. With Shift held: Send[disabled, same title]. Send to GitLab (2) was disabled, and its title wrapper read the same text. Note stayed enabled and gave 'Post / Edit / Delete'. Hover shot /tmp/cqf/14-loggedout-hover.png",
      "pass": true
    },
    {
      "recipe": "2 real app: cargo tauri build --debug --no-bundle (exit 0), range-repo /tmp/cqf-repo, start-app --range main...feature --glab lined-up",
      "observed": "'Real app queued' → Queue: Queued, count (1); Shift showed 'Send | Note | Cancel'. 'Real app shift sent' → Shift+click: 'Pending on GitLab', link …/merge_requests/12/diffs; 'Real app queued' stayed Queued, count (1). calls.log had exactly 1 new POST 'api --include --method POST projects/7/merge_requests/12/draft_notes', note 'Real app shift sent', new_line 18. Send to GitLab: 1 POST, note 'Real app queued', count (0). threads.json: both posting kind 'pending', '!12', draft_note 102 (queued) and 101 (shift). Shots /tmp/cqf/20-app-shiftsend.png, 21-app-sendall.png",
      "pass": true
    }
  ],
  "environment": "main b23b55fa (the tree also has the orchestrator's .omp/run edits); rustc 1.99.0, node v26.13.1, pnpm 12.0.0. Fixture: WebKitWebDriver + MiniBrowser through just app-session. Real app: tauri-driver on Xvfb :3. Shift used raw WebDriver /actions calls, which need a 'content-type: application/json' header. All sessions stopped."
}
