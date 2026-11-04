# Release068Verify

Agent output (`agent://Release068Verify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/Release068Verify.md), collected 2026-11-04T08:05:33.071Z.

{
  "gate": "fail",
  "failures": [
    {
      "step": "just check → fmt-check (frontend oxfmt --check)",
      "excerpt": "$ oxfmt --check\nChecking formatting...\n\nsrc/ui/MergeRequestLinks.vue (202ms)\n\nFormat issues found in above 1 files. Run without `--check` to fix.\nFinished in 1280ms on 800 files using 24 threads.\n[ELIFECYCLE] Command failed with exit code 1.\nerror: recipe `frontend` failed on line 184 with exit code 1\n(gate stopped at its first recipe; clippy…hooks-test did not run. The file is clean in git — only .omp/run/slices.json is modified — and was last changed by the owner's icon fix 3012182c, so that commit is the likely source of the formatting problem.)"
    },
    {
      "step": "recipe 4a: !62 people box with add buttons beside Assignees/Reviewers",
      "excerpt": "With the --glab mr-links scenario, !62 shows only a non-interactive svg[role=img][aria-label=\"No assignee or reviewer\"]. Hovering and clicking it opened nothing, and no 'Add assignee' / 'Add reviewer' button exists in the DOM. Cause: MergeRequestPeople.vue:101 `editable = props.row.mayRerequest`, and !62 in tests/glab/mr-links/graphql-page-1.json has no userPermissions (keys: conflicts, createdAt, description, detailedMergeStatus, draft, iid, sourceProjectId, targetBranch, targetProjectId, title). The scenarios that do have permissions are mr-people, mr-discussions, mr-review-mode, mr-row-details and ci-job-log. The brief's step names a scenario that cannot show this feature."
    }
  ],
  "smoke": [
    {
      "recipe": "readmer check",
      "observed": "READMER=0 (exit 0)",
      "pass": true
    },
    {
      "recipe": "scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt",
      "observed": "LIC=0, DIFF=0, no diff output",
      "pass": true
    },
    {
      "recipe": "cargo tauri build --bundles deb; bsdtar control; target/release/yamt --version",
      "observed": "Bundling yamt_0.6.8_amd64.deb … Finished 1 bundle (6.74 MiB); -rw-r--r-- 7072358 Nov 4 09:03 target/release/bundle/deb/yamt_0.6.8_amd64.deb; control: 'Version: 0.6.8'; --version: 'yamt 0.6.8'",
      "pass": true
    },
    {
      "recipe": "4a start-app --binary target/release/yamt --diff --glab mr-links --mr: rows at once",
      "observed": "Body text right after start: 'Merge requests … 6 of 6 merge requests', rows !62 Snooze a reminder, !61, !60, !59, !58, !57",
      "pass": true
    },
    {
      "recipe": "4a !62 people box add buttons",
      "observed": "No people box: only the static 'No assignee or reviewer' icon, and no Add assignee/Add reviewer buttons (see failures: the mr-links scenario has no userPermissions)",
      "pass": false
    },
    {
      "recipe": "4b !62 info button → description panel, Escape closes",
      "observed": "I clicked 'Show description' nth 0 and the panel showed '!62 Snooze a reminder / Closes #12 of &3. / task #13 / needs other/lib#5 and web#6 …'. After Escape the only aside left was Tabs and every Show description had aria-expanded=false.",
      "pass": true
    },
    {
      "recipe": "4c hover !62 links button: Epics 3, Issues 6, Commits 4; icons centred",
      "observed": "Box: Epics &3, &4 Closed, design&2 (3); Issues #12, #13, other/lib#5, web#6, secret/vault#9, #99 (6); Commits fa3335f3, 6ea97d8c, a1b2c3d4…e5f6a7b8, secret/vault@0badc0de (4). Private-display screenshot /tmp/yamt-rel-0.6.8/links-box.png: the epic, issue and commit icons sit vertically centred on their text lines.",
      "pass": true
    },
    {
      "recipe": "4d no CSP error in app log",
      "observed": "Before stop, grep -ril 'content.security|csp' over the session folder (logs/display, tauri-driver.log, xvfb.log; 26 lines total) and home-1 found nothing (exit 1).",
      "pass": true
    },
    {
      "recipe": "5 stop and cleanup",
      "observed": "stop: {\"stopped\":\"r68-mr\",\"session\":\"ended\",procs tauri-driver and xvfb 'stopped', folder removed}. pgrep for release yamt, Xvfb :3, WebKitWebDriver, tauri-driver and the private bus found nothing (exit 1). /tmp/yamt-rel68-mr removed, and no /tmp/yamt-rel68-* remains.",
      "pass": true
    }
  ],
  "environment": "HEAD 8672280a (working tree: only .omp/run/slices.json modified); rustc 1.99.0, node v26.13.0, pnpm 12.0.0, tauri-cli 2.12.4; private display :3 via app-session. Only the owner can check: macOS and Windows test runs and builds (CI) and the GitLab playground checks still open on the board. No mutation run (VF7)."
}
