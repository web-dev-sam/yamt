# MrWindowStateCorrectness

Agent output (`agent://MrWindowStateCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrWindowStateCorrectness.md), collected 2026-10-30T14:25:38.654Z.

{
  "verdict": "pass",
  "checked": [
    "Slice rules hand-traced: buffered reload swaps only on loaded/cut; failed end or IPC failure keeps rows; load id drops older pages; one load at a time; 30 s boundary at both sides. Each test fails if its rule is removed.",
    "mergeRequests.test kills removal of: load-id check, buffering, state.load=null and first-load clear, cut kept through a failed reload (summary test), the fetching guard (open test)",
    "Domain: ms via Date.parse, offset and NaN tested; missingCommit keeps short_id per design §2.1 (rename_all renames variants only). Fixture: 9 scripts, per-iid replies, no ?mr → none, nothing logged",
    "Stores: findProject runs beside openCompare/openRange (independent Rust commands). A failed lookup reaches the bar while tabs/range still open (tests). problemText keeps list/settings words.",
    "Survivors: transcript line 645 (final run, changed files) matches the 6 kept groups; compareStore:254, rangeStore:232 are older lines. :152 equivalent (NaN>=); never arms typecheck-covered; cycled/SCRIPTS equivalent",
    "Open risks accepted: late Tauri page and the unreadable late page are the decided Channel End rework; short_id matches §2.1; the Listing name clash and store sizes are boundary concerns. No test run: no block needed one."
  ],
  "findings": [
    {
      "file": ".omp/run/mutants/MrWindowState.survivors.txt",
      "line": 2,
      "severity": "nit",
      "rule_id": "VF7",
      "problem": "Module-constant literals (fixtureMergeRequestData.ts:3-68, fixtureMergeRequests.ts:51 LOADED) are kept as (c) wiring. They are #732 static artefacts whose values the fixture tests assert, and (c) needs a registration seen in the smoke. If it stays, nothing gets harder, but the label teaches the wrong category.",
      "fix": "Relabel both lines as '#732 static artefact, gate-covered where asserted (fixtureMergeRequests.test.ts)' instead of 'wiring'."
    }
  ]
}
