# Smoke — sidebar-next-file

Request `docs/slices/request-sidebar-next-file.md`; slice `sidebar-next-file-web`. Build first:
`cargo tauri build --debug --no-bundle`. Real WebDriver clicks (`just app-session click`), never synthetic events.
The fixture's `review` case cannot show the bug (its git order is a rotation of its tree order), so the order checks
use small real repos.

## 1. Diff window, real app

Repo (`/tmp/snr`): `main` with `a.txt`, `b/x.txt`, `b/y.txt`, `c.txt`, `z/w.txt` (a few lines each); `feature` off
it changes every file by a different number of lines. `just app-session start-app --name snr --range main...feature
--repo /tmp/snr`. Git order: a, b/x, b/y, c, z/w. Tree order: b/x, b/y, z/w, a, c.

- Tree view: show `b/y.txt`, Reviewed → `z/w.txt` shown (git order would give `c.txt`).
- Tree view: close folder `z`, show `b/y.txt`, unmark and Reviewed again → folder `z` opens, `z/w.txt` shown.
- Tree view: show `c.txt`, Reviewed → wraps to the first unreviewed tree row.
- List view: show `a.txt`, Reviewed → next unreviewed in list order.
- Total left of the view toggle: before any mark = Σ of all five files' `+a −r` (read the file rows); after each
  Reviewed it drops by that file's counts; unmark restores; all five reviewed → no total. Muted colour (computed colour
  equals a muted element's), `title` "left to review". Shots dark + light.

## 2. Merge window, real app

Repo (`/tmp/snm`): a merge in progress with conflicts in `a.txt`, `b/x.txt`, `c.txt`
(`just app-session start-app --name snm --repo /tmp/snm`). Tree order: b/x, a, c. Tree view: show `b/x.txt`, Take
left (or resolve + Mark resolved) → `a.txt` shown (git order would give `c.txt`). List view on a fresh repo: `a.txt`
→ `b/x.txt`. No total in this window's heading.
