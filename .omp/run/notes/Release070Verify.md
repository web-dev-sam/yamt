# Release070Verify

Agent output (`agent://Release070Verify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/Release070Verify.md), collected 2026-11-05T16:44:57.397Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "1. just check (once, at e77be984, clean tree) + readmer check",
      "observed": "`git status --short` was empty. just check exited 0 in 81 s. The last steps showed golden ok for all 10 cases, sfc-order passing, and hooks-test 'tests 18 pass 18 fail 0'. readmer check exited 0.",
      "pass": true
    },
    {
      "recipe": "2. scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt",
      "observed": "The script exited 0. git diff --exit-code exited 0, with no diff.",
      "pass": true
    },
    {
      "recipe": "3. cargo tauri build --bundles deb",
      "observed": "EXIT 0: 'Bundling yamt_0.7.0_amd64.deb ... Finished 1 bundle (7.01 MiB)'. target/release/bundle/deb/yamt_0.7.0_amd64.deb is 7346714 bytes. bsdtar on control.tar.gz ./control reads 'Version: 0.7.0'. target/release/yamt --version prints 'yamt 0.7.0'.",
      "pass": true
    },
    {
      "recipe": "4a. local-conflicts-repo.sh /tmp/yamt-rel70-mr; start-app r70-mr --binary target/release/yamt --diff --glab mr-threads --mr --home .../home-1",
      "observed": "The session started on private display :3. Read straight away, the page showed '2 of 2 merge requests', with rows !91 'Lock the archive board' and !90 'Lane order on the board'.",
      "pass": true
    },
    {
      "recipe": "4b. Discussions view, button outlined, d01 formatting, pictures",
      "observed": "After clicking, the list was gone and the header read '4 of 16 wait for you' (16 articles, from !91 and !90). The Discussions button had aria-pressed=true, a background of rgba(233,228,254,0.08) and a solid border rgb(119,76,213), so it was outlined, not filled. In light it had a transparent background and an outline. d01 (Anna Berg, !90 src/board.ts:12) showed strong 'lane order', code 'sortLanes()', the link 'the docs' (https://docs.example/board), a code block and an Option/Cost table. Its writers' pictures loaded from yamt-picture://localhost/anna, sam and dmitri (naturalWidth 16 or 32).",
      "pass": true
    },
    {
      "recipe": "4c. Shift over d01 expands; @an lists Anna; Preview 'Thanks' local",
      "observed": "With the pointer over d01, Shift set aria-expanded=true. The whole thread appeared inline (Sam, Dmitri and Anna comments, a Pending draft) with a reply textarea. Typing '@an' brought up the option 'AB Anna Berg @anna' (glab PeopleSearch search=an). Pressing Preview on 'Thanks' showed 'Thanks' at once. The fake glab log had 0 lines containing 'markdown', and the app log had event=mergeRequests.preview_local blocks=1.",
      "pass": true
    },
    {
      "recipe": "4d. Add comment 'Thanks' -> one POST notes line",
      "observed": "calls.log line 46: 'argv: api --include --method POST projects/taskboard%2Ftaskboard/merge_requests/90/discussions/0000000000000000000000000000000000000001/notes --input -'. It is the only /notes line (count 1). The app log reads 'wrote to a merge request's discussion iid=90 kind=comment outcome=sent status=201'.",
      "pass": true
    },
    {
      "recipe": "4e. Back to list; dark + light screenshots; no CSP error",
      "observed": "'Back to list' brought back '2 of 2 merge requests', with 0 articles and Discussions aria-pressed=false. Dark private-display shot (d01 expanded): /tmp/yamt-rel-0.7.0/discussions-a.png. The Settings button is hidden on the MR page, so for the light shot I started a second session, r70-mrl, with --settings theme light and --home .../home-2: Discussions, then Shift over d01 (data-theme=light, expanded) gave /tmp/yamt-rel-0.7.0/discussions-light.png. Neither app log had a CSP, content-security or 'refused' match. The only warning was 'MESA-EGL: warning: DRI3 error: Could not get DRI3 device'.",
      "pass": true
    },
    {
      "recipe": "5. Stop; no leftovers; remove /tmp/yamt-rel70-*",
      "observed": "Both sessions stopped: tauri-driver and xvfb stopped, children [], session folders removed. Afterwards, pgrep for Xvfb, tauri-driver, WebKitWebDriver, r70, dbus-daemon.*yamt and target/release/yamt matched nothing (exit 1). /tmp/yamt-rel70-mr has been removed.",
      "pass": true
    }
  ],
  "environment": "Arch Linux x64, kernel 7.2.11; rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.0; pnpm 12.0.0; tauri-cli 2.12.4; private Xvfb display. No mutation run (VF7). Only the owner can check: macOS/Windows test runs and builds (CI only) and the GitLab playground checks still open on the board."
}
