# MrPersonDiscussionsViewR1Correctness

Agent output (`agent://MrPersonDiscussionsViewR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsViewR1Correctness.md), collected 2026-11-05T15:11:27.451Z.

{
  "verdict": "pass",
  "checked": [
    "#2520 fixed: the +N chip is one 20px slot (pictureBox('box'), overflow-hidden, nowrap; Writers.vue:40-45) and the fold counts it. The narrow test fails if the chip loses its slot, overflow or nowrap.",
    "Box look unchanged: PICTURE_PX 24/20 equals size-6/size-5 at the 16px root (style.css sets 13px on body only). LETTERS sizes kept. No caller passes a size class that the inline style now overrides.",
    "#2516-#2519 hold: one TURN_MARK home; the status pair is defined once, shown in head or foot (v-else), one turn word in the header (tested); viewerKey serves both menus, unit-tested; gap from GAP_PX.",
    "Mutation: the 12 survivors in discussions.ts are on pre-existing lines (:50-53 etc.), none on viewerKey :187-189. peopleLook.ts is 3/3 killed. No kept survivors, so no VF7 reasons to judge.",
    "Open risks accepted: the Filter keyOf copy and the 700px header overflow are outside this round; a '+100' chip clips only in its own slot (tooltip keeps the count); the tree.md row is the docs keeper's (PM6).",
    "The file-wide useElementSize mock returns Infinity (Writers' own SSR initial) and is reset in afterEach. No tests run; no block depended on one."
  ],
  "findings": []
}
