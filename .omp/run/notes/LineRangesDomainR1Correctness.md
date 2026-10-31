# LineRangesDomainR1Correctness

Agent output (`agent://LineRangesDomainR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesDomainR1Correctness.md), collected 2026-10-31T12:18:09.188Z.

{
  "verdict": "pass",
  "checked": [
    "#2061 fixed: test.ts:329-337 adds removed→removed, added→added, onLeft→onLeft, onRight→onRight on other lines, all false. Hand-traced: a kind-only isOneLine returns true on all four, so they fail",
    "Real isOneLine (threadLine.ts:91 via sameDiffLine:75-88) is false on all five cases. Matches implementer run: 550 pass with the real one, 4 fail with the kind-only shadow",
    "No regression: only the test file changed. The removed→added case is kept, the one-line true cases (:313-327) are untouched, and the file imports the real isOneLine (:9) with the shadow gone",
    "Deviations accepted: shadowed mutant (threadLine.ts not Owned), old test folded into the test.each. Test-only change, so no survivors to check against VF7. I ran no tests"
  ],
  "findings": []
}
