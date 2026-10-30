# Slice MrPageR1 — fix round 1 of the merge-request page

Board "Merge requests" row 6. Round 1: `MrPage` (commit `4235536`, brief `docs/slices/briefs/mr-page.md`, notes
`.omp/run/notes/MrPage.md`); the smoke pass of the real app: `.omp/run/notes/MrSmoke.md`. Fix exactly these
(`just findings 1956 1957 1958 1959 1960 1963 1964 1965 1966`):

1. **#1956** One focus-return rule for full-window pages (e.g. `ui/focusReturn.ts`), used by `SettingsView.vue` and
   `MergeRequestsView.vue`; Settings behaves as before.
2. **#1957** Whether a `ListEnd` is a failure, and its sentence, decided once (words file or slice) and used by the
   view and the slice.
3. **#1958** `ciStatusText(status)` exported by `mergeRequests/`, used by `ciBox` and `CiStatusBox.vue`; the dead
   fallback gone.
4. **#1959** The page's words (box title, "allowed to fail", button titles, Clear filters, Retry, Dismiss, the count
   plural) live in `mergeRequestsText.ts`, reusing an existing plural helper rather than a third copy; `ui/AGENTS.md`'s
   sentence then holds.
5. **#1963** A load that runs with no rows shows "Loading merge requests…" (Retry after a failed first load,
   Refresh of an empty list); a load after a failed first load streams its pages as the first does.
6. **#1964** Scrolling the list while focus is inside the CI box leaves the box's open/close state right: the next
   hover opens it and leaving closes it.
7. **#1960, #1965, #1966** The app-session sweep keys on a session-unique entry built in one place for start and stop;
   a yamt whose environ cannot be read is skipped (test); a stop after opening !13 reports the child stopped.

## Target

Owned: `frontend/src/ui/{MergeRequestsButton,MergeRequestsView,MergeRequestRow,MergeRequestFilter,CiStatusBox,SettingsView}.vue`,
`frontend/src/ui/{focusReturn,mergeRequestsText,mergeRequests}.ts` and their `*.test.ts`, `frontend/src/ui/AGENTS.md`,
`frontend/src/mergeRequests/**`, `frontend/scripts/app-session/**`. Read-only: everything else. The slice's
contract (design §6 "B4 → B5") may gain members; none changes.

## Acceptance

- Node tests: item 2's classification, item 3's text, item 5's slice behaviour (fails on round 1), item 7's skip of an
  unreadable environ and the session key.
- WebKit fixture (`just app-session start-fixture`, private display), both windows: Settings and the page each return
  focus to their button; `?mr=loggedOut` → Retry shows the loading sentence while it runs; Tab into the CI box, scroll
  the list, hover the icon (opens), leave (closes); words unchanged on screen.
- Real app: `start-app --range main...feature --repo <range-repo> --glab merge-requests`, open !13, `stop`: the report
  lists the child as stopped and no yamt process is left.
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused`, `sfc-order` pass.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
