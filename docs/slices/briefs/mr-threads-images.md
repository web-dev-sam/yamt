# Slice mr-threads-images — an image keeps the size GitLab kept on it (Rust)

Feature: whose turn it really is, the whole thread beside the box, answering it, and sized images. Sources:

- Request `docs/slices/request-mr-threads.md` part A (A1–A3, the Rust side) and the acceptance's "description and
  note images carry their size".
- Design `docs/slices/briefs/mr-threads-design.md` option A, §1.1.
- Proposed plan §2 #184.

Runs in wave 2, after `mr-threads-fixtures` (its `mr-description/graphql-description-54.json`). `mr-threads-crate`
re-exports the new types from `lib.rs`; the window's sizing is `mr-threads-panel`'s.

## Target

**Owned:**

- `crates/merge-requests/src/description.rs`, `crates/merge-requests/src/description/**`
- `crates/merge-requests/tests/description.rs`

**Read-only:** everything else.

- `crates/merge-requests/src/lib.rs`: `mr-threads-crate`'s; it re-exports `ImageSize` and `ImageLength`. Until then
  the integration test reads sizes through `serde_json::to_value` (the IPC form), which is also what the window gets.
- `tests/glab/**`, `scripts/fake-glab/glab`: `mr-threads-fixtures`' (ask the orchestrator if a fixture is wrong).
- `src-tauri/**`, `frontend/**`: the bindings come later from the orchestrator's `just bindings` (PM4).
- `docs/**`, `AGENTS.md` files: lines in `deviations_from_brief`.

**Non-goals:** the window's CSS; sized videos (request non-goal); any other attribute of `<img>`; the thread read.

## Contract

Fixed; you may add, never change.

```rust
// description.rs (or description/size.rs, declared from description.rs). IPC: Clone, Debug, PartialEq, Eq,
// Serialize, Type, camelCase; enums with payloads tag = "kind"; documented as their neighbours.

pub enum DescriptionInline {
    // …
    /// An image.
    Image {
        image: DescriptionImage,
        caption: String,
        /// The size written in Markdown (`{width=…}`, `{height=…}`) as GitLab kept it on the `<img>`; None: its own.
        size: Option<ImageSize>,
    },
    // …
}

/// GitLab's `width`/`height` on an image, each only in GitLab's form `\A\d{1,4}(%|px)?\z` (Banzai
/// `AttributesFilter::VALID_SIZE_REGEX`); a value outside it is as if not written (request A3).
pub enum ImageSize {                         // tag = "kind"
    Width { width: ImageLength },
    Height { height: ImageLength },
    Both { width: ImageLength, height: ImageLength },
}

/// One length: a bare number is pixels, as on GitLab.
pub enum ImageLength {                       // tag = "kind"
    Pixels { value: u16 },                   // 0..=9999
    Percent { value: u16 },                  // 0..=9999, as written (the window caps at the column)
}

/// Pure: GitLab's form only; leading/trailing whitespace, a sign, a fraction, five digits, `em`, `PX` → None.
pub(crate) fn image_length(written: &str) -> Option<ImageLength>;
```

- `image()` (`description/html.rs:263-285`) reads `width` and `height` with `image_length` and builds `size`: both
  valid → `Both`; one → `Width`/`Height`; none → None. A link-lifted image keeps its size. The caption rule is
  unchanged.
- `described_on`'s users (the description, the links lookup) get sizes with no change of their own; notes get them in
  `mr-threads-crate` through the same function.

## Change

1. `ImageSize`, `ImageLength`, `image_length`, the `size` field; `description/tests.rs`'s `image(…)` helper gains the
   size (every existing test passes with `size: None`).
2. Unit tests, then `tests/description.rs` over `Fake::new("mr-description")` for iid 54.

## Acceptance

**Tests** (`cargo nextest run -p yamt-merge-requests`, hermetic prefix), each named for the bug it catches:

- `description/tests.rs`:
  - `a_bare_number_is_pixels_and_px_and_percent_are_kept` (`12` → pixels 12, `12px` → pixels 12, `40%` → percent 40)
  - `a_size_outside_gitlabs_form_is_ignored` (A3: `abc`, `12345`, `1.5`, ` 12`, `-3`, `12em`, `12PX`, empty → None,
    the image otherwise as without it) — **owns request A3** with the next one
  - `an_image_without_size_has_none` (A3)
  - `width_and_height_together_are_both`, `height_alone_is_height`
  - `a_lazy_images_size_is_read_beside_its_data_src` (GitLab's measured shape, design §1.1)
  - `an_image_lifted_out_of_a_link_keeps_its_size`
  - `the_ipc_form_names_kind_and_value` (`serde_json::to_value` of `Both { Pixels 200, Percent 50 }` equals
    `{"kind":"both","width":{"kind":"pixels","value":200},"height":{"kind":"percent","value":50}}`)
- `tests/description.rs`: `a_descriptions_images_carry_the_size_gitlab_kept` (iid 54: every image of the fixture in
  order, compared as `serde_json::Value`: width 300 px, width 40 %, height 80 px, both 200 × 100 px, width 5000 px;
  `width="abc"` → none, `width="12345"` → none; `height="50%"` → height 50 % (Rust keeps GitLab's form, the window
  ignores a % height, design §1.1); the last → none).

**Commands:** `cargo fmt --all --check`; `cargo clippy --workspace --all-targets -- -D warnings`; `cargo nextest run -p
yamt-merge-requests -p yamt-app` with the hermetic prefix; `just mutants HEAD`.

**Smoke:** none here (no command changes); the window's sizes are proven in `mr-threads-panel` and
`mr-threads-verify`.

## Skills

`skill://rust-conventions`, `skill://risk-register` (RK66: the size is the only new attribute read),
`skill://verification`, `skill://ipc-contract` (a new field on an IPC enum: the bindings change, PM4).
