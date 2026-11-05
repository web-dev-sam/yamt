# Verify table-alignment — smoke after the slice, final run

Request `docs/slices/request-table-alignment.md` (rules 1–2, acceptance); slice brief `briefs/table-alignment.md`.
Read-only recipes only (VF6), never `just mutants` (VF7). Windows only on a private display.

ALIGNED (type it with real newlines):

```
| left | center | right |
| :--- | :---: | ---: |
| l | c | r |
```

For each table below, `read` every `th` and `td`: its computed `text-align` (`left`/`start`, `center`, `right`) and
its rect; a centred cell's text centre within 1 px of its cell's centre, a right cell's text right edge within its
padding of the cell's right edge. Paste the values.

## Smoke (after the slice's commit)

**B. WebKit fixture.** `just app-session start-fixture --name tav --diff --mr list --size 1600x1000`, the
merge-requests page, yamt Dark, then yamt Light (`--settings '{"theme":"light"}'`):

1. **Description (rule 1).** !640's description panel: the table "Card / State / Days" reads left, centre, right in
   the head and both body rows; borders and header weight as before (no other table styling changed).
2. **Local preview (rule 2).** d01's thread panel, type ALIGNED, press Preview: no "Loading…", the session log gains
   one `preview_local` and no `fixture_preview`; the head and body read left, centre, right.
3. `shot` of the description panel's table and of the panel's preview, dark and light.

**C. Real app.** `scripts/local-conflicts-repo.sh <scratch>/tav`, `cargo tauri build --debug --no-bundle`:

1. **Description through Rust (rule 1).** `just app-session start-app --name tav --diff --dir <scratch>/tav --glab
   mr-description`, the merge-requests page, !52's description: the "Left / Centre / Right" table reads left, centre,
   right (the fake now writes `align=` as gitlab.com does).
2. **Local preview (rule 2).** `just app-session start-app --name tav --diff --dir <scratch>/tav --glab mr-threads
   --mr`, d01's thread panel, ALIGNED, Preview: left, centre, right; no new `argv:` line in the fake glab's log.

## Final

`just check`; B1–B3 and C1–C2 again on the final commit.

## Owner check (GitLab playground)

Post a comment with ALIGNED on a merge request: in yamt, its preview, the posted comment and GitLab's web page all
show the middle column centred and the last right-aligned; put ALIGNED in a merge request's description: yamt's
description panel shows the same.
