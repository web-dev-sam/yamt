# Fake glab scenarios

`scripts/fake-glab/glab` (POSIX sh) stands in for glab 1.124.0 in the Rust tests and in app sessions. Each folder
here is one scenario; the fake reads it from `$YAMT_FAKE_GLAB`.

## Environment

| variable | what |
|---|---|
| `YAMT_FAKE_GLAB` | the scenario folder (required; without it every call exits 2) |
| `YAMT_FAKE_GLAB_STATE` | a file holding how many posts were answered so far (missing = 0); each post adds one. Required for posts |
| `YAMT_FAKE_GLAB_LOG` | a file every call is appended to (optional) |

## Scenario folder

| file | answers |
|---|---|
| `auth-status.out` | `glab auth status`: printed on **stderr**, as glab prints all of it |
| `auth-status.exit` | its exit status (missing = 0) |
| `merge-requests.json` | `glab api` GET `…/merge_requests` (by branch) and `…/commits/<id>/merge_requests` |
| `merge-request.json` | `glab api` GET `…/merge_requests/<iid>` |
| `draft-notes.json` | `glab api` GET `…/draft_notes` (`--paginate` accepted) |
| `post-<n>.json` | the body of the n-th POST `…/draft_notes` (n from 1, counted in the state file) |
| `post-<n>.status` | its HTTP status line (missing = `201 Created`) |
| `post-<n>.err` | for a status of 400 or more: what glab prints on stderr instead of its own `glab: <message> (HTTP <code>)` |
| `post-<n>.exit` | glab failed before any HTTP answer: `post-<n>.err` (if any) on stderr, this exit status, nothing on stdout |
| `post-<n>.sleep` | seconds to wait before answering (a post that hangs) |

A GET whose file is missing, or any other endpoint, answers `404 Not Found` with the body
`{"message":"404 Not Found"}`. Any other glab command exits 2 with "fake glab: unknown command".

## What the fake prints, as glab 1.124.0 does

Measured with `HOME` and `XDG_CONFIG_HOME` in a temporary folder (no token), against gitlab.com:

- `glab api <endpoint>` prints the body as GitLab sent it, without a final newline, on stdout; stderr is empty;
  exit 0.
- With `--include`, stdout starts with the status line (`HTTP/2.0 200 OK`), then the headers and an empty line,
  each ending in CRLF, then the body. The fake prints only `Content-Type: application/json` among the headers.
- An HTTP error (`glab api projects/gitlab-org%2Fno-such-project-yamt`): stdout holds the error body
  (`{"message":"404 Project Not Found"}`, headers first with `--include`), stderr
  `glab: 404 Project Not Found (HTTP 404)` and a newline, exit 1. The fake takes the message from the body's
  `"message"` string, or else the status line's words.
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
  400, post 3 fails before any answer (its stderr is the fake's own words, not glab's), post 4 hangs for 5 s.
