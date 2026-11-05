# MrMentionsSmoke

Agent output (`agent://MrMentionsSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsSmoke.md), collected 2026-11-05T10:06:19.117Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "B7 finding: after a Ctrl+Enter send, typing `@an` in the emptied reply field opens no list (dark 2 of 2 tries, light 0 of 1)",
      "excerpt": "flaky: in the dark run, after Ctrl+Enter with the list open the field read {v:\"\",list:null,ss:0,focus:true}. `@an` typed after 1.5 s, read 2 s later: {\"logs\":[],\"v\":\"@an\",\"list\":null,\"ss\":3,\"focus\":true}: no fixture_people_search and no list. Typing ` @b` then opened Ben and Anna. This happened twice in dark at 1600x1000. In light, `@an` typed 1 s after the send opened [\"*AB|Anna Berg|@anna\"] and logged one search. My guess [INFERENCE]: close() on send dismisses word start 0, and a new `@` at 0 counts as that dismissed word. Owner: mr-mentions-list (mergeRequestMentions.ts)."
    },
    {
      "step": "B start: start-fixture --settings '{\"theme\":\"light\"}'",
      "excerpt": "app-session: unknown option --settings\nerror: recipe `app-session` failed on line 89 with exit code 1\n(For the light pass I set <html data-theme=\"light\"> live.)"
    }
  ],
  "smoke": [
    {
      "recipe": "B1 bare @ (fixture --diff --mr list --open-mr, !637 d01 opened by Shift over its row)",
      "observed": "\"People to mention\": [\"*DV|Dmitri Volkov|@dmitri\",\"SW|Sam Weller|@sam\",\"AB|Anna Berg|@anna\",\"BO|Ben Okafor|@ben\"], each person once, the first selected (activedescendant v-0-0). Each line has a picture or initials, the name, and a muted @username (rgb(129,126,141)). logs []. Light: the same.",
      "pass": true
    },
    {
      "recipe": "B2 search an",
      "observed": "One \"mergeRequests.fixture_people_search {text: \\\"an\\\"}\"; options [\"*AB|Anna Berg|@anna\"] with the img loaded. The same in dark and light.",
      "pass": true
    },
    {
      "recipe": "B3 under the caret (lineHeight 20px, paddingTop 4px, 13px/20px system-ui)",
      "observed": "`@an` on line 1: list top 874.5 vs line bottom 874.5, left 617 vs @ x 617. `x\\ny\\n@an`: top 914.5 vs 914.5, left 617. `hello @an`: top 874.5, left 650.3125 vs 617 + measureText(\"hello \") 33.319 = 650.319. Measured on the outer absolute list box.",
      "pass": true
    },
    {
      "recipe": "B4 inside the panel (12 lines, then @an)",
      "observed": "List [617,918.5,785.42,956.5] inside panel [595,194,1235,962].",
      "pass": true
    },
    {
      "recipe": "B5 pick and undo, click",
      "observed": "Down, Enter: {v:\"@anna \",ss:6,list:null}. execCommand(\"undo\"): {v:\"@an\",ss:0,se:3,list:null}, one step (the next undo restores the text before). A click on Anna's option: {v:\"@anna \",ss:6,focus:true,list:null}. Light: the same.",
      "pass": true
    },
    {
      "recipe": "B6 Escape (RK73)",
      "observed": "First Escape: {dialog:true,v:\"@an\",list:null,focus:true}. Second: dialog false, page still the list (\"40 of 40 merge requests\", ?diff&mr=list&open=mergeRequests).",
      "pass": true
    },
    {
      "recipe": "B7 send keys",
      "observed": "Ctrl+Enter with the list open: one \"fixture_write {kind: \\\"comment\\\", iid: 637, discussion: …0001}\", then v \"\" and list null (dark and light). Shift+Enter gave \"@an\\n\" with list null. Tab gave \"@an\\n@anna \" ss 10. See failures for the list missing after a send.",
      "pass": true
    },
    {
      "recipe": "B8 rule 6, NOT RUN item: pointer press on !637 people opener and Add assignee with the mention list open",
      "observed": "The 2400x1200 run got a 1700x962 viewport, and the panel still covered the opener, so I scrolled the list 130 px. The opener at (1151,171) was free. With Anna listed, a click on the opener opened the people box and closed the thread panel. A click on Add assignee: \"Search people\" \"\", options Me@sam, Dmitri, Anna, Ben, Chiara, no mention list, no search. `er`: one search \"er\", Sam, Anna, Erik Lund. Two Escapes closed it. I reopened d01 and clicked the field: [\"*AB|Anna Berg|@anna\"], no Erik, no new search.",
      "pass": true
    },
    {
      "recipe": "B9 Preview / Write",
      "observed": "Preview: no listbox, field wrapper display none. Write: {v:\"@an\",ss:3,focus:true,list:null}. ArrowLeft: no list. End, then ` @b`: [\"*BO|Ben Okafor|@ben\",\"AB|Anna Berg|@anna\"].",
      "pass": true
    },
    {
      "recipe": "B10 shots",
      "observed": "/tmp/mmv-scratch/shots/b2-dark.png, /tmp/mmv-scratch/shots/b2-light.png (viewed: Anna Berg with a muted @anna under `@an`, inside the panel), b8-people-er-light.png.",
      "pass": true
    },
    {
      "recipe": "C1 local-conflicts-repo.sh /tmp/mmv-scratch/mmv; cargo tauri build --debug --no-bundle",
      "observed": "\"/tmp/mmv-scratch/mmv is on develop; GitLab holds the head refs of !41–!48\"; \"Finished `dev` profile … Built application at: /home/wds/Projects/yamt/target/debug/yamt\"",
      "pass": true
    },
    {
      "recipe": "C2 real app --glab mr-threads --mr, !90 d01, argv: counts",
      "observed": "Start 12. `@`: 12, list Dmitri, Sam, Ben, Anna. `an`: 13, \"argv: api graphql … autocompleteUsers(search: $search) … -f search=an\", [\"*AB|Anna Berg|@anna\"] img yamt-picture://localhost/anna (naturalWidth 16). Down, Enter: \"@anna \", still 13. `@a`, pause, `n`, pause, `n`, pause: 14, 15, 16 = search=a, search=an, search=ann. Under Anna, a muted (rgb(129,126,141)) status line: \"fake glab: the scenario has no answer graphql-people-ann.json\". Light: the same counts.",
      "pass": true
    },
    {
      "recipe": "C3 shots; C4 stop",
      "observed": "/tmp/mmv-scratch/shots/c-an-dark.png, c-ann-note-dark.png (viewed: the note under Anna), c-an-light.png. Both stops reported \"session\":\"ended\".",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0, node v26.13.0, pnpm 12.0.0, HEAD 2542f2b5. WebKitGTK MiniBrowser via just app-session on a private display (:3 for the app). start-fixture --size 2400x1200 gave a 1700x962 viewport. start-fixture has no --settings, so the light theme was set live."
}
