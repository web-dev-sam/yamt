# SidebarNextFileWebCorrectness

Agent output (`agent://SidebarNextFileWebCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/SidebarNextFileWebCorrectness.md), collected 2026-11-25T11:29:09.673Z.

{
  "verdict": "pass",
  "checked": [
    "Tree order: sidebarOrder is treeRows with nothing closed; closing hides only a subtree, chain joining is structural, so the order matches the visible tree. A path sort fails fileTree.test.ts (a.txt/b/x.txt/c.txt).",
    "Wrap/skip: nextOpen unchanged. Traced by hand on the reversed fixture: tree gives current.md→legacy.txt (keys.md seeded, skipped) and config→data/big.txt (wrap); list gives vendor/ui. Both fail on old code.",
    "Stale move-on: opening.ts moveOn computes `untouched` before the synchronous sidebarOrder, so a newer open still gives null (store.test.ts:649). store.test.ts take test.each tells list (z.ts) from tree (b/c.ts).",
    "leftToReview: counted files with mark ≠ reviewed; none → notCounted; 0/0 counted still shows. Tests cover reviewed, changedSinceReview, unmarked, notCounted, all reviewed. RangeCounts' v-if hides notCounted.",
    "One mode per window: each store has one createFileListMode, shared by FileList and the next-file rule; store/rangeStore tests fail on a second instance. Node tests have no window, so mode does not leak between tests.",
    "Mutants (transcript): final 19 survived + 8 no-coverage, all on pre-existing lines. rangeReviewed.ts:99 `?? []` was killed by the tree case. The empty survivor list is right; deviations accepted; RK31 not worsened."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/fileTree.test.ts",
      "line": 211,
      "severity": "nit",
      "problem": "The joined-chain test also passes with a plain full-path sort (a/b/c/x.ts < a/b/c/y.ts < m/n.ts < z.ts); only the first sidebarOrder test pins folders-before-root-files. Nothing gets harder as the app grows.",
      "fix": "Add a root file that sorts before the chain, e.g. \"0.ts\", and expect it after \"m/n.ts\"."
    }
  ]
}
