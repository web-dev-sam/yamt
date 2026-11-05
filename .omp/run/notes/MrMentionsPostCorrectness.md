# MrMentionsPostCorrectness

Agent output (`agent://MrMentionsPostCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsPostCorrectness.md), collected 2026-11-05T10:39:22.469Z.

{
  "verdict": "pass",
  "checked": [
    "linedUpRow guards are killed: reversed rows (first match, not first row), !12 → null, notLinedUp/null throw if the guard or ?. is dropped, ?? mutated is killed by the positive case.",
    "RangeMessageEditor: mentions only for post (RangeMessage.vue:128-143 v-if remounts). mentions.keydown precedes boxKeydown; Mod-Enter bypasses mentionKey; submit closes the list first; typed stays the one writer (smoke 9).",
    "Survivors pass VF7 (a): fixtureGitLab.ts:127/128 is a type-narrowing guard over constant fixtureRows; :57 is read only via Object.hasOwn; fixtureThreads.ts:41 gives !12. I traced the other changed lines by hand; the tests kill them.",
    "Smoke separates known from search: bare ` @` lists anna/sam with no search line (step 3) vs no list for linedUp (step 10). fixtureReview.test: the listed send names !640, the seeded note stays !12.",
    "Accepted deviations: start-fixture has no --settings (startArgs.ts:249), `block` textarea as in the reply field, the webUrl equality is the brief's [INFERENCE]. No import cycle from the new fixtureRows import.",
    "No line spaces and no editor/ touched (CM n/a). RK35: taken keys are prevented and stopped, focus is kept (smoke 7). RK54: writers=[], no new write. No targeted test run needed."
  ],
  "findings": [
    {
      "file": ".omp/run/mutants/MrMentionsPost.survivors.txt",
      "line": 1,
      "severity": "nit",
      "rule_id": "VF7",
      "problem": "The run reports 38 survivors, but only 7 are listed, and nothing says the other 31 are on lines the patch did not change. A reviewer has to re-derive that by hand. It costs nothing as the app grows.",
      "fix": "Add one line saying the remaining 31 survivors are on pre-existing lines (file:line ranges), as LineRangesDomain.survivors.txt does."
    }
  ]
}
