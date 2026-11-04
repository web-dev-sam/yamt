# MrThreadsImagesCorrectness

Agent output (`agent://MrThreadsImagesCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsImagesCorrectness.md), collected 2026-11-04T12:46:34.953Z.

{
  "verdict": "pass",
  "checked": [
    "A3 form: image_length (size.rs:50-62) = \\A\\d{1,4}(%|px)?\\z; ASCII check rejects u16's '+3', MAX_DIGITS rejects '12345'; '%','px','12px%',' 12','12PX','٣' -> None; 0/9999 px and % pinned",
    "A1: image_size Both/Width/Height/None each pinned incl. invalid partner (200px+abc -> Width; 12em+80 -> Height); A3 tests compare whole inline to cat(None), image otherwise unchanged",
    "html.rs:263-291: size read from the same <img> for lazy and link-lifted images; caption unchanged; only Image constructors are html.rs:280, tests.rs:119, so described_on users get size",
    "Integration test vs fixture 54 (jq'd): 9 images, order and values match brief (300,40%,h80,200x100,5000,abc/12345 null,h50%,plain null); full-list compare fails if feature deleted",
    "IPC: the_ipc_form_names_kind_and_value equals brief JSON exactly; CONTRACT_KEYS adds only size/width/height/value, RK66 key-subset check still holds",
    "Mutation: 8 mutants, 5 caught, 3 unviable, none kept (nothing for VF7). Deviations accepted: Copy, ImageLength re-export deferred to lib.rs slice, image_size in size.rs, docs/bindings deferred"
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/description/size.rs",
      "line": 55,
      "severity": "nit",
      "problem": "`digits.parse().ok().filter(|_| is_gitlabs)?` parses before checking the form and hides the guard in a closure ignoring its argument, which a Rust beginner reads twice (vision 1); nothing gets harder as the app grows.",
      "fix": "Write `if !is_gitlabs { return None; } let value = digits.parse().ok()?;` so the form check reads before the parse."
    }
  ]
}
