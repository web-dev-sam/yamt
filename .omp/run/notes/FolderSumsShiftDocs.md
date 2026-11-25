# FolderSumsShiftDocs

Agent output (`agent://FolderSumsShiftDocs`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/FolderSumsShiftDocs.md), collected 2026-11-25T10:58:16.654Z.

{
  "summary": "Docs now match 9638696e (plan §2 #200): a folder's +a −r in the range tree shows only while Shift is held. RangeApp reads useShiftHeld() and makes the folder slot's RangeCounts `invisible` while Shift is up; file rows always show their counts. Updated: architecture §3.8 folder-sums paragraph, the Shift row of the state table, state.md row 80, tree.md (rangeFolderSums, useShiftHeld) and SKILL.md's Verified line. The Shift rows were also missing RangeThreadBox and RangeMessage, which use useShiftHeld for queueButton (#198); they are listed now.",
  "files_changed": [
    "docs/architecture.md",
    ".omp/skills/project-map/SKILL.md",
    ".omp/skills/project-map/tree.md",
    ".omp/skills/project-map/state.md"
  ],
  "map_check": "map-check: ok",
  "left_stale": []
}
