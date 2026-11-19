# RangeReviewedStoreCorrectness

Agent output (`agent://RangeReviewedStoreCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedStoreCorrectness.md), collected 2026-11-19T09:57:24.890Z.

{
  "verdict": "fail",
  "checked": [
    "Rules 2/3/6 by hand on fixture order: marking skips a reviewed file (current→legacy), wraps (vendor/ui→config), treats changedSinceReview as not done (legacy→logo), stays when none left. Count is over listed files only (1 of 5).",
    "nextOpen behaves as the old nextUnresolved. Survivors kept as equivalent hold (VF7 a): nextFile.ts:9 (a repeat never precedes the first match); rangeReviewed.ts:90 (a string has no .path, so the answer is still null).",
    "fixtureReviewed constant survivors: the named assertions exist and would kill each one (seeded-marks toEqual, board.ts since toEqual with words). Matches the #732/--ignoreStatic precedent.",
    "Open risk 1 accepted: busy stays true after a failed first list, as the contract says. The list problem is reported. A broken reviewed.json is refused before any window, so only worker/IPC failures reach this path.",
    "Store wiring: listReviewed runs after openRange and before checkGitLab, and not at all after a failed open (rangeStore.test). show/forget/problems are wired end to end. Every visited-list importer moved to rangeVisited.ts.",
    "ipc: id brands, the twice-listed refusal, differences via toDifferences, and failures passed through are all tested. app-session flags match src-tauri args.rs:25-37. No risk-register row names these owners."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/rangeReviewed.ts",
      "line": 109,
      "severity": "block",
      "rule_id": "loadFile rule copied, not shared",
      "problem": "After a failed since load reports 'Could not show what changed in X since the review', reopening X with a successful since load leaves that problem on the bar while X's view works. loadFile clears it in the same case (rangeStore.ts:286 clearProblemAbout). The view slice cannot fix this.",
      "fix": "Give ReviewedWindow a `loaded(path)` callback wired to clearProblemAbout(state, path) and call it on success. Add a test where a since failure then a since success leaves store.problem null."
    },
    {
      "file": ".omp/run/mutants/RangeReviewedStore.survivors.txt",
      "line": 3,
      "severity": "nit",
      "rule_id": "VF7",
      "problem": "The fixtureReviewed constant survivors are filed as 'wiring', but VF7 (c) covers registration and log calls, not constants. The real reason is the #732 harness limit plus a named assertion. Nothing gets harder, but the label teaches the curator a wrong category.",
      "fix": "Relabel these lines 'harness: module-level constant (#732, --ignoreStatic)' with the named assertion, as CollapseToggle.survivors.txt does."
    }
  ]
}
