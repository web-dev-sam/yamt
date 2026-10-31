# LineRangesDomainCorrectness

Agent output (`agent://LineRangesDomainCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesDomainCorrectness.md), collected 2026-10-31T12:07:41.486Z.

{
  "verdict": "pass",
  "checked": [
    "toThreadPlace brands start via toDiffLine and end via toThreadLine under field.start/.end; fromThreadPlace is the identity; bindings.ts:282,1151,48 match. Tests name all 8 start/end fields plus threads[0].place.*.",
    "diffLineOf ternary (accepted deviation) still forces a type error on a new ThreadLine kind. sameDiffLine has 12 cases (each kind, other left/right, every kind pair); onePlace and isOneLine are covered as the brief lists.",
    "Seeds checked by hand against verify brief :24-27 and design :67: thread 4 = L401/R389 to R406 (right = left-12 after d3, d4); thread 5 = L255 to R260 inside d3; threads 0-3 = L20/R21/L6/R102. sitsOn uses the real differences.",
    "Fixture store: addThread stores fromThreadPlace(place); the two-line place test checks ids 6/7. tauriReview.test passes {start,end} to the command unchanged. No `.line` reads are left in src/ipc (editor/ui expected).",
    "Survivors pass VF7: :82 `b.kind===unchanged`->true is (a) equivalent (an added b has no left, a removed b has no right); the never defaults are unreachable; the others are outside the hunks. Stryker on ipc tests only is accepted.",
    "AGENTS.md:5 names ThreadPlace, toThreadPlace/fromThreadPlace and both range seeds. No tests run by me; I relied on the implementer's src/ipc run (546 passed)."
  ],
  "findings": [
    {
      "file": "frontend/src/ipc/reviewDomain.test.ts",
      "line": 329,
      "severity": "should",
      "problem": "The only two-line isOneLine case has ends of different kinds (removed→added), so an isOneLine that compared only kinds would pass every test. The in-column case (added→added or unchanged→unchanged) is not covered, though the window's header text (`:210` vs `:23-25`) and its draft identity will rely on it.",
      "fix": "Add isOneLine cases whose ends are the same kind on different lines, e.g. `{ start: diffLineOf(added(3)), end: added(5) }` → false and `{ start: diffLineOf(onLeft(3,4)), end: onLeft(5,6) }` → false."
    }
  ]
}
