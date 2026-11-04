# MrThreadsImages

Agent output (`agent://MrThreadsImages`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsImages.md), collected 2026-11-04T12:45:11.470Z.

{
  "summary": "An image in a description (and later in notes, through `described_on`) now carries `size: Option<ImageSize>`. Each length is read with `image_length`, which accepts only GitLab's `\\A\\d{1,4}(%|px)?\\z`. A width and a height give `Both`, one of them gives `Width` or `Height`, and neither gives None. An image lifted out of a link keeps its size. The types and both helpers are in the new `description/size.rs`. `image()` in html.rs fills the new field and is otherwise unchanged.",
  "files_changed": [
    "crates/merge-requests/src/description/size.rs",
    "crates/merge-requests/src/description.rs",
    "crates/merge-requests/src/description/html.rs",
    "crates/merge-requests/src/description/tests.rs",
    "crates/merge-requests/tests/description.rs"
  ],
  "tests_added": [
    {
      "name": "description::tests::a_bare_number_is_pixels_and_px_and_percent_are_kept",
      "proves": "12 and 12px become pixels 12, 40% becomes percent 40, and the edge values 0 and 9999 (px and %) are kept."
    },
    {
      "name": "description::tests::a_size_outside_gitlabs_form_is_ignored",
      "proves": "A3: abc, 12345, 1.5, ' 12', '12 ', -3, +3, 12em, 12PX, empty, %, px, 12px%, 12%px and the Arabic digit ٣ all give None. The image is then the same as one without a size."
    },
    {
      "name": "description::tests::an_image_without_size_has_none",
      "proves": "A3: an <img> with no width or height has size None."
    },
    {
      "name": "description::tests::width_and_height_together_are_both",
      "proves": "A valid width and height give Both. A valid width with an invalid height gives Width."
    },
    {
      "name": "description::tests::height_alone_is_height",
      "proves": "A height alone gives Height, also when the width beside it is invalid."
    },
    {
      "name": "description::tests::a_lazy_images_size_is_read_beside_its_data_src",
      "proves": "GitLab's measured lazy image shape (data: src, data-src, width=12) gives a web image with Width pixels 12."
    },
    {
      "name": "description::tests::an_image_lifted_out_of_a_link_keeps_its_size",
      "proves": "An image lifted out of a link still has its Width percent 40."
    },
    {
      "name": "description::tests::the_ipc_form_names_kind_and_value",
      "proves": "serde_json of Both{Pixels 200, Percent 50} is exactly the JSON the brief gives."
    },
    {
      "name": "description::a_descriptions_images_carry_the_size_gitlab_kept",
      "proves": "Over fake glab, iid 54 gives every image in order with the expected size: 300px, 40%, h80, 200x100, 5000, null, null, h50%, null."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo fmt --all --check",
      "observed": "FMT_OK (no diff)"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 27.87s"
    },
    {
      "command": "<hermetic_git> cargo nextest run -p yamt-merge-requests -p yamt-app",
      "observed": "Summary [   7.798s] 491 tests run: 491 passed, 37 skipped"
    },
    {
      "command": "<hermetic_git> cargo nextest run -p yamt-merge-requests -E 'test(/size|pixels|without_size|both|height_alone|kind_and_value/)'",
      "observed": "PASS the_ipc_form_names_kind_and_value, width_and_height_together_are_both, an_image_without_size_has_none, a_lazy_images_size_is_read_beside_its_data_src, an_image_lifted_out_of_a_link_keeps_its_size, a_bare_number_is_pixels_and_px_and_percent_are_kept, height_alone_is_height, a_size_outside_gitlabs_form_is_ignored, yamt-merge-requests::description a_descriptions_images_carry_the_size_gitlab_kept"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 8 mutants to test; 8 mutants tested in 51s: 5 caught, 3 unviable; no TypeScript changes",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "description.rs re-exports only `ImageSize` (`pub use size::ImageSize;`). Re-exporting `ImageLength` as well fails `-D unused-imports` while lib.rs does not re-export it. When mr-threads-crate adds `ImageSize, ImageLength` to lib.rs, it must change that line in description.rs to `pub use size::{ImageLength, ImageSize};`.",
    "`ImageSize` and `ImageLength` also derive `Copy`, like their neighbour `ListNumbering`. The contract allows additions.",
    "Added `image_size(&NodeRef) -> Option<ImageSize>` (pub(super)) in size.rs, which builds the size from the `<img>`'s attributes. It sits beside the contract's `image_length` because html.rs is at 399 of 400 lines.",
    "CONTRACT_KEYS in description/tests.rs now includes size, width, height and value, the new IPC keys. Images without a size now serialize with `\"size\": null`.",
    "Docs outside Owned: in crates/merge-requests/AGENTS.md, change `image { image: DescriptionImage, caption }` to `image { image: DescriptionImage, caption, size: ImageSize width|height|both of ImageLength pixels|percent { value } | null }`, using GitLab's `\\A\\d{1,4}(%|px)?\\z`, size.rs.",
    "The frontend bindings and fixtures building `DescriptionInline` image values need `size` after the orchestrator runs `just bindings` (PM4). The design says this is expected."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/description/size.rs:51",
      "risk": "The parser follows GitLab's documented regex. Ruby's `\\d` is read as ASCII digits only [INFERENCE], so a non-ASCII digit gives None. GitLab's sanitizer should never let one through anyway."
    }
  ]
}
