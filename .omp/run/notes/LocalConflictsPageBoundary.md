# LocalConflictsPageBoundary

Agent output (`agent://LocalConflictsPageBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T17-45-19-979Z_01a19d5d-9b6b-71a4-8899-91c0c235c4e6/LocalConflictsPageBoundary.md), collected 2026-11-02T18:46:40.103Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all 18 files are in the brief's Owned list; bindings.ts, MergeRequestsView/Row.vue, docs and Rust untouched. ui/ gets CheckedRow only via ../ipc (PM2); mergeRequests/ imports no other src/ module (PM3).",
    "State: rows is written only in ui/mergeRequests.ts (received, ended swap, checked, load-failure reset). shown: set only in load and ended, not exposed, no ref needed. close() leaves rows alone; checked has no report/log.",
    "Rule traced vs brief and plan #150, all in mergeRequests.test.ts: buffered refresh writes its buffer; after a swap, results go to rows; older load dropped after a newer swap; failed refresh never reaches rows; unknown iid does nothing.",
    "Exhaustiveness: readinessText switch, ICONS and LOOKS records cover mergesCleanly. rowAction.ts:55 (`!== \"conflicts\"`) gives a clean row no Resolve (#150). No `as` or `!` added.",
    "listed: checked goes to onChecked before the settled check; late page ignored; bad page still fails the load. Open risk accepted: a bad checked iid throws in the Channel callback; Rust makes it (decision 19).",
    "Deviations accepted: docs-keeper lines (arch §4 l.980/995-998, §5.1, state.md) and extra tests. Fixture `local` reuses `list`; LOCAL_CHECK_MS sits beside checkLater; SCRIPTS stays a membership Record (TS17)."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequests.ts",
      "line": 157,
      "severity": "should",
      "rule_id": "principles §2",
      "problem": "`Load.buffering` and `State.shown` are updated only on the `ended` path. After an IPC failure `running.buffering` stays true for a load that is over, and a failed first load leaves `shown` on a load whose rows were just cleared. Nothing visible today, but the next code that reads either flag (a checking state, a flush) gets a value that is wrong.",
      "fix": "Keep the pre-patch `readonly buffered` and check `state.shown === load` first (rows), else `load.buffered` (a buffer nobody reads again). Set `state.shown = null` next to `state.rows.value = []`. This removes the mutable flag."
    },
    {
      "file": "frontend/src/ui/mergeRequests.ts",
      "line": 124,
      "severity": "should",
      "rule_id": "TS15",
      "problem": "`rechecked` is a pure row-list function kept in ui/, while its sibling `merged` lives in the pure core (mergeRequests/internal/order.ts, with a node test). This leaves the slice file at 299 of its 300-line max-lines cap, so the next addition forces an unplanned split.",
      "fix": "Move `rechecked` into mergeRequests/ (e.g. generic over `{ iid; readiness }` in order.ts or readiness.ts), export it from index.ts, and give it its own node test. The brief allows either place."
    },
    {
      "file": ".omp/skills/ipc-contract/SKILL.md",
      "line": 121,
      "severity": "should",
      "rule_id": "PM6",
      "problem": "The deviations give the docs keeper only architecture §4/§5.1 and state.md. ipc-contract SKILL.md:121 and project-map/tree.md:147-149 still say `listMergeRequests(onPage)` and do not name CheckedRow or toCheckedRow, so both describe the old contract after the feature lands.",
      "fix": "Add both places to deviations_from_brief: the two-callback signature, plus `toCheckedRow`/`CheckedRow` in tree.md's mergeRequestDomain.ts line."
    }
  ]
}
