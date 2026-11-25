# SidebarNextFileFinal

Agent output (`agent://SidebarNextFileFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/SidebarNextFileFinal.md), collected 2026-11-25T11:36:54.231Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "just check (repo root, HEAD c58b82be)",
      "observed": "EXIT 0, wall 49 s. Rust nextest: 'Summary [14.173s] 1588 tests run: 1588 passed, 65 skipped'. Vitest: 'Test Files 316 passed (316)'. 'arch-check: ok', 'map-check: ok'. hooks-test: tests 18, pass 18, fail 0.",
      "pass": true
    },
    {
      "recipe": "build: cargo tauri build --debug --no-bundle",
      "observed": "Finished `dev` profile ... Built application at: /home/wds/Projects/yamt/target/debug/yamt",
      "pass": true
    },
    {
      "recipe": "§1 setup /tmp/snr; just app-session start-app --name snr --range main...feature --repo /tmp/snr",
      "observed": "numstat a 1/0, b/x 2/0, b/y 3/1, c 4/0, z/w 5/2. The window opened in list view: a, b/x, b/y, c, z/w. A real click on 'View as tree' gave the rows b[open] x.txt y.txt z[open] w.txt a.txt c.txt. Initial total +15 −3 = Σ rows.",
      "pass": true
    },
    {
      "recipe": "§1 tree: show b/y.txt, Reviewed",
      "observed": "y.txt selected (total +14 −3, because a.txt had been reviewed earlier: an unplanned click on Reviewed while a.txt was shown selected c.txt, which is a's next file in the tree) → Reviewed → 'M w.txt +5 −2' selected (z/w, not c.txt), total +11 −2.",
      "pass": true
    },
    {
      "recipe": "§1 tree: close folder z, show b/y.txt, unmark, Reviewed",
      "observed": "After clicking z the rows read z[false] and w.txt was hidden. Clicked y, Reviewed (unmark): total +14 −3. Reviewed again → z[true], 'M w.txt +5 −2' selected, total +11 −2.",
      "pass": true
    },
    {
      "recipe": "§1 tree: show c.txt, Reviewed → wrap",
      "observed": "Clicked c.txt (unreviewed), Reviewed → 'M x.txt +2 −0' (b/x, the first unreviewed tree row) selected, total +11 −2 → +7 −2. Shot /tmp/snr-wrap.png (page) was taken after one more Reviewed (x → w selected, +5 −2).",
      "pass": true
    },
    {
      "recipe": "§1 list: show a.txt, Reviewed",
      "observed": "'View as list': a, b/x, b/y, c, z/w. Show a.txt (reviewed), Reviewed to unmark: +5 −2 → +6 −2. Reviewed → 'M z/w.txt +5 −2' selected (next unreviewed in list order; b/x, b/y and c were already reviewed), total +5 −2.",
      "pass": true
    },
    {
      "recipe": "§1 total: sums, drops, unmark, all reviewed, colour, title, shots",
      "observed": "Each mark dropped the total by that file's counts; unmark restored them. All five reviewed: total element null (/tmp/snr-all.png). <span role=group title=\"left to review\"> with text-fg-muted children, between 'Files' and 'View as tree'. Dark: rgb(129,126,141) = other muted element. Light: rgb(115,118,124) = muted. Shots /tmp/snr-dark.png ('+6 −2' grey) and /tmp/snr-light.png ('+15 −3' grey), both viewed.",
      "pass": true
    },
    {
      "recipe": "§2 merge tree: just app-session start-app --name snm --repo /tmp/snm",
      "observed": "ls-files -u: a.txt b/x.txt c.txt. 'View as tree' gave the rows b, x.txt, a.txt, c.txt. Show x.txt, 'Mark resolved' → dialog '1 unresolved conflict still remains' → 'Save Current Result' → rows 'x.txt resolved', a.txt selected (not c.txt). ls-files -u is now a.txt c.txt.",
      "pass": true
    },
    {
      "recipe": "§2 merge list on fresh repo /tmp/snm2",
      "observed": "List rows a.txt, b/x.txt, c.txt. Show a.txt, Mark resolved, Save Current Result → 'a.txt resolved', b/x.txt selected. ls-files -u is now b/x.txt c.txt.",
      "pass": true
    },
    {
      "recipe": "§2 no total in the merge heading",
      "observed": "[title='left to review'] was absent (total:null) in snm and snm2 in every read. The Files h2 parent text was 'Files' only.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28), node v26.13.1, pnpm 12.0.0; Linux 7.3.5-arch1-1. app-session ran on a private Xvfb :3 with tauri-driver, using the debug build target/debug/yamt rebuilt at c58b82be. All sessions are stopped. Scratch repos are /tmp/snr, /tmp/snm and /tmp/snm2."
}
