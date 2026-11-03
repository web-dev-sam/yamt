# MrPeopleStateR1Correct

Agent output (`agent://MrPeopleStateR1Correct`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleStateR1Correct.md), collected 2026-11-03T23:11:08.636Z.

{
  "verdict": "pass",
  "checked": [
    "#2264 fixed: searchOf uses a plain setTimeout/clearTimeout handle (mergeRequestPeople.ts:100-115), as searchRun.ts does. Test :115-116 sees no search 1000 ms after creation, so a timer started at creation fails.",
    "Pause rule holds: stop() runs clearTimeout and bumps calls. Dropping clearTimeout sends 3 searches, caught by :118-128. Empty/@ text and endPeopleSearch clear the timer (:154-162, :175-177).",
    "Latest-answer rule holds: ask writes only if sent===calls. Covered by older-answer :131, answer-after-typing :143, end-drops-in-flight :165.",
    "Survivors per VF7: calls+=1 to -=1 (:103) is (a) equivalent, equality only. Fixture 43/64 never arms are unreachable. Fixture 18/22/24 were reviewed in round 1 (no finding) and are untouched now.",
    "#2261/#2262: any remove but rita answers changed, as Rust is_shown (people_change.rs:195). replaced is called only on changed/unchanged, same order as before; tests :276/:286/:299 assert it.",
    "Open risk accepted: the timer is not cleared on dispose, but the slice has one owner, the window store (mergeRequests.ts:113). VU12 deviation accepted (searchRun.ts precedent). No test run needed."
  ],
  "findings": []
}
