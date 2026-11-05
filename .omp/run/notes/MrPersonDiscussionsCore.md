# MrPersonDiscussionsCore

Agent output (`agent://MrPersonDiscussionsCore`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsCore.md), collected 2026-11-05T13:51:24.812Z.

{
  "summary": "Person-discussions core added to `mergeRequests/`, no window wired. New `keptInPlace.ts` (generic, with `keyOf`) and `personDiscussions.ts` (`PersonGroup`/`PERSON_GROUPS`, `personGroupOf`, `personEntries`, `laterWriters`, `foldedWriters`, `personLines`). `starterOf`, `wroteIn`, `isUser` exported internally; `narrowed` generic over `{ label }`; index re-exports; AGENTS.md paragraph. Typecheck fails only in 3 `ipc/` files (`first` in flight); test, lint, fmt:check, unused pass.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/personDiscussions.ts",
    "frontend/src/mergeRequests/internal/personDiscussions.test.ts",
    "frontend/src/mergeRequests/internal/keptInPlace.ts",
    "frontend/src/mergeRequests/internal/keptInPlace.test.ts",
    "frontend/src/mergeRequests/internal/discussions.ts",
    "frontend/src/mergeRequests/internal/choices.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "the_persons_turn_is_group_one_for_the_viewer_and_for_another_person",
      "proves": "For both sam and anna: writing in it, being mentioned or being the author puts it in turn; writing the last comment never does (it falls to wrote)."
    },
    {
      "name": "started_is_the_starter_whose_turn_it_is_not",
      "proves": "anna starts and writes last → started, which beats reviewer; if she started and someone else wrote last → turn."
    },
    {
      "name": "wrote_is_a_later_comment_whose_turn_it_is_not",
      "proves": "A later comment with the last word → wrote, which beats reviewer."
    },
    {
      "name": "reviewer_is_a_reviewer_who_never_wrote / a_non_reviewer_is_never_reviewer",
      "proves": "Only a reviewer on the row gets reviewer; an assignee or approver only → other."
    },
    {
      "name": "every_other_discussion_is_other / a_null_person_puts_everything_in_other",
      "proves": "The fallback group, and that a null person is never in groups 1–4 (personGroupOf and personEntries)."
    },
    {
      "name": "a_deleted_writer_is_never_the_person",
      "proves": "A null author, or a row with a null author, never matches the person."
    },
    {
      "name": "groups_come_in_c2_order_and_newest_last_comment_first_inside_each",
      "proves": "Order across two rows is by C2 group, then newest first; each entry keeps its own row and its turn."
    },
    {
      "name": "equal_times_keep_the_rows_order_then_gitlabs",
      "proves": "The sort is stable: rows as listed, then discussions as given."
    },
    {
      "name": "the_writers_are_every_comment_after_the_first_oldest_first / the_fold_keeps_the_newest_writers",
      "proves": "D3 writers (repeats and nulls kept); D4 fold at fits 0, 1, 4, 5, 6 and 7."
    },
    {
      "name": "person_lines_list_me_first_then_everyone_once_by_name",
      "proves": "Me first, each person once from rows and writers, sorted by name, picture person kept. chosen covers person, Me-as-person and me-kind; no Me line when logged out."
    },
    {
      "name": "keptInPlace: a_held_item_keeps_its_index_and_takes_its_new_version, the_others_fill_in_next_order, a_held_item_gone_from_next_is_dropped, nothing_held_is_next",
      "proves": "The C3 held-item rule, with items keyed by keyOf."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run --project node <personDiscussions, keptInPlace, choices tests> --reporter verbose",
      "observed": "All 13 new personDiscussions/keptInPlace tests ✓ by name; the existing choices.test.ts ✓ unchanged (incl. 'narrowed keeps the choices whose label holds the typed text'); Tests 35 passed (35)"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files 308 passed (308); Tests 4596 passed (4596) (run before the last 2 assertions were added; src/mergeRequests rerun after: Tests 479 passed (479))"
    },
    {
      "command": "pnpm -C frontend lint ; pnpm -C frontend unused",
      "observed": "lint exit 0; unused (knip --include exports,types) exit 0, so no new export was flagged"
    },
    {
      "command": "pnpm -C frontend fmt:check",
      "observed": "All matched files use the correct format."
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "Fails, only in src/ipc/discussionDomain.test.ts, src/ipc/fixtureMergeRequestDiscussions.ts, src/ipc/tauriMergeRequests.test.ts: TS2741/TS2322 \"Property 'first' is missing/optional ... required in type 'OpenDiscussion'\". No error under mergeRequests/."
    },
    {
      "command": "just mutants HEAD",
      "observed": "All files 94.18 | 94.97 | killed 453 | survived 24 | no cov 4; keptInPlace.ts 100.00 (16 killed); personDiscussions.ts 94.44 (102 killed, 6 survived, all on PERSON_GROUPS lines 17–22)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → All files 94.18% (453 killed, 24 survived, 4 no coverage); keptInPlace.ts 100%; personDiscussions.ts 94.44% (6 survived)",
    "survivors": [
      "personDiscussions.ts:17:54 ArrayDeclaration, 18:3–22:3 StringLiteral (PERSON_GROUPS) — gate-covered: module-level mutants are not re-run under vitest (justfile:153, #732); a test asserts PERSON_GROUPS and the group order",
      "discussions.ts:59 and the choices.ts / discussions.ts survivors and no-coverage mutants are on unchanged lines (constants and bodies already there), not on the export or signature lines I changed"
    ]
  },
  "acceptance_not_run": [
    "pnpm -C frontend typecheck is red, from 3 ipc/ files (OpenDiscussion's required `first` from the rust slice, owned by mr-person-discussions-ipc). None of the errors is in mergeRequests/, but a green typecheck was not observed."
  ],
  "deviations_from_brief": [
    "discussions.ts: `isUser` is exported too (internally, not from index.ts), so the started/reviewer rules use it as written ('starterOf(discussion) is the person (isUser)') instead of copying it.",
    "personLines dedups via `mentions.ts` `knownMentions(null, [...rows.flatMap(peopleOnRow), ...writers])` (each username once, first wins, nulls dropped) instead of writing a second dedup. Cleaner option, outside Owned: export `eachUsernameOnce` from mentions.ts and call it.",
    "Design §2.4 says `foldedWriters` returns `folded: number`; the fixed Contract (`folded: readonly P[]`) was followed.",
    "I chose that a `me`-kind `chosen` marks the Me line whatever its username, and never a person's line (brief left it open; pinned in the test)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/mergeRequests/internal/personDiscussions.ts:130",
      "risk": "personLines reads the people through knownMentions; if the mentions dedup rule ever changes, the person menu changes with it."
    },
    {
      "location": "frontend/src/ui/mergeRequestsShown.ts:98-115",
      "risk": "The window still holds its own keptInPlace copy until mr-person-discussions-state switches it to the core one."
    }
  ]
}
