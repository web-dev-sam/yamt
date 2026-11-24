# CommentQueueSmoke

Agent output (`agent://CommentQueueSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/CommentQueueSmoke.md), collected 2026-11-24T18:47:38.834Z.

{
  "gate": "not-run",
  "failures": [],
  "smoke": [
    {
      "recipe": "1 fixture (review/seeded/linedUp/ai, dark): new comment → Queue → Send to GitLab",
      "observed": "Clicked line 7 number, typed 'Queued via smoke one', clicked Queue: the message shows 'Unqueue | Edit | Delete | Queued for GitLab' and the header goes from 'Send to GitLab (2)' to '(3)'. Clicked 'Send to GitLab (6)' (by then 6 queued): it went to '(0)' [disabled title=Nothing queued]; each queued message showed 'Post [disabled] Pending on GitLab' with the link …/merge_requests/12/diffs. Notice '6 sent, 0 refused'. Shots /tmp/cq/05-queued-dark.png, /tmp/cq/10-sendall-dark.png",
      "pass": true
    },
    {
      "recipe": "1 Shift key toggles Queue↔Send (WebDriver keyDown/keyUp \\uE008)",
      "observed": "With text typed: buttons 'Queue | Note | Ask AI | Cancel'. After keyDown: 'Send | Note | Ask AI | Cancel'. After keyUp, read straight away: 'Queue'. Same result in the reply box and in the AI edit box. Shots /tmp/cq/04-shift-dark.png, /tmp/cq/13-shift-light.png",
      "pass": true
    },
    {
      "recipe": "1 Shift+click Send on a new comment, seeded queued untouched",
      "observed": "Used one WebDriver action set: keyDown Shift, then a pointer click on the button, then keyUp. Line-4 'Shift sent new comment' turned to 'Post [disabled title=Pending on GitLab] Pending on GitLab' plus the MR link. The notice bar read '1 sent, 0 refused'. Send to GitLab stayed at (3), so the seeded messages are still queued. Shot /tmp/cq/06-shiftsend-dark.png",
      "pass": true
    },
    {
      "recipe": "1 reply box in an open thread: Queue and Shift+Send",
      "observed": "Reply 'Reply queued' in the line-7 thread → Queue: it shows 'Unqueue Edit Delete Queued for GitLab' and the count went 3→4. Reply 'Reply shift sent' in the line-4 thread → Shift+click: 'Post Pending on GitLab' plus the link; the count stayed at 4.",
      "pass": true
    },
    {
      "recipe": "1 Note → local; Post → queued at once, no edit box",
      "observed": "Line 2 'Local note text' → Note: 'Post Edit Delete' with no queued label, count unchanged at 4. Post: 'Unqueue Edit Delete Queued for GitLab', count 5; only the 3 reply textareas are on the page, so no edit box opened. Shot /tmp/cq/07-note-dark.png",
      "pass": true
    },
    {
      "recipe": "1 Ctrl+Enter → Note",
      "observed": "Line 3 'Ctrl enter note' + Ctrl+Enter (WebDriver): 'Post Edit Delete', no queued label, count stayed at 5.",
      "pass": true
    },
    {
      "recipe": "1 AI answer Post → 'Text to post' edit box; Shift shows Send; Queue queues",
      "observed": "Ask AI gave a fixture answer with a Post button. Post opened a textarea labelled 'Text to post' holding the answer, with buttons 'Queue | Cancel'. With Shift held: 'Send | Cancel'. Shift released: 'Queue'. Clicking Queue took the count from 5 to 6. Shot /tmp/cq/09-aipost-shift-dark.png",
      "pass": true
    },
    {
      "recipe": "1 blank text disables Queue/Send/Note",
      "observed": "Empty box: Queue[disabled title='Queue this comment as a draft on !12; Send to GitLab sends the queue'], Note[disabled title='Keep this comment in yamt; Post queues it later']. With Shift held on an empty box: Send[disabled title='Send only this comment to !12 as a draft now'].",
      "pass": true
    },
    {
      "recipe": "1 light theme",
      "observed": "Settings → Theme yamt 'Light'. Line 5 'Light theme comment': Shift shows a filled blue Send button; Queue gives 'Unqueue Edit Delete Queued for GitLab' and the count went 0→1. Shots /tmp/cq/11-light.png, 13-shift-light.png, 14-queued-light.png",
      "pass": true
    },
    {
      "recipe": "1 Send disabled during a send (no 'slow' script in fixtureGitLab.ts; MutationObserver while a Shift+Send ran)",
      "observed": "Disabled states recorded during the send: the header showed 'Sending 1 of 1…', and the other comment's Send was disabled with title 'A send to GitLab is running; Send is off until it ends'. Afterwards the probe message was 'Pending on GitLab'.",
      "pass": true
    },
    {
      "recipe": "1 fixture restarted with --gitlab loggedOut",
      "observed": "Queue[disabled title='glab is not logged in: gitlab.example.com: No token found (checked config file, keyring, and environment variables).']. With Shift held: Send[disabled, same title]. Send to GitLab (2) disabled with the same title. Note stayed enabled and gave 'Post Edit Delete'. The hover check read the title attribute; shot /tmp/cq/15-loggedout-hover.png",
      "pass": true
    },
    {
      "recipe": "2 real app: range-repo /tmp/cq-repo, start-app --range main...feature --glab lined-up (cargo tauri build --debug --no-bundle exit 0)",
      "observed": "Line 21 'Real app queued' → Queue: count (1). Line 182 'Real app shift sent' → Shift+click: 'Pending on GitLab'; 'Real app queued' still Queued, count 1. calls.log then had exactly one 'api --include --method POST …/merge_requests/12/draft_notes', note 'Real app shift sent', new_line 182. Send to GitLab: one POST, note 'Real app queued', count (0). threads.json lists both as posting kind 'pending' on '!12' (draft_note 102 for 'Real app queued', 101 for the shift-sent one). Shots /tmp/cq/20-22-app-*.png",
      "pass": true
    }
  ],
  "environment": "main a1d7e755; rustc 1.99.0, node v26.13.1, pnpm 12.0.0; WebKitWebDriver+MiniBrowser through just app-session start-fixture; real app through tauri-driver on Xvfb :3. Shift used real WebDriver key actions plus raw curl /actions calls to the session's driver port (app-session has no key-hold command). All sessions stopped."
}
