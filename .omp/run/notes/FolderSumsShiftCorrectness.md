# FolderSumsShiftCorrectness

Agent output (`agent://FolderSumsShiftCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/FolderSumsShiftCorrectness.md), collected 2026-11-25T10:58:13.082Z.

{
  "verdict": "pass",
  "checked": [
    "Rule 1: RangeApp.vue:59 calls the shared useShiftHeld (no 2nd listener); keyHold.ts listens on window in capture phase, so Shift in a text field counts (rule 3); blur and a pointer without Shift end it.",
    "Rule 2: RangeApp.vue:138 merges :class invisible with static ml-auto on RangeCounts' root, as ChoiceView.vue:88 does; no v-if/v-show. notCounted public/ renders nothing, as at eb2c9f12.",
    "WebKit note proves rules 1-3: real \\uE008 keyDown->visible, keyUp->hidden, down+blur->hidden, dark+light; text = HMR-restored base; name/check boxes equal. I opened the 4 /tmp/fs-*.png shots and they agree.",
    "Deviations accepted: --reviewed seeded + one mark (needed so a check exists), base text measured by an HMR revert, request's real-app run not in the brief (left to the owner check).",
    "Mutation: the survivors file records that a .vue-only change mutates nothing and keeps no survivors, so VF7 has nothing to check. Open risk (no test pins the binding) accepted: brief allowed tests only with a new component.",
    "Docs: ui/AGENTS.md line 9 updated; the working tree has architecture.md:881-884, plan #200 and CHANGELOG. merge-core and editor are untouched, so §3.1 and CM1-CM9 do not apply."
  ],
  "findings": []
}
