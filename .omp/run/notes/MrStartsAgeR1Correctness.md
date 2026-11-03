# MrStartsAgeR1Correctness

Agent output (`agent://MrStartsAgeR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsAgeR1Correctness.md), collected 2026-11-03T20:21:17.528Z.

{
  "verdict": "pass",
  "checked": [
    "A1 traced in useListAge.ts:20-38: time read on each listedAt change and timeout; timer fires at at+k·60 s, so 'just now' only <60 s. Early tick fixes itself in 1 ms; future listedAt fires at at+60 s; null and unmount stop it.",
    "Tests catch real bugs: :55-67 fails on the old page clock ('just now' at 150 s); :47-53 if counted from mount; :35-45 on a +1 ms delay; :91-101 if title ignores now; :69-89 and :103-107 check timers with getTimerCount.",
    "Both kept survivors are VF7 (a) equivalent (vueuse 15.0.0 useTimeoutFn): immediate:true or {} only starts a 60 s timer, which the watch's immediate read() clears via start() or stop(); isPending is never read.",
    "Rows' clock unchanged: View :76 useNow and nowMs :87 still feed MergeRequestRow :now (:259); only change is age=useListAge(listedAt) :77, shown :150. No root or lsp import (PM10); tree.md:279-280 updated.",
    "Open risks accepted: MINUTE_MS beside its user (TS14); future listedAt is fine. The view wiring has no unit test, but verify step B2 covers it (implementer's WebKit run: just now at ~53 s, 1 minute ago at ~63 s).",
    "Below the block bar (RV8), for the docs keeper: architecture.md:1780 still says 'following the page's minute now' (the old buggy design). No test file run; no block depended on one."
  ],
  "findings": []
}
