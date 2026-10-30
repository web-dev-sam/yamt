# MrConflictsDesign

Agent output (`agent://MrConflictsDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T19-31-04-168Z_01a18e4b-5568-7113-b48d-cb43e7b9c05a/MrConflictsDesign.md), collected 2026-10-30T21:07:32.946Z.

{
  "options": [
    {
      "name": "A: new crate yamt-local-merge owns start, record, restore, push",
      "summary": "New crate crates/local-merge (depends only on gitio) runs rule 4's checks, the fetch into origin/<b>, `checkout -B`, `merge --no-ff --no-commit`, and the restore and push. Before the first change it writes a synced record to <git dir>/yamt-merge-request.json. merge-requests gains only prepare_resolve (asks GitLab for the branches). src-tauri composes the two and starts `yamt --repo`. The merge window reads the record on every list, so Abort restores even after a restart.",
      "visions": [
        2,
        3,
        4,
        1
      ],
      "cost": "About 5,500 lines over 6 builds. One new crate, plus a PM1 rule and a §7 entry. Six IPC commands are new or changed. The web typecheck is red between the app and window commits, in window-owned files only."
    },
    {
      "name": "B: no new crate; merge-requests starts the merge, session finishes it",
      "summary": "merge-requests runs every git step and writes the record. A typed line file in gitio holds it. session reads it once at open, restores inside abort_operation and pushes. No arch-check change.",
      "visions": [
        5
      ],
      "cost": "merge-requests takes on a second job, writing the user's refs (#117 growth harm). session would know about GitLab. The record format is spread over three crates. A record written after the window opened is never seen."
    },
    {
      "name": "C: no record; git's reflog is the before-state",
      "summary": "Every ref update carries GIT_REFLOG_ACTION=\"yamt resolve !N\". Abort parses HEAD's reflog and the branch's reflog back to yamt's first entry to find the old HEAD and whether the branch was created or moved.",
      "visions": [
        2
      ],
      "cost": "Rule 7 fails by construction when logAllRefUpdates is off or the reflog has expired. It relies on parsing reflog messages and leaves nothing typed until parsed (against visions 1 and 4)."
    }
  ],
  "recommendation": "Option A. One crate, yamt-local-merge, owns the merge yamt starts in the user's checkout: the record's writer and every reader in one place (vision 2). arch-check keeps it on gitio only, and merge-requests keeps reading GitLab only (vision 3). Refusals, leftovers and record liveness are sum types plus one pure function (vision 4). A plain `yamt --repo` finds the record, so a restart, Abort and Continue → Push need no new flag or mode. Cost: about 5.5k lines in 6 builds, a new PM1 rule, and docs updates for architecture §3.2/§3.5/§3.10 and the IPC skill.",
  "design_doc": "docs/slices/briefs/mr-conflicts-design.md",
  "briefs_written": [
    "docs/slices/briefs/mr-conflicts-git.md",
    "docs/slices/briefs/mr-conflicts-gitlab.md",
    "docs/slices/briefs/mr-conflicts-local.md",
    "docs/slices/briefs/mr-conflicts-app.md",
    "docs/slices/briefs/mr-conflicts-window.md",
    "docs/slices/briefs/mr-conflicts-page.md"
  ],
  "slice_graph": "git and gitlab run in parallel first. local starts after git; before it, the orchestrator adds the crates/local-merge member and the yamt-local-merge workspace dep to the root Cargo.toml. app needs gitlab and local; regenerate bindings after app. window follows app: until it lands, typecheck is red only in window-owned files, which window repairs first. page follows window (it uses ui/leftoverText.ts) and adds window's AGENTS.md sentences. page's commit wires the feature together and starts the smoke pass in design §4.7.",
  "open_questions": [
    "If the merge window is closed before the merge is finished, the row's Resolve stays disabled and the user must run yamt in that folder to continue or abort. Should the row being merged offer \"Continue merging !12\", which reopens the merge window?",
    "GitLab reports one status per MR. A draft, or an MR with open discussions, that also has conflicts may show \"Blocked\" and so get no Resolve button. Should such rows get the button too (GitLab's separate conflicts flag), so \"Blocked\" and \"Resolve conflicts\" appear side by side?",
    "Resolving updates your origin/main and origin/feature/x to GitLab's, as git fetch would. Abort restores your own branches and checkout but leaves those two where the fetch put them. Is that acceptable, or should Abort move them back too?"
  ]
}
