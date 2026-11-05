# MrPersonDiscussionsStateR1Correctness

Agent output (`agent://MrPersonDiscussionsStateR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsStateR1Correctness.md), collected 2026-11-05T14:49:33.217Z.

{
  "verdict": "pass",
  "checked": [
    "#2510 fixed: unsentDropped puts running non-reloading iids in unhovered (Queue.ts:162-171); settle drops unanswered. leaving_under_lazy_or_off_sends_nothing_more (12 sent, 10 answered) fails pre-fix (call 2 sent).",
    "#2514 fixed: leftView drops loading entries not running/reloading (Queue.ts:177-183); afterAsk isWaiting skips them. leaving_during_a_reloads_ask_... and PersonView.test.ts:590 (lazy, 0 reads) fail pre-fix.",
    "No regression: queued is a subset of loading+reloading so unsent queued still drop; 'full' untouched (guard + full branches tested); becameFull pinned by a_switch_back_to_full_keeps_the_running_calls_rows.",
    "Open risks accepted: pending box-reload drop is the finding's prescribed class; reloading read rows sent after Back match brief Contract 'not reloading' and #2514's fix; RK61 holds (reload pressed in view).",
    "Survivors VF7(a) ok: Queue.ts:93,:162 string in Set (numeric probes, no-op delete), :147 -=1 (equality only), Discussions.ts:76 never arm, mergeRequests.ts:202 (set sync), :144 (at only on done).",
    "Growth: Queue writers now in one file; becameLazy/leftView share unsentDropped (no copied rule); only new edge ui->ui setRow. No tests run (no block depended on one)."
  ],
  "findings": []
}
