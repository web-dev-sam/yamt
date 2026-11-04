# MrPeopleFinal

Agent output (`agent://MrPeopleFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleFinal.md), collected 2026-11-04T00:16:27.705Z.

{
  "gate": "fail",
  "failures": [
    {
      "step": "A. just check → hooks-test (last recipe; every earlier recipe passed, 179.92 s)",
      "excerpt": "✖ ownership: arrows are not redirects; targets after `cd <dir>` resolve against it\n  AssertionError: {\"command\":\"printf a > base\"} as web-impl: allowed\n  false !== true\n  at assertVerdict (.omp/hooks/test/hooks.test.ts:64:10) … hooks.test.ts:370:5\n✖ ownership: redirects resolve against the tool cwd and every earlier relative or absolute `cd`\n  AssertionError: {\"command\":\"cd frontend && printf x > src/editor/p.ts\"} as main: allowed\n  false !== true\n  at hooks.test.ts:375:3\nerror: recipe `hooks-test` failed on line 72 with exit code 1\nDiagnostic summary from one run of `just hooks-test` (not a retry): tests 18, pass 15, fail 3. Also failing: 'ownership: main, owned, outside, URL targets, scratch dir, unregistered'. [INFERENCE] These tests may depend on the checkout path: the worktree is under /tmp, which the hook may treat as the scratch dir or as outside the repository. It is not proven; the owner of .omp/hooks should confirm."
    }
  ],
  "smoke": [
    {
      "recipe": "B1 Add by typing (both windows)",
      "observed": "!640 Add reviewer: focus went to an INPUT \"Search people…\". Empty list: Me @sam, Anna, Ben, Chiara, Dmitri. Typed erik: \"Searching…\", then \"Erik Lund @erik\" with an img (complete, naturalWidth 1). Log had exactly one `fixture_people_search {text: \"erik\"}`. Click: an animate-spin spinner, then Erik under Reviewers, \"Review requested\". The field was empty and focused; the stack \"SWEL\" had 2 imgs. Reviewer filter: \"Erik Lund 1\".",
      "pass": true
    },
    {
      "recipe": "B2 Keyboard (both)",
      "observed": "Me showed \"Already an assignee\" with aria-disabled=true; the active descendant started at v-2-1. ArrowDown went 2, 3, 4, then wrapped to 1; ArrowUp went 4, then 3 (Me skipped). Enter logged `{iid: 640, group: \"assignees\", action: \"add\", username: \"chiara\"}`. 1st Escape: focus on \"Add assignee\", box open. 2nd Escape: focus on the stack, box closed.",
      "pass": true
    },
    {
      "recipe": "B3 Suggestions (both)",
      "observed": "!638 Add assignee → clicked Me. Log: `{iid: 638, group: \"assignees\", action: \"add\", username: \"sam\"}`, with no new fixture_people_search line. The assignees became Ben Okafor and Sam Weller.",
      "pass": true
    },
    {
      "recipe": "B4 Remove behind a click (both)",
      "observed": "Clicking \"More for Chiara Rossi\" opened the menu \"Remove reviewer\" with no change line logged (count stayed 3). Choosing it showed spin=1, then logged `{iid: 638, group: \"reviewers\", action: \"remove\", username: \"chiara\"}`. Afterwards Dmitri's line read \"Re-request review | Changes requested | More for Dmitri Volkov\" in that order, \"2 approvals\" was unchanged, and the assignees were unchanged.",
      "pass": true
    },
    {
      "recipe": "B5 One at a time !636 (both)",
      "observed": "`press Enter ArrowDown Enter` showed spinners=2. Diff window: change lines at t=…753001 (sam) and t=…754007 (chiara), 1006 ms apart. Range window: 1005 ms apart (sam, anna).",
      "pass": true
    },
    {
      "recipe": "B6 Free and refusal (both)",
      "observed": "Adding olga as assignee showed \"GitLab did not add @olga as assignee (GitLab Free allows one assignee per merge request).\" and left the assignees unchanged (Sam, Chiara). Adding rita as reviewer showed \"Cannot assign @rita to !640\". After closing and reopening the box, both sentences were gone.",
      "pass": true
    },
    {
      "recipe": "B7 Holding the box (both)",
      "observed": "Field focused, pointer on Refresh, typing \"be\" then \"n\": box=true. Menu open with the pointer off: box=true menu=1. Escape: box=true menu=0. A click on the h2 heading: box=false.",
      "pass": true
    },
    {
      "recipe": "B8 Not editable / nobody (both)",
      "observed": "!632's box lists Chiara under Assignees and Anna under Reviewers. It has no Add or More controls, and the user-plus and ellipsis counts are 0. !637's \"No assignee or reviewer\" icon opens a box reading \"Assignees / None / Reviewers / None\" with both add buttons.",
      "pass": true
    },
    {
      "recipe": "B9 No one found (both)",
      "observed": "Typing zzz in !637's reviewer field gave \"No one found\".",
      "pass": true
    },
    {
      "recipe": "B9b Open row stays (both)",
      "observed": "Filter Reviewer: None gave 12 of 40. After adding Erik on !637: \"12 of 40 | !637 present box=true reviewers=More for Erik Lund\". Moving the pointer to Refresh did not close the box, because focus was still inside it (the field, or Add reviewer after Escape). A click on the heading closed it: \"11 of 40 | !637 gone\". Rule 9 holds. Unlike the brief, the pointer alone did not close the box.",
      "pass": true
    },
    {
      "recipe": "B10 Shots, dark and light, field and menu, both windows",
      "observed": "/tmp/mpv-shots/{diff,range}-{dark,light}-{field,menu}.png, all viewed. The field shows \"er\" with Sam Weller, Anna Berg and Erik Lund. The menu shows \"Remove assignee\". Light was set through Settings → Light, because start-fixture rejects --settings (\"app-session: unknown option --settings\").",
      "pass": true
    },
    {
      "recipe": "C1 App: Add assignee, type er",
      "observed": "calls.log had one `argv: api graphql -f query=query PeopleSearch(...) -f fullPath=taskboard/taskboard -f search=er`, with no stdin line, then an avatar api call. Erik's img was yamt-picture://localhost/erik (complete, width 4). After the click, Erik showed as assignee in the box and the stack. Ben's picture loads directly from secure.gravatar.com (width 80).",
      "pass": true
    },
    {
      "recipe": "C2–C4 App: reviewer erik, remove sam, remove chiara",
      "observed": "Erik under Reviewers with \"Review requested\". After removing sam, the assignees were only Erik. After removing chiara she was gone, and the row still showed \"1 approval\".",
      "pass": true
    },
    {
      "recipe": "C5–C6 App: anna, then ghost",
      "observed": "The suggestions included Anna. Clicking her showed \"GitLab did not add Anna Berg as assignee (GitLab Free allows one assignee per merge request).\" and the assignees stayed Erik. Ghost: my first click hit the \"Compare 1\" tab and left the page (driver slip, so there are two search=gh calls). On the redo, choosing Ghost showed \"Reviewers not able to be set: ghost\".",
      "pass": true
    },
    {
      "recipe": "C7 Fake glab stdin bodies",
      "observed": "`grep -c '^stdin:'` gives 6. In order: SetAssignees APPEND [erik], SetReviewers APPEND [erik], SetAssignees REMOVE [sam], SetReviewers REMOVE [chiara], SetAssignees APPEND [anna], SetReviewers APPEND [ghost]. Each uses `changed: mergeRequestSet…` with a one-element usernames array. `grep -c REPLACE` gives 0.",
      "pass": true
    },
    {
      "recipe": "C8 !50, app log, shots",
      "observed": "!50's box has no Add or More controls. tauri-driver.log has 6 lines like `people_change: asked GitLab to change a merge request's people iid=52 group=Assignees action=Add outcome=\"changed\"`. In order: changed, changed, changed, changed, then outcome=\"unchanged\", then outcome=\"refused\". No line contains a username. Shots: /tmp/mpv-shots/app-dark-50.png, app-dark-field.png, app-dark-menu.png, app-light-field.png, app-light-menu.png.",
      "pass": true
    }
  ],
  "environment": "Worktree /tmp/yamt-verify-people at db085be8 (removed afterwards). rustc 1.99.0, node v26.13.0, pnpm 12.0.0. WebKit fixture via just app-session (MiniBrowser, private display). Real app: cargo tauri build --debug --no-bundle, run on xvfb :3, fake glab mr-people. Scratch repo: /tmp/mpv-scratch/mpv."
}
