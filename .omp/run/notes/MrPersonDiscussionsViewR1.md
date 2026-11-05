# MrPersonDiscussionsViewR1

Agent output (`agent://MrPersonDiscussionsViewR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsViewR1.md), collected 2026-11-05T15:08:22.517Z.

{
  "summary": "All five findings are fixed. `TURN_MARK` is now one constant in the new `ui/mergeRequestPeopleLook.ts`, used by both the box and the person view. The Resolved/turn pair is written once (vueuse `createReusableTemplate`) and shown in the head or the foot. `viewerKey` is the one key rule for both people menus. Picture sizes come from one `PICTURE_PX` record that both the picture and the fold read. The row gap is bound from `GAP_PX`. The +N chip is fixed to one 20 px slot, so it can no longer clip the newest picture.",
  "files_changed": [
    "frontend/src/ui/mergeRequestPeopleLook.ts",
    "frontend/src/ui/MergeRequestPicture.vue",
    "frontend/src/ui/MergeRequestWriters.vue",
    "frontend/src/ui/MergeRequestPersonEntry.vue",
    "frontend/src/ui/MergeRequestDiscussions.vue",
    "frontend/src/ui/MergeRequestPersonPicker.vue",
    "frontend/src/ui/MergeRequestReviewMode.vue",
    "frontend/src/ui/MergeRequestPersonViewPage.test.ts",
    "frontend/src/mergeRequests/internal/discussions.ts",
    "frontend/src/mergeRequests/internal/discussions.test.ts",
    "frontend/src/mergeRequests/index.ts"
  ],
  "tests_added": [
    {
      "name": "viewer_key_is_me_for_every_me_and_user_name_for_a_person (discussions.test.ts)",
      "proves": "viewerKey gives \"me\" for a Viewer me (with or without a username) and for ReviewFor me, and user:<username> for both kinds of person value."
    },
    {
      "name": "a_narrow_writers_row_folds_the_oldest_into_a_chip_that_keeps_to_one_picture_slot (MergeRequestPersonViewPage.test.ts)",
      "proves": "At a 100 px row, P6 shows its 3 newest writers plus a \"+10\" chip. The chip has the same width:20px;height:20px slot style as the pictures, plus overflow-hidden and whitespace-nowrap, and carries the folded writers in its tooltip."
    },
    {
      "name": "an_expanded_entry_shows_the_inline_thread_and_hides_the_clamp (extended)",
      "proves": "When the entry is expanded, the turn word appears only once and sits in the entry header (the one status fragment is shown in the head)."
    },
    {
      "name": "the_writers_row_lists_… (extended)",
      "proves": "The writers row has class flex min-w-0 flex-1 items-center overflow-hidden and style gap:4px, bound from GAP_PX."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend fmt:check / lint / typecheck / sfc-order / unused / test",
      "observed": "All matched files use the correct format; oxlint+eslint clean; vue-tsc -b clean; sfc-order clean; knip clean; Test Files 310 passed (310), Tests 4653 passed (4653)"
    },
    {
      "command": "app-session start-fixture --diff --mr list --open-mr --size 1600x1000; hover \"13 open discussions\" (!637 box, dark); measure",
      "observed": "Box pictures \"20x20 fs 8px\" ×3; 'Your turn' class 'ml-auto pl-4 font-semibold text-primary' weight 600; shot /tmp/r1-box-dark.png looks the same as before"
    },
    {
      "command": "same at --size 700x1000, data-theme=light, hover !637 box",
      "observed": "Pictures \"20x20 fs 8px\"; Your turn weight 600, rgb(56,113,225); shot /tmp/r1-box-light.png"
    },
    {
      "command": "700 px dark, Discussions → person view; measure every writers row",
      "observed": "\"rows 21 worst overflow 0 chips [\\\"+3 20x20 sw20 fs10px row273 shown10\\\"]\" (no picture goes past its row)"
    },
    {
      "command": "700 px dark, P6 writers row forced to 100px wide, measure children",
      "observed": "\"row 100: +10@0..20 sw20, Dmitri Volkov@24..44, Ben Okafor@48..68, Chiara Rossi@72..92\": the two-digit chip fits its 20 px slot and the newest picture is not clipped; shot /tmp/r1-fold-plus10-dark.png"
    },
    {
      "command": "700 px light: expand an entry, read its header; P6 fold",
      "observed": "Head turn 'ml-auto shrink-0 font-semibold text-primary' w600, shown once in the header; light fold shot /tmp/r1-fold-light.png shows '+10' and 3 pictures"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Stryker on discussions.ts + mergeRequestPeopleLook.ts: 224 killed, 12 survived, 4 no coverage; mergeRequestPeopleLook.ts 100% (3/3)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "#2516: TURN_MARK lives in the new ui/mergeRequestPeopleLook.ts next to PICTURE_PX/pictureBox, not beside RESOLVED in mergeRequestThreadText.ts. That file holds words, and TURN_MARK is a class string (a look), so keeping it out follows TS11.",
    "#2517: the pair is rendered once with @vueuse/core createReusableTemplate (DefineStatus/ReuseStatus), already a dependency, used here for the first time. It avoids adding a sixth component file outside Owned. A side effect: in SSR the class order is now 'ml-auto shrink-0 <look>', so the page test's turnOf regex was updated.",
    "#2519: MergeRequestPicture now sizes itself with :style from pictureBox(size), which reads PICTURE_PX (row 24, stack 20, box 20). The size-5/size-6 classes are gone; only the text-size classes stay (LETTERS). Rendered pixels are unchanged at the 16 px root (measured 20x20 and 24x24).",
    "#2520: the chip is now exactly one picture slot (pictureBox('box')) with overflow-hidden and whitespace-nowrap. Its font went from text-xs to text-[0.625rem] so that '+10'…'+99' fit in 20 px (measured scrollWidth 20). This changes the person view's look only, not the box's.",
    "Not owned: tree.md needs a row for ui/mergeRequestPeopleLook.ts (PICTURE_PX, pictureBox, TURN_MARK; read by Picture, Writers, PersonEntry, Discussions), or map-check fails for it; it already listed 12 missing files. ui/AGENTS.md:59 should name TURN_MARK's home."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestFilter.vue:63",
      "risk": "keyOf there (me/none/person/label) still repeats the 'me'/'user:' key rule, so it is a third copy viewerKey does not cover. Not owned, and its Value includes none and label."
    },
    {
      "location": "frontend/src/ui/MergeRequestPersonEntry.vue:104-117",
      "risk": "At 700 px, the expanded entry's header overflows (scrollWidth 558 vs clientWidth 393; the thread buttons are cut off on the right). This is the existing header layout (all items shrink-0), not changed in this round. Seen in /tmp/r1-view-light.png."
    },
    {
      "location": "frontend/src/ui/MergeRequestWriters.vue:41",
      "risk": "A chip of '+100' or more would be clipped inside its own slot (overflow-hidden), so pictures stay safe but the number is cut. Fixtures go up to +10 only."
    }
  ]
}
