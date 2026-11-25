# SidebarNextFileSmoke

Agent output (`agent://SidebarNextFileSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/SidebarNextFileSmoke.md), collected 2026-11-25T11:30:33.679Z.

{
  "gate": "not-run",
  "failures": [],
  "smoke": [
    {
      "recipe": "build: cargo tauri build --debug --no-bundle",
      "observed": "Finished `dev` profile ... Built application at: /home/wds/Projects/yamt/target/debug/yamt (HEAD 5cdb2228)",
      "pass": true
    },
    {
      "recipe": "§1 setup: /tmp/snr main...feature; just app-session start-app --name snr --range main...feature --repo /tmp/snr",
      "observed": "numstat a +1−0, b/x +2−0, b/y +3−1, c +4−0, z/w +5−2. Tree rows: [b] x.txt, y.txt, [z] w.txt, a.txt, c.txt = tree order b/x,b/y,z/w,a,c. Window opened in list view; switched with real click on 'View as tree'.",
      "pass": true
    },
    {
      "recipe": "§1 tree: show b/y.txt, Reviewed",
      "observed": "before: selected '*M y.txt +3 −1', total +15 −3; after Reviewed: selected '*M w.txt +5 −2' (z/w, not c.txt), total +12 −2.",
      "pass": true
    },
    {
      "recipe": "§1 tree: close folder z, show b/y.txt, unmark, Reviewed",
      "observed": "after clicking z: row '[dir false]z', w.txt hidden. Show y (reviewedPressed true), unmark → total +15 −3, pressed false. Reviewed → rows show '[dir true]z', '*M w.txt +5 −2' selected, total +12 −2.",
      "pass": true
    },
    {
      "recipe": "§1 tree: show c.txt, Reviewed → wrap",
      "observed": "selected c.txt, total +12 −2; Reviewed → '*M x.txt +2 −0' (b/x, first unreviewed tree row) selected, total +8 −2. Shot /tmp/snr-wrap.png: editor header 'b/x.txt', '2 of 5 reviewed', heading '+8 −2'. (Incidentally earlier: a.txt Reviewed in tree → c.txt, the tree-next.)",
      "pass": true
    },
    {
      "recipe": "§1 list: show a.txt, Reviewed",
      "observed": "'View as list' clicked; rows a, b/x, b/y(✓), c(✓), z/w. Show a.txt → Reviewed → '*M b/x.txt +2 −0' selected (next unreviewed in list order), total +8 −2 → +7 −2.",
      "pass": true
    },
    {
      "recipe": "§1 total: sums, unmark, all reviewed, colour, title, shots",
      "observed": "Initial total +15 −3 = Σ rows. Drops per mark: a −(1,0), y −(3,1), c −(4,0), a −(1,0), x→+5 −2, z/w → total element absent (null). Unmark y restored +15 −3. Element: <span role=group title=\"left to review\" aria-label=\"left to review\"> between h2 'Files' and 'View as tree' button; children class text-fg-muted. Computed colour dark rgb(129,126,141) = other .text-fg-muted element rgb(129,126,141); light theme rgb(115,118,124) = muted rgb(115,118,124). Shots /tmp/snr-dark.png (total +7 −2 list), /tmp/snr-light.png (light, '+7 −2' muted grey left of list icon), /tmp/snr-all.png (none).",
      "pass": true
    },
    {
      "recipe": "§2 merge tree: just app-session start-app --name snm --repo /tmp/snm; show b/x.txt, Mark resolved",
      "observed": "3 conflicts (ls-files -u a,b/x,c). Tree rows: [b] x.txt, a.txt, c.txt. Show x.txt, 'Mark resolved' → dialog 'Unprocessed Changes… 1 unresolved conflict still remains' → 'Save Current Result' → rows 'x.txt resolved', '*a.txt' selected (not c.txt); ls-files -u now a.txt, c.txt. No 'Take left' button found by name; used resolve+Mark resolved path as brief allows.",
      "pass": true
    },
    {
      "recipe": "§2 merge list on fresh repo /tmp/snm2",
      "observed": "list rows *a.txt, b/x.txt, c.txt; show a, Mark resolved + Save Current Result → 'a.txt resolved', '*b/x.txt' selected; ls-files -u b/x.txt, c.txt.",
      "pass": true
    },
    {
      "recipe": "§2 no total in merge heading",
      "observed": "[title='left to review'] absent in snm and snm2 throughout (total:null); Files heading innerText 'Files' only.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0, node v26.13.1, pnpm 12.0.0; Linux 7.3.5-arch1-1; app-session on private Xvfb :3, tauri-driver, debug build target/debug/yamt at 5cdb2228; all sessions stopped. Tree had unrelated ' M .omp/run/slices.json'."
}
