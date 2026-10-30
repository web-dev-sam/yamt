# MrConflictsPage

Agent output (`agent://MrConflictsPage`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsPage.md), collected 2026-10-30T23:09:04.221Z.

{
  "summary": "Each merge-request row now shows its size and a readiness icon. Conflicting rows get Resolve, the unfinished merge's row gets Continue, and a reply line appears under the row. The three new source methods are wired (tauri + fixture). The words and the action rule are in mergeRequests/internal/{size,readiness,rowAction}.ts. Page state is in the new ui/mergeRequestActions.ts, composed into the slice. The local merge is re-read on show, focus and after replies.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/size.ts",
    "frontend/src/mergeRequests/internal/size.test.ts",
    "frontend/src/mergeRequests/internal/readiness.ts",
    "frontend/src/mergeRequests/internal/readiness.test.ts",
    "frontend/src/mergeRequests/internal/rowAction.ts",
    "frontend/src/mergeRequests/internal/rowAction.test.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md",
    "frontend/src/ipc/MergeRequestSource.ts",
    "frontend/src/ipc/tauriMergeRequests.ts",
    "frontend/src/ipc/tauriResolve.test.ts",
    "frontend/src/ipc/fixtureMergeRequests.ts",
    "frontend/src/ipc/fixtureMergeRequests.test.ts",
    "frontend/src/ipc/AGENTS.md",
    "frontend/src/ui/mergeRequestActions.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/MergeRequestReadiness.vue",
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ui/MergeRequestsView.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "readiness.test.ts (blocked reasons, readiness kinds, also with one/two reasons, other)",
      "proves": "Every BlockedReason and readiness has its words and icon; conflicts with an empty also, one reason and two reasons joined by \"; \"; `other` quotes the status."
    },
    {
      "name": "size.test.ts",
      "proves": "+120 −40 · 6 files with U+2212; singular file; the title's singular and plural forms."
    },
    {
      "name": "rowAction.test.ts (8 tests)",
      "proves": "Continue on the merging row whatever its readiness; disabled while its window is open; running; no button unless conflicts; a fork wins over another merge; another merge names its iid; running; enabled."
    },
    {
      "name": "mergeRequests.test.ts: resolve/continue running→replied, double click, failures, localMerge reads",
      "proves": "running→replied plus the localMerge read after each kind of reply; a click while running sends nothing; the next click replaces; failures reported; localMerge at show and check; a failed read keeps the value."
    },
    {
      "name": "mergeRequestsText.test.ts: rowReplyText for every reply kind",
      "proves": "Every §4.5 sentence, including both alreadyMerging forms and gitRefused with and without leftovers; refused is false only for started and opened."
    },
    {
      "name": "fixtureMergeRequests.test.ts (scripted resolves, local merge, continue)",
      "proves": "The four scripted replies; findLocalMerge after a start; continue `opened` then windowOpen true; another iid `ended`."
    },
    {
      "name": "tauriResolve.test.ts",
      "proves": "The three commands get the iid; their replies and IPC failures come back unchanged."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend test / lint / fmt:check / sfc-order",
      "observed": "Test Files 243 passed (243), Tests 3395 passed (3395). Lint: oxlint + eslint printed no error. fmt:check: \"All matched files use the correct format.\" sfc-order: no output."
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "Only: mergeRequestActions.ts(75,45) '\"localMerge\"' and (87,45) '\"continue\" | \"resolve\"' are not assignable to type 'MergeRequestStep'. Those steps landed in ddc7ffd."
    },
    {
      "command": "just app-session start-fixture --name p --diff --mr list; open page; read",
      "observed": "!640: \"+12 −0 · 1 file\", readiness aria-label \"Has conflicts\". !636: no size, \"Has conflicts. Also blocked: discussions are unresolved\". !639: Resolve disabled, hover \"Resolving a fork's merge request is not supported\". Shot /tmp/mrc-shots/page-0-list.png."
    },
    {
      "command": "click \"Resolve conflicts of !640\"",
      "observed": "\"Merging main into feature/fixture-640 in a new window.\" !640 now shows \"Continue merging !640\" (enabled). Every other Resolve is disabled \"The merge of !640 is not finished in this repository\" (forks keep their hover); 0 Resolve buttons enabled. Shot page-1-resolved-640.png."
    },
    {
      "command": "click \"Continue merging !640\"",
      "observed": "While running: disabled with aria-busy. Then \"Merging main into feature/fixture-640 in a new window.\" and the button disabled \"Its merge window is already open\". Shot page-2-continued-640.png."
    },
    {
      "command": "mr-conflict-repo.sh /var/tmp/yamt-mrc; start-app --name c --diff --dir … --glab mr-conflicts (step 1)",
      "observed": "!21 \"+120 −40 · 6 files\" \"Has conflicts\"; !22 Resolve disabled with the fork hover; !27 no size, \"Ready to merge\". Shot app-1-page.png."
    },
    {
      "command": "step 2: Resolve !21; git status; rev-parse --abbrev-ref feature/due-dates@{u}",
      "observed": "\"Merging main into feature/due-dates in a new window.\" git: \"On branch feature/due-dates … You have unmerged paths.\" Upstream: origin/feature/due-dates. Other Resolves disabled \"The merge of !21 is not finished in this repository\"; after a focus, Continue is disabled \"Its merge window is already open\". Shots app-2-display-two-windows.png (--display), app-2-resolved-21.png."
    },
    {
      "command": "step 2 Continue: pkill -f 'yamt --repo /var/tmp/yamt-mrc'; focus-away/back; click Continue",
      "observed": "Continue enabled after the focus. The click answers \"Merging main into feature/due-dates in a new window.\"; a new yamt --repo process runs; unmerged src/board/card.ts. !31 shows \"Has conflicts. Also blocked: it is a draft\" with Resolve. Shot app-3-continued-display.png."
    },
    {
      "command": "step 4: pkill; start-app --name m --repo …; DISPLAY=:4 target/debug/yamt --repo /var/tmp/yamt-mrc",
      "observed": "\"yamt: the merge of !21 is already open in another yamt window\", exit=2."
    },
    {
      "command": "step 4: in m, Abort merge → confirm; git branch --show-current; git branch --list; ls .git/yamt-merge-request.json",
      "observed": "The question: \"Abort the merge of main into feature/due-dates and return to develop?\" with the note \"yamt deletes feature/due-dates, which it created for this merge.\" (app-4-abort-question.png). The window is gone. Branch: develop. Branches: develop, main. Record: No such file. After a focus, the page offers Resolve for !21 and !23 again."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (web, 8 files): 690 killed, 17 survived, 18 no coverage, score 95.17%",
    "survivors": [
      "src/ipc/fixtureMergeRequests.ts:144 `localMerge.kind !== \"merging\"`→false — equivalent: free has no iid, so `undefined !== iid` still answers ended; the check exists for TS narrowing",
      "src/mergeRequests/internal/rowAction.ts:48 `localMerge.kind === \"merging\"`→true — equivalent: `undefined === row.iid` is false",
      "src/ipc/fixtureMergeRequests.ts:62,63 FIXTURE_TARGET / WINDOW_FAILED_MESSAGE \"\" — wiring: module constants not re-evaluated under vitest (#732); the tests assert both values",
      "default `never` arms in readiness.ts:84, mergeRequestActions.ts:53, mergeRequestsText.ts:177,201,219 (no coverage) — gate-covered: unreachable by type (vue-tsc)"
    ]
  },
  "acceptance_not_run": [
    "typecheck is not green in this worktree: only the MergeRequestStep literals fail, and those steps landed in ddc7ffd. The verifier checks it on the merged tree.",
    "The real-app build skipped vue-tsc for that reason: `vite build --mode tauri`, then `cargo tauri build --debug --no-bundle --config '{\"build\":{\"beforeBuildCommand\":\"\"}}'`. Steps 3, 5, 6 and 7 are left to the verifier."
  ],
  "deviations_from_brief": [
    "New ui/mergeRequestActions.ts (granted): it holds RowReply, RowActing, createRowActions and the actions/localMerge state, composed into the slice; mergeRequests.ts stays at 289 lines and there is no text↔state import cycle. The contract's RowReply and RowActing live there, not in mergeRequests.ts. The granted test file was not created: the tests are in mergeRequests.test.ts.",
    "tree.md needs rows for ui/mergeRequestActions.ts, ui/MergeRequestReadiness.vue and mergeRequests/internal/{size,readiness,rowAction}.ts (docs keeper); map-check fails on them until then.",
    "The resolve, continue and localMerge problem steps are used as R1 landed them. A failed findLocalMerge is reported and keeps the last value.",
    "rowReplyText reuses openReplyText's identical sentences for the GitLab refusals notOpen, noRemote and glab*.",
    "Fixture: continue also pauses 1 s; any resolve except !624 sets the local merge.",
    "Readiness tones (my choice): ready success-signal, conflicts problem-error, rebase problem-warning, checking/blocked fg-muted. The action column is a fixed w-7 so the buttons line up.",
    "knip still lists BlockedReason, ChangeSize and BranchBefore as unused in ipc/index.ts and mergeRequestDomain.ts (R1's files)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestActions.ts:90",
      "risk": "In the real app, the read right after Resolve came before the new window claimed its lock, so Continue showed enabled until the next focus. A click then answers alreadyOpen: harmless, but the 'disabled while open' state lags."
    },
    {
      "location": "frontend/src/ui/MergeRequestsView.vue:52",
      "risk": "localMerge is re-read only on the window `focus` event (seen working in WebKitGTK). A merge window closed while the compare window keeps focus is not noticed until the next focus or reply."
    },
    {
      "location": "/var/tmp/yamt-mrc",
      "risk": "The smoke repository is left on develop after the abort; bash-guard blocks `rm -rf` there, so the verifier needs a fresh directory."
    }
  ]
}
