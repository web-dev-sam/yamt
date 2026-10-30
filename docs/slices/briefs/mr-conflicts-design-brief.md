# Merge-request conflicts — design: change size, merge readiness, resolve conflicts in your own checkout (with abort)

Agent: `designer`. Output: two or three file-level options plus a recommendation (your output schema), the design
document, and one brief per build of the recommended option (`docs/slices/briefs/mr-conflicts-<build>.md`). Builds run
at most two at a time; split the files into **disjoint** ownership lists per build (name every file each creates or
changes), order them by dependency, and write every contract between builds in full (types, signatures, IPC commands,
store fields, fake-glab scenario layout). Each build ≤ ~25 files and ≤ ~1,500 changed lines.

The request: `docs/slices/request-mr-conflicts.md` (owner's words, both product answers, rules 1–8, non-goals, facts,
risks). Read it in full; a design may refine a detail a rule names, never reopen a rule. The two product answers:
the merge happens **in the user's own checkout** (#1995), and finishing **asks before pushing** (#1996).

## What each option must answer

1. **GitLab fields:** the exact GraphQL fields for rules 1–3 (merge status, diff counts, fork detection), checked
   against the GitLab GraphQL reference or the fake glab's recorded answers, with sources; how each folds into the
   row types (`MergeRequestRow`) and the fixture/fake-glab data.
2. **The resolve flow in Rust (rules 4–6):** which crate/module owns it (cite #117's "a second job is growth harm" and
   `scripts/arch-check.sh`), the exact git commands in order with their environment (no prompts, as #132), the checks
   of rule 4 and how each refusal reaches the row, how the new merge window is started (reuse #132's second-yamt
   start or not, and why), how finishing commits and then asks to push (where that question lives: the merge window's
   finish flow, plan §2 #85–#92).
3. **Abort (rule 7):** what records the "before" state (the branch checked out, a branch created, a branch moved and
   from where), where it lives so a restart cannot lose it, how the merge window knows this merge is one yamt started,
   how abort restores it beside #88's `merge --abort`, and what happens when the user changed things by hand in
   between (the safe answer: restore only what still matches, say what was not restored).
4. **One at a time (rule 8)** and the readiness icons' words (rule 2).
5. **Window:** components, store fields, texts, sources (`MergeRequestSource` gains what), fixture scripts.
6. **Tests per layer** with the bug each catches (including real git repositories for rules 4, 5 and 7: a local
   branch ahead, behind, missing; a stale "has conflicts"; abort after a restart); WebKit fixture steps and real-app
   steps (`just app-session` with `--glab`, a fake glab scenario with a conflicting merge request) per rule.
7. **Risk register rows** to add (the request names three) and **`docs/plan.md` §2 rows** to propose (as text for the
   orchestrator, DR5).
