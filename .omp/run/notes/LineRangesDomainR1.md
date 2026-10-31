# LineRangesDomainR1

Agent output (`agent://LineRangesDomainR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesDomainR1.md), collected 2026-10-31T12:17:42.721Z.

{
  "summary": "Fixed finding #2061. In reviewDomain.test.ts, the single 'removed→added is two lines' isOneLine test is now a test.each with five cases that must all be false. Four of them have ends of the same kind on different lines: removed→removed, added→added, and unchanged→unchanged picked on the left and on the right. An isOneLine that compares only kinds now fails four tests.",
  "files_changed": [
    "frontend/src/ipc/reviewDomain.test.ts"
  ],
  "tests_added": [
    {
      "name": "a place from a removed line to another removed one is two lines",
      "proves": "isOneLine compares the left line number of removed ends, not only their kind"
    },
    {
      "name": "a place from an added line to another added one is two lines",
      "proves": "isOneLine compares the right line number of added ends, not only their kind"
    },
    {
      "name": "a place from an unchanged line to another one on the left is two lines",
      "proves": "isOneLine compares the line numbers of unchanged ends (left column), not only their kind"
    },
    {
      "name": "a place from an unchanged line to another one on the right is two lines",
      "proves": "isOneLine compares the line numbers of unchanged ends (right column), not only their kind"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend test src/ipc (with a temporary kind-only isOneLine shadowing the import inside the test file)",
      "observed": "reviewDomain.test.ts (82 tests | 4 failed): × removed→another removed, × added→another added, × unchanged→another on the left, × unchanged→another on the right; AssertionError: expected true to be false"
    },
    {
      "command": "pnpm -C frontend test src/ipc (shadow removed, real isOneLine)",
      "observed": "Test Files 29 passed (29); Tests 550 passed (550)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 'no Rust changes since HEAD', 'no TypeScript changes since HEAD' (test-only change)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The ownership hook blocked editing threadLine.ts, so I could not put the kind-only mutant there. Instead I briefly shadowed the isOneLine import inside the owned test file with a kind-only version, ran the tests, then removed the shadow. The final file imports the real isOneLine.",
    "The existing removed→added test was folded into the same test.each instead of staying a separate test."
  ],
  "open_risks": []
}
