```json
{
  "verdict": "pass",
  "lens": "correctness-reviewer",
  "survivors": [
    {
      "mutant": "crates/range/src/load.rs:75:10 replace == with != in is_link",
      "disposition": "drop (a) equivalent",
      "reason": "is_link has one caller, load.rs:45 `is_link(old_kind) != is_link(new_kind)`. The mutant negates both operands of that XOR at once, which leaves the result the same for every pair of kinds, so no input can tell them apart. The same expression mutated in the other direction (load.rs:45 `!=` → `==`) is killed: regular modified files would then answer KindChanged, and texts_carry_merge_core_compare_s_differences and a_link_is_shown_as_its_target_text would fail."
    },
    {
      "mutant": "crates/merge-core/src/lib.rs:26:37/26:44 `*` → `+` / `/` (4 mutants)",
      "disposition": "drop (b) gate-covered",
      "reason": "yamt-compare's the_column_limit_is_merge_core_s_text_limit (crates/compare/src/lib.rs:245) compares against the literal `MAX_COLUMN_BYTES: u32 = 8 * 1024 * 1024`. The four mutants give 1048584, 0, 9216 and 8, all different from 8388608, so `just check`'s test run kills them. Correction to the survivor note: yamt-range's exactly_8_mib_loads_and_one_byte_more_is_too_large does NOT pin the value. It builds `exact`, `over` and `limit` from MAX_TEXT_BYTES itself, so with MAX_TEXT_BYTES = 0 or 8 it still passes. It pins only the `>` boundary."
    }
  ],
  "findings": [
    {
      "severity": "should",
      "file": "crates/range/src/load.rs",
      "line": 61,
      "rule_id": "VF7",
      "problem": "No test exercises the old-side half of two guards: the size guard on line 61 (TooLarge is tested only for an added file) and the gitlink guard on line 37 (tested for changed and added submodules, never a deleted one). If either half were dropped, every test would still pass, and a deleted or modified file whose old blob is over 8 MiB would be read and sent over the IPC whole. As the app grows, nothing else depends on this; the cost stays inside this guard.",
      "fix": "In exactly_8_mib_loads_and_one_byte_more_is_too_large, also delete an over-limit file (`changed(\"gone.txt\", Some(over), None)`) and drop its object. In mode_only_kind_changed_and_submodule_are_sentences, add a removed submodule that expects `Submodule { old: Some(FIRST_COMMIT), new: None }`."
    },
    {
      "severity": "nit",
      "file": "crates/range/src/load.rs",
      "line": 74,
      "rule_id": null,
      "problem": "The one-caller helper is_link is what makes the equivalent mutant at line 75, so every later `just mutants` run (including the verifier's final one) reports it again and someone has to triage it again.",
      "fix": "Inline it as `(old_kind == RangeEntryKind::Link) != (new_kind == RangeEntryKind::Link)`. Each `==` is then mutated alone, which flips the XOR, and the existing tests kill it."
    }
  ],
  "checked": [
    "Spec reading (spec.rs:34-63) follows design §1: split at the first `..`, a following `.` means three dots, a right side starting with `.` or containing `..` is ExtraDots (the left cannot contain `..` because the split is at the first one), a side starting with `-` is Dash, an empty side becomes HEAD. Traced by hand: `a.b..c` → (a.b, Two, c); `x...` → (x, Three, HEAD); `a....b` → rest `..b` → `.b` → ExtraDots; `...dev` → (HEAD, Three, dev). Unit tests cover the brief's four valid examples and every error, and each_error_is_its_usage_line matches §1's table word for word.",
    "Dash also keeps option text out of `rev-parse --verify --quiet <name>^{commit}` (gitio repo.rs:41-44).",
    "Resolve order (open.rs:33-61) matches design §2: discover, left commit_named, right commit_named, merge_base only for three dots (NoMergeBase on gitio's silent exit 1), then two commit_summary calls. Both names resolve before the merge base, so `main...nope` is UnknownName and not NoMergeBase (tested). The left of `a...b` is labelled MergeBase{typed left, typed right} and the right is Named; three_dots_compares_the_merge_base_and_two_dots_the_tips checks labels, short ids and subjects for both forms.",
    "The merge base is the same first base `git diff a...b` uses (merge_base(left_tip, right_tip)). The criss-cross test is discriminating: base x1 would list {w,y}, base y1 would list {w,x,y}, and the test first asserts there are exactly 2 bases.",
    "Decision order (load.rs decide, lines 35-67) matches plan §2 #105 and design §7: submodule (either mode 160000) → kind change (link vs non-link) → mode only (same oid, kinds differ) → numstat Binary → size > MAX_TEXT_BYTES on either side → read → NotUtf8 → Texts. decide runs before blob_reader() is spawned, so nothing the listing can answer is ever read.",
    "Each listing-answered case is tested so that a read would fail: drop_object deletes the loose object, so a read errors and unwrap panics (binary 8 MiB+1, over.txt, mode-only run.sh, the kind-change entry on both sides). If binary and size were checked in the other order, binary_is_answered_before_size_and_without_reading would get TooLarge and fail.",
    "Deviation accepted: ModeOnly compares kinds rather than raw modes. git's tree-walk canonicalises modes when it reads a tree (`canon_mode`), so diff-tree only ever sees 100644/100755/120000/160000, and the two checks are equivalent.",
    "Texts: added → left \"\" and deleted → right \"\" (read_side None → empty), renamed → the old blob on the left, a link → its target text, and mode Changed only when both sides exist with different kinds. Tests: added_has_an_empty_left_and_deleted_an_empty_right, renamed_shows_the_old_text_left, a_link_is_shown_as_its_target_text, texts_carry_merge_core_compare_s_differences (File→Executable plus a content change → Changed{File, Executable}). Swapped compare arguments or empty differences would fail the `texts()` equality.",
    "UTF-8 (load.rs:15-31): String::from_utf8 per side gives NotUtf8 Left, Right or Both, the same rule as session decode.rs:42-44. An added side is \"\" and always valid. non_utf8_names_the_sides would catch Left and Right being swapped.",
    "8 MiB boundary: `size > MAX_TEXT_BYTES as u64` (load.rs:79) agrees with session decode.rs:31's `len() > MAX_TEXT_BYTES`, so exactly 8 MiB loads and one byte more is TooLarge. The test asserts right.len() == MAX_TEXT_BYTES; a `>=` mutant fails it. MAX_TEXT_BYTES is defined only in merge-core; session re-exports it (decode.rs:3) and compare pins its u32 copy.",
    "Lock key (lock.rs repo_key) follows plan #107 as amended: the folder name of the common git dir (its parent's for `.git`) + `-` + 16 hex FNV-1a 64 of the absolute common dir. Common dir comes from `rev-parse --path-format=absolute --git-common-dir`, which git realpaths, so it is the same from every worktree. The FNV vectors (`a`, ``, `foobar`) match the published ones.",
    "Lock tests: another_worktree_of_the_same_repository_shares_the_lock fails for a root-based key; a_different_pair_is_not_locked fails for a constant key (another repository's key must differ) and for a key that ignores the pair (other tips and the reversed pair). the_same_pair_twice_is_locked_naming_both_short_ids uses `<main oid>..HEAD`, which proves the folder comes from oids and not from the typed text, checks the left..right order in the message, and checks the lock is released on drop.",
    "Deviation accepted: the repo-key name comes from the common dir instead of the brief's work-tree folder. Plan #107 records it as amended 2026-10-24 after row 5's build.",
    "Lock semantics: an open + try_lock in the same process on a second handle gives WouldBlock (flock / LockFileEx are per open file description), so the in-process tests are valid. The refusal (Locked) names the current root and both short ids, as design §8 says.",
    "The listing is one changed_files run and one blob_sizes run. Ids are assigned after sort_by_display_path, so ids follow list order. an_unknown_id_is_unknown_file covers the 0-based edge (0 loads, 1 is UnknownFile). entries.rs tests check how sizes line up with blob_ids order, with a gitlink inside the list.",
    "Range: Send + Sync is checked at compile time (a_range_is_shared_between_threads). load takes &self and spawns its own BlobReader, so there is no shared mutable state.",
    "Open risks accepted. not_a_repository: discover runs only `rev-parse --show-toplevel`, so any GitFailed there means no work tree. unwrap_or(u32::MAX): boundary review already promoted a const for it.",
    "Risk register: no row's owner is touched apart from session decode.rs's constant (RK6). Its own decode tests are unchanged and it is now pinned through compare's test.",
    "Ran no tests. No block depends on one."
  ]
}
```