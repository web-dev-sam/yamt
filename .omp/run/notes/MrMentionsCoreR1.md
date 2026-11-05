# MrMentionsCoreR1

Agent output (`agent://MrMentionsCoreR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsCoreR1.md), collected 2026-11-05T09:38:04.396Z.

{
  "summary": "Fixed findings #2487 and #2488 by adding tests; only `mentions.test.ts` changed. `known_people_come_before_found_people` now has a case where a known person matches only by contains and a found person matches by starts-with: `mentionLines([DSCOTT],[ANNA],\"an\")` → [dscott, anna]. New test `a_blank_text_lists_at_most_ten_known_people` checks the 10-line cap for a bare `@`. `mentions.ts` is unchanged: neither test found a real bug.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/mentions.test.ts"
  ],
  "tests_added": [
    {
      "name": "known_people_come_before_found_people (new assertion)",
      "proves": "A known person who matches only by contains still ranks above a found person who matches by starts-with (#2487). It fails if known and found are ranked together."
    },
    {
      "name": "a_blank_text_lists_at_most_ten_known_people",
      "proves": "A bare `@` with 12 known people lists exactly MENTION_LINES, the first ten in order (#2488). It fails if the slice moves into the non-blank branch."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run src/mergeRequests/internal/mentions.test.ts",
      "observed": "Test Files  1 passed (1); Tests  14 passed (14)"
    },
    {
      "command": "temporarily planted bug #2487 in mentions.ts (`matching([...known, ...found], query)`) + vitest",
      "observed": "× known_people_come_before_found_people; Tests  1 failed | 13 passed (14). Source restored afterwards."
    },
    {
      "command": "temporarily planted bug #2488 in mentions.ts (`.slice(0, MENTION_LINES)` only on the non-blank branch) + vitest",
      "observed": "× a_blank_text_lists_at_most_ten_known_people; Tests  1 failed | 13 passed (14). Source restored; git status shows only mentions.test.ts modified."
    },
    {
      "command": "pnpm -C frontend lint; oxfmt --check mentions.test.ts; pnpm -C frontend typecheck",
      "observed": "lint clean; 'All matched files use the correct format.'; vue-tsc -b no errors"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 'mutants: no Rust changes since HEAD' / 'mutants: no TypeScript changes since HEAD' (test-only change; the planted bugs above stood in for the mutants)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [],
  "open_risks": []
}
