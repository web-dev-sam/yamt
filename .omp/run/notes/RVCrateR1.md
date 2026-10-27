All five fixes are in, and the earlier tests still pass. To get `range.rs` under the 400-line limit I also had to move three tests into a third file, which the brief didn't ask for.

```
summary
  The lock tests now live in crates/range/tests/lock.rs (122 lines) and the tests of answers the listing gives
  without reading in tests/listing_answers.rs (169 lines). That brings tests/range.rs to 374 lines, under RS6's 400.
  load.rs: the limit is a compile-time `TOO_LARGE_LIMIT`, and `is_link` is inlined as two `==` comparisons.
  entries.rs: one gitlink predicate, `has_blob`, used by both `blob_ids` and `blob_at`.
  Both old-side guards (size, gitlink) are now tested, and removing either one by hand made a test fail.

files_changed
  crates/range/src/load.rs
  crates/range/src/entries.rs
  crates/range/tests/range.rs
  crates/range/tests/lock.rs (new)
  crates/range/tests/listing_answers.rs (new)

tests_added
  exactly_8_mib_loads_and_one_byte_more_is_too_large (now in listing_answers.rs): adds a deleted over-limit
    "gone.txt" and drops its blob; expects TooLarge, so the old-side size guard answers before any read.
  mode_only_kind_changed_and_submodule_are_sentences (now in listing_answers.rs): adds a removed submodule
    "vendor/gone" and expects Submodule { old: Some(FIRST_COMMIT), new: None }, so the old-side gitlink guard
    answers before any read.
  The three lock tests moved into lock.rs unchanged.

smoke_evidence
  wc -l crates/range/tests/*.rs → 169 listing_answers.rs, 122 lock.rs, 374 range.rs
  cargo fmt --check → no output, exit 0
  cargo clippy --workspace --all-targets -- -D warnings → "Finished `dev` profile", no warnings or errors
  cargo test -p yamt-range -p yamt-app →
    yamt_app lib: ok. 101 passed; main: 0; tests/cli.rs: ok. 5 passed
    yamt_range lib: ok. 8 passed; tests/listing_answers.rs: ok. 3 passed; tests/lock.rs: ok. 3 passed;
    tests/range.rs: ok. 11 passed (17 integration tests in total, the same 14 + 3 as before)
  Hand-removal 1, the old-side size guard (`if new.is_some_and(is_too_large)` only):
    test exactly_8_mib_loads_and_one_byte_more_is_too_large ... FAILED
    panicked at crates/range/tests/range.rs:79:26: called `Result::unwrap()` on an `Err` value:
    Git(BlobMissing { oid: Oid("6d060ac4468a652e4e28295012a684868caae8cc") })
    test result: FAILED. 13 passed; 1 failed
  Hand-removal 2, the old-side gitlink guard (`if new.is_some_and(BlobAt::is_gitlink)` only):
    test mode_only_kind_changed_and_submodule_are_sentences ... FAILED
    panicked at crates/range/tests/range.rs:79:26: called `Result::unwrap()` on an `Err` value:
    Git(BlobMissing { oid: Oid("1111111111111111111111111111111111111111") })
    test result: FAILED. 13 passed; 1 failed
  Both guards restored afterwards; load.rs is back to its pre-experiment state and all tests pass.

deviations_from_brief
  - Block 1: the prescribed move alone left range.rs at 477 lines, still over 400. I also moved
    binary_is_answered_…, exactly_8_mib_… and mode_only_kind_changed_… into tests/listing_answers.rs (the
    answers `decide` gives from the listing, each proven by dropping the object). With them went their
    helpers (submodule, drop_object, FIRST/SECOND_COMMIT); the small shared helpers are copied, as the brief
    says for lock.rs.
  - lock.rs also copies `file` and `changed`, which the lock tests use.
  - Block 2: the brief's verbatim const trips clippy::cast_possible_truncation (pedantic, -D warnings). It
    now carries `#[expect(clippy::cast_possible_truncation, reason = "the compile-time assert before the cast
    proves MAX_TEXT_BYTES fits in u32")]`.
  - Block 4: the deleted file holds "b\n"×4 Mi + "b", not `over`. With `over`, or any text like it, git sees
    gone.txt → exact.txt as a rename. exact.txt's old side is then over the limit, so it loaded as TooLarge
    and failed the test, which I saw happen.
  - The test helper `submodule` takes a third parameter, `local`, and a new helper `submodule_file` builds
    the expected RangeFile::Submodule, so the longer test stays within 40 lines.

open_risks
  - crates/range/tests/listing_answers.rs:93: if a later edit makes gone.txt's text similar to exact.txt's,
    rename detection will silently turn the deleted-file case into a rename again.
```