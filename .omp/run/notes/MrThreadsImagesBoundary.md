# MrThreadsImagesBoundary

Agent output (`agent://MrThreadsImagesBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsImagesBoundary.md), collected 2026-11-04T12:47:10.723Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: only Owned files touched. Deviation 1 (only ImageSize re-exported) accepted: mr-threads-crate.md:24-27 now owns that line.",
    "Contract: ImageSize/ImageLength have the brief's shape, docs, serde tag and derives, plus Copy like ListNumbering/TaskBox. image_length is pub(crate); size field doc (description.rs:240) matches.",
    "size.rs:49-71 matches GitLab's regex: '+3' rejected by is_gitlabs; '%', 'px', '' fail to parse; '12px%' not all digits; non-ASCII digit rejected; u16 fits. One invalid side gives Width/Height.",
    "Growth: no new dep, state or import edge. image_size is a one-caller pub(super) (html.rs at 399/400, RS6); described_on's users need no change; element.rs has no width/height parser to reuse. Deviation 3 OK.",
    "Only html.rs:280 and tests.rs:119 build DescriptionInline::Image; nothing in other crates or src-tauri does. Bindings/frontend wait for `just bindings` (PM4). Deviations 4-6 and the non-ASCII-digit risk accepted.",
    "Comments: size.rs docs state what each item is or cite GitLab's source (CP1/CP2), none narrate. tests/description.rs chain has 3 adapters (RS4). MAX_DIGITS sits beside its only user (RS13)."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/description/size.rs",
      "line": 55,
      "severity": "nit",
      "rule_id": "principles §2",
      "problem": "`digits.parse().ok().filter(|_| is_gitlabs)?` parses before it validates and hides the guard in a closure that ignores its argument. A reader has to work out that `+3` parses but is then rejected. Nothing gets harder as the app grows.",
      "fix": "Return early with `if !is_gitlabs { return None; }` and then write `let value = digits.parse().ok()?;`."
    }
  ]
}
