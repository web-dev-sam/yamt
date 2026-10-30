# Fake glab scenarios

`scripts/fake-glab/glab` (POSIX sh) stands in for glab 1.124.0 in the Rust tests and in app sessions. Each folder
here is one scenario; the fake reads it from `$YAMT_FAKE_GLAB`.

## Environment

| variable | what |
|---|---|
| `YAMT_FAKE_GLAB` | the scenario folder (required; without it every call exits 2) |
| `YAMT_FAKE_GLAB_STATE` | a file holding how many posts were answered so far (missing = 0); each post adds one. Required for posts |
| `YAMT_FAKE_GLAB_LOG` | a file every call is appended to (optional) |

Each variable left unset is read from a `glab.env` file in the folder of `$0` (for a fake run through a symlink,
the link's folder), one `NAME=value` line per variable, the value taken as written (no quotes); any other line
exits 2. The Rust tests run the fake this way: a symlink `glab` beside its `glab.env` in a temporary folder, so no
test ever runs a file it has just written (ETXTBSY).

## Scenario folder

| file | answers |
|---|---|
| `auth-status.out` | `glab auth status`: printed on **stderr**, as glab prints all of it |
| `auth-status.exit` | its exit status (missing = 0) |
| `project.json` | `glab api` GET `projects/:fullpath` |
| `merge-requests.json` | `glab api` GET `…/merge_requests` (by branch) and `…/commits/<id>/merge_requests` |
| `merge-request-<iid>.json` | `glab api` GET `…/merge_requests/<iid>` for that iid |
| `merge-request.json` | `glab api` GET `…/merge_requests/<iid>` for any iid without its own file |
| `draft-notes.json` | `glab api` GET `…/draft_notes` (`--paginate` accepted) |
| `post-<n>.json` | the body of the n-th POST `…/draft_notes` (n from 1, counted in the state file) |
| `post-<n>.status` | its HTTP status line (missing = `201 Created`) |
| `post-<n>.err` | for a status of 400 or more: what glab prints on stderr instead of its own `glab: <message> (HTTP <code>)`; required when the body has no string `"message"` (else the fake exits 2 with "fake glab: no recorded stderr for this body") |
| `post-<n>.exit` | glab failed before any HTTP answer: `post-<n>.err` (if any) on stderr, this exit status, nothing on stdout |
| `post-<n>.sleep` | seconds to wait before answering (a post that hangs) |
| `graphql-page-<n>.json` | `glab api graphql` without a field `iid`: page 1 without a field `after`, page n for `after=page-<n>` (so each page's `endCursor` is `page-<n+1>`) |
| `graphql-merge-request-<iid>.json` | `glab api graphql` with a field `iid=<iid>` |
| `graphql-*.status`, `.err`, `.exit`, `.sleep` | as for `post-<n>`, beside each `graphql-*.json` (status missing = `200 OK`) |

`glab api` keeps the value of every `-f`/`--raw-field`/`-F`/`--field` as `name=value` (the first wins when a name
is given twice) and, as glab does, sends a POST when a field or `--input` is given without `-X`/`--method`. A GET
whose file is missing, or any other endpoint, answers `404 Not Found` with the body `{"message":"404 Not Found"}`.
A POST or GraphQL call whose `.json` is missing, or an `after` not of the form `page-<n>`, exits 2. Any other glab
command exits 2 with "fake glab: unknown command".

## What the fake prints, as glab 1.124.0 does

Measured with `HOME` and `XDG_CONFIG_HOME` in a temporary folder (no token), against gitlab.com:

- `glab api <endpoint>` prints the body as GitLab sent it, without a final newline, on stdout; stderr is empty;
  exit 0.
- With `--include`, stdout starts with the status line (`HTTP/2.0 200 OK`), then the headers and an empty line,
  each ending in CRLF, then the body. The fake prints only `Content-Type: application/json` among the headers.
- An HTTP error (`glab api projects/gitlab-org%2Fno-such-project-yamt`): stdout holds the error body
  (`{"message":"404 Project Not Found"}`, headers first with `--include`), stderr
  `glab: 404 Project Not Found (HTTP 404)` and a newline, exit 1. The fake takes the message from the body's
  `"message"` string; it never invents one.
- `glab auth status` with no token: everything on stderr — the instance (`gitlab.com`), the failed API call,
  "No token found …", the ERROR box — and exit 1. `auth-status.out` in `runner/` is that text (trailing spaces
  dropped).
- The first glab run under a fresh config folder may add a one-time "What's new in glab v1.124.0" notice to stderr.
  The fake never does.

## Log

Each call appends:

```
argv: <the arguments, joined by spaces>
cwd: <the working folder, symlinks resolved>
env: NO_COLOR=<value or unset> GIT_TERMINAL_PROMPT=<value or unset>
stdin: <stdin as read, then a newline>     (only with `--input -`)
```

## Scenarios

- `runner/` — `yamt-gitio`'s own tests (`crates/gitio/tests/glab.rs`): post 1 is accepted, post 2 refused with
  400, post 3 fails before any answer (its stderr is the fake's own words, not glab's), post 4 hangs for 5 s,
  post 5 is refused with 400 and a body without `"message"` and no `.err` (the fake's own refusal, exit 2).
- `slow-post/` — `src-tauri/src/review.rs`'s send through the commands: `lined-up/` with only post 1, which waits
  2 s before it is accepted, so a second send can arrive while it runs.
- `merge-requests/` — the merge-request list and opening one (`crates/merge-requests/tests/{list,open}.rs`,
  `src-tauri/src/merge_requests/tests.rs`): logged in; project `taskboard/taskboard` on `https://gitlab.example`;
  user `sam`. Page 1: !13 (failed pipeline, two failed jobs, `lint` allowed to fail; `CI_MUST_PASS`), !12 (passed, 2
  approvals, 1 open discussion; `MERGEABLE`), !11 (a draft, "Draft: …", running; `DRAFT_STATUS` and conflicts), more
  to come (`page-2`); page 2: !9 (no pipeline; `NEED_REBASE`, no diff stats), !8 (manual; no merge status, from a
  fork), the last. Details over GraphQL, all from `scripts/range-repo.sh`'s merge base `531ea52` and, but for !17, into
  `main`: !12 ends at `feature` (`9c1ba3f`), !13 at `6ea97d8` ("Snooze a reminder", only in range-repo's fake
  GitLab), !14 has no diff yet (`diffRefs` null), !15 is merged, !16 starts from `deadbee`, a commit no repository
  has, !17 is !13's diff into a branch named `main:refs/heads/x`, which a fetch refspec would read as a ref to write.
  Over REST, as a window on one of those ranges checks it (#119): `merge-requests.json` lists !13 and !12,
  `merge-request-12.json` and `merge-request-13.json` hold their diffs.
- `merge-requests-timeout/` — `merge-requests/`'s project and first page, which waits 25 s: a list past glab's
  deadline.
- `mr-conflicts/` — merge readiness on the list and the branches resolving a merge request's conflicts needs
  (`crates/merge-requests/{src/page/tests.rs,tests/resolve.rs}`, the merge-request conflicts app tests): logged in;
  `merge-requests/`'s project; user `sam`; one page, the last: !32 (a draft, `CI_MUST_PASS`, conflicts), !31 (a draft,
  `DRAFT_STATUS`, conflicts), !29 (`CONFLICT`, stale: `feature/merged` already contains `main`), !28 (the unknown
  `MERGE_TRAIN_STUCK`), !27 (`MERGEABLE`, no diff stats), !26 (`UNCHECKED`), !25 (a draft, `DRAFT_STATUS`), !24
  (`NEED_REBASE`), !23 (`CONFLICT`, stale: `feature/clean` merges clean), !22 (`CONFLICT`, from a fork: source project
  2, target 1), !21 (`CONFLICT`, `feature/due-dates` conflicts with `main`). The branches query over GraphQL, the
  branch names of `scripts/mr-conflict-repo.sh`, into `main` but for !34: !21 `feature/due-dates`, !22
  `feature/colours` from the fork, !23 `feature/clean`, !29 `feature/merged`, !30 merged, !33
  `feature/x:refs/heads/main` and !34 `feature/due-dates` into `main:refs/heads/x`, branch names a fetch refspec
  would read as a ref to write.

## Fake browser opener

`scripts/fake-open/xdg-open` stands in for xdg-open, first on PATH: it opens nothing, appends `argv: <arguments>`
to `$YAMT_FAKE_OPEN_LOG` (when unset, read from an `open.env` beside it, one `YAMT_FAKE_OPEN_LOG=<file>` line) and
exits 0.
