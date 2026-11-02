# LocalConflictsSmoke

Agent output (`agent://LocalConflictsSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T17-45-19-979Z_01a19d5d-9b6b-71a4-8899-91c0c235c4e6/LocalConflictsSmoke.md), collected 2026-11-02T18:48:02.798Z.

{
  "gate": "not-run",
  "failures": [],
  "smoke": [
    {
      "recipe": "B. start-fixture --name lc --diff --mr local --size 1600x1000; Merge requests page; read now and after 1.5 s",
      "observed": "Read right away: !640: Has conflicts ;; !638: Ready to merge ;; !635: GitLab is still checking whether it can be merged. Read after 1.5 s: !640: No conflicts (checked locally). GitLab has not checked the rest yet ;; !638: Has conflicts ;; !635: No conflicts (checked locally). GitLab has not checked the rest yet. The shot /tmp/lc-verify/B-fixture.png (from the page) shows the muted dashed-ring check icon on !640 and !635. Stopped.",
      "pass": true
    },
    {
      "recipe": "C. local-conflicts-repo.sh /tmp/lc-verify/lc; cargo tauri build --debug --no-bundle; start-app --diff --dir /tmp/lc-verify/lc --glab local-conflicts",
      "observed": "Log line: INFO yamt_merge_requests::check: local conflict check summary=9 rows: 5 merges, 1 refs fetched, 0 remembered, 1 moving, 1 kept. Labels: !49 GitLab is still checking whether it can be merged; !48 !45 !43 !41 No conflicts (checked locally). GitLab has not checked the rest yet; !47 Has conflicts. Also blocked: discussions are unresolved; it is a draft; !46 Needs a rebase; !44 Ready to merge; !42 Has conflicts.",
      "pass": true
    },
    {
      "recipe": "C. Refresh once; log; dark and light shots",
      "observed": "The labels after Refresh are the same. Second log line: local conflict check summary=9 rows: 0 merges, 0 refs fetched, 7 remembered, 1 moving, 1 kept (no merge ran). Shots: /tmp/lc-verify/C-dark.png and /tmp/lc-verify/C-light.png (light theme set via Settings → Light; the labels read again were the same). No WARN or ERROR lines in the log.",
      "pass": true
    },
    {
      "recipe": "C. Four snapshots compared before and after",
      "observed": "cmp before.txt after.txt -> IDENTICAL. Contents: e5e4e875... refs/heads/develop; 1732ffd1... refs/heads/main; status --porcelain empty; ref: refs/heads/develop; ls: cannot access '.git/FETCH_HEAD': No such file or directory. App stopped.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0; node v26.13.0; pnpm 12.0.0; main HEAD ac5cfcc1; private display (Xvfb :3 for the app); steps A and D not run"
}
