# Merge-request heading — design: the changes window names its merge request, branches and +/− totals

Agent: `designer`. Output: two or three file-level options plus a recommendation (your output schema), the design
document `docs/slices/briefs/mr-heading-design.md`, and one brief per build of the recommended option
(`docs/slices/briefs/mr-heading-<build>.md`) plus `mr-heading-verify.md`. Builds run at most two at a time; split the
files into **disjoint** ownership lists per build (name every file each creates or changes), order them by
dependency, and write every contract between builds in full (Rust types, IPC types and commands, argument syntax,
store fields, fixture parameters). Each build ≤ ~25 files and ≤ ~1,500 changed lines. Generated files
(`ipc/bindings.ts`) and shared paths are never owned: say which build needs `just bindings` after it.

The request: `docs/slices/request-mr-heading.md` (owner's words, rules 1–6, acceptance, non-goals). Read it in full; a
design may refine a detail a rule names, never reopen a rule. Plan §2 #119 and #132 are settled: the comparison stays
`<base_sha>..<head_sha>`.

## What each option must answer

1. **Data path (rule 5).** How the title, source and target branch reach the changes window from `prepare_open`
   (`crates/merge-requests/src/open.rs`: the details query in `query.rs`, `RangeToOpen` in `lib.rs:202-209`,
   `range_arguments` in `src-tauri/src/second_window.rs:45-57`, the argument parser `src-tauri/src/args.rs` and its
   tests): new arguments, or an extension of `--review-of`, or another channel — with how a title holding any
   character (quotes, newlines, `=`, a leading `-`) crosses a process argument safely on Linux, macOS and Windows, and
   how an old-style start without names behaves (rule 6). Fork merge requests: the exact source-branch form, sourced
   (GitLab GraphQL `MergeRequest` fields, or the fake glab's recorded answers under `tests/glab/`).
2. **Totals (rule 4).** One place computes them (vision 2): Rust over `Range`'s entries into `RangeStart`, or the
   frontend over `RangeStart.files` — choose with reason; the window title (Rust, `range_title`) and the in-window line
   must read the same number. Overflow: counts are `u32` per file.
3. **Labels (rule 3).** Today `RangeSideLabel { Named | MergeBase }` (`crates/range/src/lib.rs:28-36`), `sideLabel` /
   `sideHeading` (`frontend/src/ui/rangeText.ts:66-72`), headers in `RangeView.vue:173-185`, `emptyRangeText`. How the
   changes window's sides become "target, where source branched off" / "source" without a second source of truth for a
   side's name (sum types over flags, vision 4), and what `lines_up.rs` / `right_branch.rs` read from labels today (the
   right side's branch lookup must not change behaviour: a changes window still finds its MR by commit).
4. **The window (rule 2).** Component(s), placement, palette tokens (existing only; name them from `frontend/src/
   styles` / Tailwind config), text constants in `rangeText.ts`, how the line fits beside `RangeView.vue`'s header
   controls at 1280 px; one component for both window kinds.
5. **Title bar (rule 1).** `range_title` / `window_title` and its tests; the exact separators and minus sign.
6. **Tests per layer** with the bug each catches; fixture variants for both window kinds (`?range` scripts); the
   real-app recipe on `range-repo.sh` (!13) with the fake glab; WebKit steps dark and light.

## Facts to start from (verify, cite)

- `prepare_open` → `RangeToOpen { root, spec, project, iid }`; the child runs `yamt --diff=<spec> --repo <root>
  --review-of=<project>!<iid>` (`second_window.rs:45-57`).
- Window title: `range_title(spec, root)` = `"{spec} — {folder} — yamt"` (`src-tauri/src/range.rs:97-98`,
  `window.rs:187-190`).
- Per-file counts: `RangeLineCounts::Counted { added, removed } | NotCounted` (`crates/range/src/lib.rs:54-59`,
  `entries.rs:153-157`); shown by `RangeCounts.vue` in `text-success-signal` / `text-problem-error`.
- `RangeStart { range, left, right, files }` (`crates/range/src/lib.rs:81-87`) is what the page receives.
