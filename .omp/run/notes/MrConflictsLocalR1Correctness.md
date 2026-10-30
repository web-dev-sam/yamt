# MrConflictsLocalR1Correctness

Agent output (`agent://MrConflictsLocalR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsLocalR1Correctness.md), collected 2026-10-30T22:02:05.172Z.

{
  "verdict": "pass",
  "checked": [
    "#2010 fixed: start.rs:193-195 aborts any stop that has an operation but is not live, before restore runs. If the abort fails, git's words are returned and restore lists ReturnRefused/BranchCheckedOut.",
    "#2010 test start.rs:197: a post-checkout hook moves origin/main to develop. It asserts left==[], the snapshot unchanged and no MERGE_HEAD. Without the abort, left is non-empty and the test fails.",
    "#2011 fixed: with warnAmbiguousRefs=false the guard yields refs/remotes/…. The `if true` mutant merges develop: not live, so Err and unwrap panics. R1 survivors file is empty; no VF7 reason to judge.",
    "#2012 fixed: restore.rs:74-79 says BranchKept when moved and BranchCheckedOut when at head and checked out; matches design §4.3/§4.5/§4.6. abort.rs:136 pins it; abort.rs:100 still pins NotReturned+BranchKept.",
    "Deviation accepted: NotReturned+BranchCheckedOut needs 'checked out at tip=head' and 'not (checked out and HEAD=head)'. When checked out, HEAD=tip, so the pair needs a race. A read error gives ReturnRefused.",
    "No other Leftover consumer yet (grep crates/src-tauri/frontend). Below the RV8 bar: the hook test hand-rolls what yamt_conflict_repo::install_hook does. I ran no tests."
  ],
  "findings": []
}
