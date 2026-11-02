# LocalConflictsFinal

Agent output (`agent://LocalConflictsFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T17-45-19-979Z_01a19d5d-9b6b-71a4-8899-91c0c235c4e6/LocalConflictsFinal.md), collected 2026-11-02T19:03:14.379Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "A. just check (repo root, HEAD 4dbd879f), run once",
      "observed": "Ends with golden 'ok vueuse-use-magic-keys', sfc-order, hooks-test 'ℹ tests 18 ℹ pass 18 ℹ fail 0'; EXIT 0; 60.95 s.",
      "pass": true
    },
    {
      "recipe": "B. start-fixture --name lc --diff --mr local --size 1600x1000; Merge requests; read now and after 1.5 s; shot; stop",
      "observed": "Right away: !640: Has conflicts ;; !638: Ready to merge ;; !635: GitLab is still checking whether it can be merged. After 1.5 s: !640: No conflicts (checked locally). GitLab has not checked the rest yet ;; !638: Has conflicts ;; !635: No conflicts (checked locally). GitLab has not checked the rest yet. Page shot /tmp/lc-final/B-fixture.png: muted dashed-ring check on !640 and !635. Stopped.",
      "pass": true
    },
    {
      "recipe": "C. local-conflicts-repo.sh /tmp/lc-final/lc; cargo tauri build --debug --no-bundle; start-app --diff --glab local-conflicts; labels",
      "observed": "Log: INFO yamt_merge_requests::check: local conflict check summary=9 rows: 5 merges, 1 refs fetched, 0 remembered, 1 moving, 1 kept. Labels: !41 !43 !45 !48 No conflicts (checked locally). GitLab has not checked the rest yet; !42 Has conflicts; !44 Ready to merge; !46 Needs a rebase; !47 Has conflicts. Also blocked: discussions are unresolved; it is a draft; !49 GitLab is still checking whether it can be merged.",
      "pass": true
    },
    {
      "recipe": "C. Refresh once; second log line; dark and light shots",
      "observed": "Labels after Refresh were the same. Second line: local conflict check summary=9 rows: 0 merges, 0 refs fetched, 7 remembered, 1 moving, 1 kept (no merge ran). Shots: /tmp/lc-final/C-dark.png, /tmp/lc-final/C-light.png (Settings → Light, then the page reopened; labels the same, no new check line). The log has no yamt WARN or ERROR lines.",
      "pass": true
    },
    {
      "recipe": "C. four snapshots before vs after",
      "observed": "cmp lc-before.txt lc-after.txt → IDENTICAL (develop e5e4e875, main 1732ffd1; status empty; ref: refs/heads/develop; ls: cannot access '.git/FETCH_HEAD': No such file or directory). App stopped.",
      "pass": true
    },
    {
      "recipe": "D. fresh lc2, .git/fake-gitlab.git moved away before start; labels, problem box, log",
      "observed": "GitLab's labels: !41 Has conflicts; !42 !44 Ready to merge; !43 !45 !48 !49 GitLab is still checking whether it can be merged; !46 Needs a rebase; !47 Blocked: discussions are unresolved. Shot /tmp/lc-final/D.png: no problem box. One line: WARN yamt_merge_requests::check: local conflict check summary=9 rows: 0 merges, 0 refs fetched, 0 remembered, 0 moving, 9 kept; ls-remote: fatal: '…/lc2/.git/fake-gitlab.git' does not appear to be a git repository. Snapshots IDENTICAL.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.1; node v26.13.0; pnpm 12.0.0; HEAD 4dbd879f; B: MiniBrowser through just webdriver on a private display; C/D: debug build with pages on Xvfb :3. No mutants run."
}
