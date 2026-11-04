# Fake glab scenarios

`scripts/fake-glab/glab` (POSIX sh) stands in for glab 1.124.0 in the Rust tests and in app sessions. Each folder
here is one scenario; the fake reads it from `$YAMT_FAKE_GLAB`.

## Environment

| variable               | what                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `YAMT_FAKE_GLAB`       | the scenario folder (required; without it every call exits 2)                                            |
| `YAMT_FAKE_GLAB_STATE` | a file holding how many posts were answered so far (missing = 0); each post adds one. Required for posts |
| `YAMT_FAKE_GLAB_LOG`   | a file every call is appended to (optional)                                                              |

Each variable left unset is read from a `glab.env` file in the folder of `$0` (for a fake run through a symlink,
the link's folder), one `NAME=value` line per variable, the value taken as written (no quotes); any other line
exits 2. The Rust tests run the fake this way: a symlink `glab` beside its `glab.env` in a temporary folder, so no
test ever runs a file it has just written (ETXTBSY).

A Rust test that needs post n without making posts 1 to n − 1 first calls `Fake::answered_posts(n - 1)`
(`crates/merge-requests/tests/fake_glab/mod.rs`): it writes n − 1 to the state file, so the next post answers
`post-<n>`.

## Scenario folder

| file                                          | answers                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-status.out`                             | `glab auth status`: printed on **stderr**, as glab prints all of it                                                                                                                                                                                                                                                                                   |
| `auth-status.exit`                            | its exit status (missing = 0)                                                                                                                                                                                                                                                                                                                         |
| `auth-status.after-post-<k>.out`, `.exit`     | once the state file counts n posts, for the largest k ≤ n for which either file exists: they replace `auth-status.out` and `.exit` (a missing one of the pair: no output, exit 0), so glab can log out or in again mid-test                                                                                                                                    |
| `api-status.after-post-<k>`                   | for the largest k ≤ n with such a file: a status line (`401 Unauthorized`) makes every `glab api` call, any method or endpoint, answer it with the body `{"message":"<status line>"}`, stderr `glab: <status line> (HTTP <code>)` and exit 1 (status line and headers first with `--include`), counting no post; `graphql` answering 401 prints as glab does for GraphQL (below); the line `anonymous` answers as GitLab answers a call without a token (below): a GraphQL mutation (`--input -`) gets GitLab's denial in a `200 OK`, the body `{"errors":[{"message":"<denial>"}],"data":null}`, stderr `glab: <denial>` and exit 1, any other POST or PUT `401 Unauthorized`, a GET or a GraphQL read answers as usual; an empty file answers as usual |
| `project.json`                                | `glab api` GET `projects/:fullpath`                                                                                                                                                                                                                                                                                                                   |
| `merge-requests.json`                         | `glab api` GET `…/merge_requests` (by branch) and `…/commits/<id>/merge_requests`                                                                                                                                                                                                                                                                     |
| `merge-request-<iid>.json`                    | `glab api` GET `…/merge_requests/<iid>` for that iid                                                                                                                                                                                                                                                                                                  |
| `merge-request.json`                          | `glab api` GET `…/merge_requests/<iid>` for any iid without its own file                                                                                                                                                                                                                                                                              |
| `draft-notes-<iid>.json`                      | `glab api` GET `…/merge_requests/<iid>/draft_notes` for that iid (the viewer's drafts on one merge request; `--paginate` accepted)                                                                                                                                                                                                                    |
| `draft-notes.json`                            | `glab api` GET `…/draft_notes` without its own `draft-notes-<iid>.json` (`--paginate` accepted)                                                                                                                                                                                                                                                       |
| `markdown.json`                               | `glab api` POST `markdown` (GitLab's Markdown preview): answered as `post-<n>` is (status missing = `201 Created`, `markdown.status`, `.err`, `.exit`, `.sleep` beside it) but never counted, since a preview writes nothing                                                                                                                          |
| `post-<n>.json`                               | the body of the n-th POST `…/draft_notes`, POST `…/draft_notes/bulk_publish` (submit a review), POST `…/discussions/<id>/notes` (a reply), PUT `…/discussions/<id>` (resolve or unresolve) or `glab api graphql --input -` (a GraphQL mutation: the re-request, or adding or removing an assignee or a reviewer; n from 1, counted in the state file) |
| `post-<n>.status`                             | its HTTP status line (missing = `201 Created`)                                                                                                                                                                                                                                                                                                        |
| `post-<n>.err`                                | for a status of 400 or more: what glab prints on stderr instead of its own `glab: <message> (HTTP <code>)`; required when the body has no string `"message"` (else the fake exits 2 with "fake glab: no recorded stderr for this body")                                                                                                               |
| `post-<n>.exit`                               | glab failed before any HTTP answer: `post-<n>.err` (if any) on stderr, this exit status, nothing on stdout                                                                                                                                                                                                                                            |
| `post-<n>.sleep`                              | seconds to wait before answering (a post that hangs)                                                                                                                                                                                                                                                                                                  |
| `graphql-page-<n>.json`                       | `glab api graphql` without `--input -` and without a field `iids`, `search` or `iid` and not the links lookup: page 1 without a field `after`, page n for `after=page-<n>` (so each page's `endCursor` is `page-<n+1>`)                                                                                                                               |
| `graphql-links-<iids0>.json`                  | `glab api graphql` without `--input -`, with a field `query` starting `query MergeRequestLinks` (a merge request's links lookup), whatever its other fields: `<iids0>` is the field `iids0=<JSON array>` without its quotes, brackets and spaces, its commas as `-` (`iids0=["12","13","99"]` → `graphql-links-12-13-99`)                             |
| `graphql-discussions-<iids>.json`             | `glab api graphql` without `--input -`, with a field `iids=<JSON array>` (the discussions query): `<iids>` is the array without its quotes, brackets and spaces, its commas as `-` (`iids=["82","81"]` → `graphql-discussions-82-81`); with a field `discussionsAfter=<cursor>`, `graphql-discussions-<iids>-after-<cursor>`                          |
| `graphql-people-<text>.json`                  | `glab api graphql` without `--input -` and without a field `iids`, with a field `search=<text>` (the project's people search): `<text>` as given (`search=er` → `graphql-people-er`)                                                                                                                                                                  |
| `graphql-description-<iid>.json`              | `glab api graphql` without `--input -` and without a field `iids` or `search`, with a field `query` starting `query MergeRequestDescription` (a merge request's description) and a field `iid=<iid>`                                                                                                                                                  |
| `graphql-merge-request-<iid>.json`            | `glab api graphql` without `--input -` and without a field `iids` or `search`, with a field `iid=<iid>` and any other query                                                                                                                                                                                                                           |
| `graphql-*.status`, `.err`, `.exit`, `.sleep` | as for `post-<n>`, beside each `graphql-*.json` (status missing = `200 OK`)                                                                                                                                                                                                                                                                           |
| `<answer>.after-post-<k>.json`                | for any answer but a post (`graphql-*`, `draft-notes-<iid>`, `markdown`): once the state file counts n > 0 posts, `<answer>.after-post-<k>` replaces `<answer>` for the largest k ≤ n whose `.json` exists, its `.status`, `.err`, `.exit` and `.sleep` with it, so a read after the k-th write shows it                                              |
| `pictures/<path>`                             | `glab api` GET of a full address (`https://<host>/<path>?<query>`): the file at the address's path after its host, its query dropped, printed with `cat` byte for byte, exit 0; no such file answers `404 Not Found`; a `pictures/<path>.status` answers that status line with no body instead                                                        |
| `pictures/<path>.sleep`                       | seconds to wait before that picture's answer (a slow picture), whether or not the picture exists                                                                                                                                                                                                                                                      |
| `traces/<n>.log`                              | `glab api` GET `projects/<project>/jobs/<n>/trace` (a job's log, any project): printed with `cat` byte for byte, exit 0 (an empty file prints nothing); no such file answers `404 Not Found`                                                                                                                                                          |
| `traces/<n>.log.sleep`                        | seconds to wait before that log's answer, whether or not the log exists                                                                                                                                                                                                                                                                               |
| `uploads/<project>/uploads/<secret>/<file>`   | `glab api` GET `projects/<project>/uploads/<secret>/<file>` (the uploads API; `<project>` as asked, an id or an encoded path): printed with `cat` byte for byte, exit 0; no such file answers `404 Not Found`; a `.status` beside it answers that status line with no body instead                                                                    |

`glab api` keeps the value of every `-f`/`--raw-field`/`-F`/`--field` as `name=value` (the first wins when a name
is given twice) and, as glab does, sends a POST when a field or `--input` is given without `-X`/`--method`. A GET
whose file is missing, or any other endpoint, answers `404 Not Found` with the body `{"message":"404 Not Found"}`.
A POST or GraphQL call whose `.json` is missing, or an `after` not of the form `page-<n>`, exits 2. Any other glab
command exits 2 with "fake glab: unknown command".

`-F iids=["82","81"]` sends a JSON array of strings as the variable, measured on glab 1.126.0 against gitlab.com on
2026-11-03 (`mergeRequests(iids: $iids)` answered all 20 merge requests of a 20-string array). The fake keeps the
field as written.

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
- A 3xx answer to a GET: glab 1.126.0 follows it silently (`glab api --include https://gitlab.com/gitlab-org/gitlab.git`
  printed `HTTP/2.0 200 OK`, while curl saw a 302, on 2026-11-04; `internal/api/redirect.go`). A 3xx it does not
  follow (no `Location`) is an error: stdout holds the body, stderr `glab: HTTP <code>` and a newline, exit 1
  (`internal/commands/api/api.go`, `resp.StatusCode > 299`). The fake answers every 3xx so.
- A GraphQL call GitLab answers 401 (`GITLAB_TOKEN=glpat-yamt-invalid-token glab api graphql -f query='query {
  currentUser { username } }'`, glab 1.126.0 against gitlab.com on 2026-11-04): stdout `HTTP/2.0 401 Unauthorized`
  with `--include`, the body `{"errors":[{"message":"Invalid token"}]}`, stderr `glab: Invalid token` — no
  `(HTTP 401)` — exit 1. The same token on REST (`glab api projects/…`) prints `{"message":"401 Unauthorized"}` and
  `glab: 401 Unauthorized (HTTP 401)`, exit 1.
- Without a login, `glab api --method POST markdown --input -` is refused: `h=$(mktemp -d); jq -n '{text:"x",
  gfm:true, project:"samubr/glab-yamt-playground"}' | HOME=$h XDG_CONFIG_HOME=$h glab api --method POST markdown
  --input -` printed the body `{"message":"401 Unauthorized"}`, stderr `glab: 401 Unauthorized (HTTP 401)`, exit 1
  (glab 1.126.0, 2026-11-04; that glab still found a token GitLab refuses in the system keyring). `curl` with no
  token answered the same `401` for the playground and for the public `gitlab-org/gitlab`, and for a REST write
  (`POST projects/samubr%2Fglab-yamt-playground/merge_requests/999999/notes`).
- A GraphQL mutation without a token (`curl` with no token, `mergeRequestSetReviewers` on `gitlab-org/gitlab` and on
  the playground, a missing iid, 2026-11-04) answers `200 OK` with
  `{"errors":[{"message":"The resource that you are attempting to access does not exist or you don't have permission
  to perform this action",…}],"data":{"changed":null}}`. Logged in, the same mutation on a missing iid prints that
  body, stderr `glab: The resource that you are attempting to access does not exist or you don't have permission to
  perform this action` and exit 1 (glab 1.126.0); with an invalid token it answers `401` with `Invalid token`, as
  above. A GraphQL read without a token sees a public project (`gitlab-org/gitlab`) and `project: null` for a
  private one.
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
answered: <address or endpoint>            (a picture or a job's log, after its .sleep and before its answer)
```

## Scenarios

- `runner/` — `yamt-gitio`'s own tests (`crates/gitio/tests/glab.rs`): post 1 is accepted, post 2 refused with
  400, post 3 fails before any answer (its stderr is the fake's own words, not glab's), post 4 hangs for 5 s,
  post 5 is refused with 400 and a body without `"message"` and no `.err` (the fake's own refusal, exit 2).
- `slow-post/` — `src-tauri/src/review.rs`'s send through the commands: `lined-up/` with only post 1, which waits
  2 s before it is accepted, so a second send can arrive while it runs.
- `line-range/` — `crates/review/tests/review.rs`'s threads on a range of lines: `lined-up/`'s merge request !12, no
  drafts, posts 1 and 2 accepted as drafts 201 and 202.
- `line-range-drafted/` — as `line-range/`, with two drafts already on GitLab: 401 holds the in-column range of
  `src/board/board.ts` (unchanged L197/R201 to added R204, its `line_range` with `"type": null` on the unchanged
  start), 402 the both-sides text on R204 alone (`"line_range": null`); post 1 is accepted as draft 501.
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
- `local-conflicts/` — the list's local conflict check (`crates/merge-requests/tests/local_conflicts.rs`, the
  merge-request app tests in `src-tauri/src/merge_requests/tests.rs`) on `scripts/local-conflicts-repo.sh`'s
  repository: logged in; `merge-requests/`'s project; user `sam`; one page, the last, from project 1 into `main`
  unless said, each `diffHeadSha` a branch tip of `scripts/mr-conflict-repo.sh` and the fake GitLab's
  `refs/merge-requests/<iid>/head` the same commit unless said. After the check: !41 (`CONFLICT`, conflicts;
  `feature/clean`) merges clean → `mergesCleanly`; !42 (`MERGEABLE`; `feature/due-dates`) → `conflicts`; !43
  (`CHECKING`; `feature/merged`) → `mergesCleanly`; !44 (`MERGEABLE`; `feature/clean`, its head ref at
  `feature/due-dates`: a push in flight) keeps GitLab's answer (moving); !45 (`UNCHECKED`, from a fork, source
  project 2; `c595b71`, the fork's commit, only in the head ref) is fetched → `mergesCleanly`; !46 (`NEED_REBASE`;
  `feature/clean`) stays `needsRebase`; !47 (a draft, `DISCUSSIONS_NOT_RESOLVED`; `feature/due-dates`) →
  `conflicts { also: [discussions, draft] }`; !48 (`CHECKING`, into `develop`; `feature/clean`) → `mergesCleanly`;
  !49 (`PREPARING`, `diffHeadSha` null, no head ref) keeps GitLab's answer. The other recorded pages name
  `targetBranch` but no `diffHeadSha`, so their rows are never checked.
- `mr-row-details/` — the merge-request rows' people, labels, sizes and the re-request
  (`crates/merge-requests/{src/page/tests.rs,tests/list.rs,tests/rerequest.rs,tests/picture.rs}`, the picture and
  re-request app tests in `src-tauri/src/merge_requests/tests/`): logged in; `merge-requests/`'s project; user `sam`;
  one page, the last (`queryComplexity` 170 of 250, as gitlab.com measured the query on 2026-11-02); no `diffHeadSha`,
  so the local check runs no git. !52 (`MERGEABLE`, `updateMergeRequest` true): author anna (her avatar the path
  `/uploads/-/system/user/avatar/2/avatar.png`), assignee sam (the absolute
  `https://gitlab.example/uploads/-/system/user/avatar/1/avatar.png`), reviewers ben (`REVIEWED`, a Gravatar on
  `secure.gravatar.com` with a 64-digit hash and `?s=80&d=identicon`), chiara (`approved: true` with `reviewState:
  REVIEWED`, as a GitLab older than 16.11 answers; no avatar) and dmitri (`UNREVIEWED`, a Libravatar address: a custom
  Gravatar host, so no picture); approved by chiara; labels `frontend` (`#428BCA`/`#FFFFFF`), `bug`
  (`#D9534F`/`#FFFFFF`) and `odd` (`red`, so no colours); `diffStats: []` with `diffRefs` set (a zero size); a passed
  pipeline. !51 (`PREPARING`, `updateMergeRequest` true): author null, no one assigned, no reviewer, no label,
  `diffStats: []` and `diffRefs: null` (no size), no pipeline. !50 (`DISCUSSIONS_NOT_RESOLVED`, `updateMergeRequest`
  false): author ben, assignee dmitri, reviewers anna (`REQUESTED_CHANGES`), sam (`REVIEW_STARTED`), ben
  (`REVIEWED`) and erik (`MERGE_TRAIN_REVIEW`, a state yamt does not know), approved by anna and sam, two files. The
  reviewers query: `graphql-merge-request-52.json` (open; ben `gid://gitlab/User/4`, chiara `…/5`, dmitri `…/6`
  still `UNREVIEWED`), `graphql-merge-request-50.json` (merged since). Post 1 (`200 OK`) is the re-request of ben on
  !52, answering ben `UNREVIEWED`; post 2 (`200 OK`) the mutation's own error `Reviewer not found`.
  `pictures/uploads/-/system/user/avatar/1/avatar.png` and `/2/avatar.png` are small PNGs (each holds NUL bytes).
- `mr-row-details/crowd/` — many uploaded pictures at once (the picture app tests): `mr-row-details/`'s project and
  user; one merge request, !60, by anna (`/2/avatar.png`, a PNG) with assignees erik (`/3/avatar.png`: an HTML page,
  so no picture), `plus+one` (`/2/avatar.png` under a name the picture scheme refuses) and user11 to user16 (`/11/`
  to `/16/`: no file, each answer after 1 s).
- `ci-job-log/` — a failed job's log in the merge-request page (`crates/merge-requests/tests/job_log.rs`, the job-log
  app tests in `src-tauri/src/merge_requests/tests/job_log.rs`): logged in; `merge-requests/`'s project; user `sam`;
  one page, the last; no `diffHeadSha`, so the local check runs no git. !71 (failed pipeline): `phpunit` (job 302),
  `lint` allowed to fail (303), `e2e` (304), `docs` (305) and the trigger job `deploy` (`webPath: null`, no page);
  !70 (failed): `phpunit` (312), the same job name on another merge request; !69 from a fork (source project 2):
  `phpunit` at `/sam/taskboard/-/jobs/310`. `traces/302.log` is a short runner log, every line with the timestamp
  prefix (`2026-11-03T09:00:00.123456Z 00O `, two `00O+` continuation lines, two `00E` lines): collapsed sections
  (`\e[0Ksection_start:…[collapsed=true]\r\e[0K` and their `section_end`), a progress line rewritten with lone `\r`s,
  bold, italic, underlined, 256-colour, red-background, truecolor and `\e[0;m` codes, a line of markup
  (`<b>not bold</b> & <script>x</script>`) and PHPUnit's `FAILURES!` / `Tests: 12, Assertions: 30, Failures: 2.`
  before the runner's `ERROR: Job failed`; `303.log` holds 520,706 bytes of numbered lines (a yellow warning every
  25th), its first line naming `FIRST LINE OF THE LONG LOG`, its last a red failure line; `305.log` is empty; there
  is no `304.log` (404); `310.log` is a short fork log (`FORK LOG: …`), `312.log` a short coloured log with `fail`.
  `.gitattributes` keeps every byte (`* -text`).
- `mr-discussions/` — each row's open discussions (`crates/merge-requests/tests/discussions.rs`, the discussions app
  tests in `src-tauri/src/merge_requests/tests/discussions.rs`): logged in; `merge-requests/`'s project; user `sam`;
  one page, the last, with the list query's fields (`queryComplexity` 170 of 250); no `diffHeadSha`. !82 (3 open: 4
  resolvable, 1 resolved), !81 (1), !80 (0), !79 (1), !78 (1). The batch `graphql-discussions-82-81-79-78.json`
  (`queryComplexity` 58 of 250, as gitlab.com scored 20 merge requests on 2026-11-03): !82 holds, in order, (a) a diff
  discussion on `src/board/card.ts` line 12: anna's comment, a system note "changed this line in version 2 of the
  diff", then sam's reply (note 103); (b) a diff discussion on `src/board/dueDates.ts`, old line 6 only: ben's
  comment, then a system note last; (c) an Overview discussion by anna whose `url` is `https://evil.example/x#note_1`
  (no page); (d) a resolved discussion; (e) a system-only "added 2 commits" (`resolvable: false`); (f) chiara's
  non-resolvable comment. !81: one Overview discussion, ben's note 201, its body `Please **check** <b>THIS</b> & that`
  on three lines with a `<script>` line. !79: page 1 holds only two resolved discussions and names `hasNextPage: true,
  endCursor: "d-2"`; `graphql-discussions-79-after-d-2.json` holds the open one (sam, `src/board/search.ts` line 3).
  !78 is absent from the batch's answer. `graphql-discussions-81.json` answers !81 alone (a lazy ask, score 32);
  `graphql-discussions-77.err` and `.exit` (1) fail before any answer with a deadline line. Avatars: anna's uploaded
  `/uploads/-/system/user/avatar/2/avatar.png` (`pictures/`, `mr-row-details/`'s PNG), ben's Gravatar as in
  `mr-row-details/`; every other `url` is `https://gitlab.example/taskboard/taskboard/-/merge_requests/<iid>#note_<n>`.
  Each merge request answers `discussionLocked: false` and `createNote: true`; each discussion an `id` whose hex ends
  in the iid and its place (`…008201` for !82's first) and `resolveNote: true`; each note its `bodyHtml`, `lastEditedAt`
  equal to `createdAt` and `lastEditedBy: null`; `notes.pageInfo` both `hasNextPage: false` and `hasPreviousPage`.
- `mr-review-mode/` — review mode's order on the merge-request page (the real-app acceptance of
  `docs/slices/briefs/mr-review-mode-page.md`): logged in; `mr-discussions/`'s project; user `sam` ("Sam Doe"); one
  page, the last, with the list query's fields (`queryComplexity` 170 of 250); no `diffHeadSha`, no pipeline, no
  label, assignee or avatar; every reviewer `UNREVIEWED`, not approved. !97 (by ben; reviewer anna; 1 open), !96 (ben;
  sam and anna; 2), !95 (a draft, "Draft: …"; anna; sam; 1), !94 (anna; sam; 1), !93 (ben; sam; 2), !92 (sam; anna;
  1), !91 (anna; sam and ben; none), !90 (anna; ben; 1). The batch `graphql-discussions-97-96-95-94-93-92-90.json`
  (`queryComplexity` 58 of 250), one person's note per open discussion: !97 Overview, anna; !96 (a)
  `src/board/filters.ts` line 4, ben, then (b) Overview, sam, newer; !95 Overview, anna; !94 `src/board/week.ts` line
  12, anna; !93 (a) `src/export/csv.ts` line 8, sam, then (b) Overview, sam; !92 Overview, anna. !90 is absent from
  the answer. Every `url` is `https://gitlab.example/taskboard/taskboard/-/merge_requests/<iid>#note_<n>`. The thread
  fields as in `mr-discussions/`.
- `mr-people/` — adding and removing assignees and reviewers and searching the project's people
  (`crates/merge-requests/tests/people.rs`, the people app tests in `src-tauri/src/merge_requests/tests/people.rs`):
  logged in; `mr-row-details/`'s project and page 1 (!52 assignee sam, reviewers ben, chiara (approved) and dmitri;
  !51 nobody; !50 `updateMergeRequest` false; user `sam`). Searches: `graphql-people-er.json` erik "Erik Lund"
  (`/uploads/-/system/user/avatar/7/avatar.png`), then ben (his Gravatar as in `mr-row-details/`);
  `graphql-people-an.json` anna (`/2/avatar.png`); `graphql-people-gh.json` ghost "Ghost User" (no avatar);
  `graphql-people-nobody.json` nobody (`autocompleteUsers: []`); `graphql-people-broken.err` and `.exit` (1) fail
  before any answer with "glab: a deadline line". Posts (`200 OK`), in the real app's order, each `changed` payload
  with GitLab's answered assignees and reviewers: 1, !52 add assignee erik → assignees sam, erik, reviewers as !52; 2,
  add reviewer erik → reviewers ben, chiara (approved), dmitri, erik (`UNREVIEWED`); 3, remove assignee sam →
  assignees erik; 4, remove reviewer chiara → reviewers ben, dmitri, erik; 5, add assignee anna on GitLab Free →
  `errors: []`, assignees erik only; 6, add reviewer ghost → `errors: ["Reviewers not able to be set: ghost"]`; 7, any
  change → the top-level error "The resource that you are attempting to access does not exist or you don't have
  permission to perform this action" with `data: {"changed": null}`; 8, remove reviewer ben, not made → reviewers
  still ben, dmitri, erik. `pictures/uploads/-/system/user/avatar/1/avatar.png` and `/2/avatar.png` are
  `mr-row-details/`'s PNGs, `/7/avatar.png` erik's small PNG.
- `mr-description/` — a merge request's description and its uploads (`crates/merge-requests/tests/description.rs`):
  logged in; `mr-row-details/`'s project on gitlab.com (id 7, `https://gitlab.com/taskboard/taskboard`: uploads are
  fetched with the login only there); user `sam`; one page,
  the last (`queryComplexity` 172 of 250, as gitlab.com scored the list query with `description` logged in on
  2026-11-04), each node with a `description`: !52–!48 a short text, !47 `"  \n "`, !46 `null`; no `diffHeadSha`.
  `graphql-description-52.json` is GitLab's rendering in its own shapes (measured on gitlab-org/gitlab !200000,
  !267727, !50000 on 2026-11-04): h1–h3 each with its empty anchor link; a paragraph with `em`, `strong`, `del`,
  `code`, a `br` and a `gl-emoji`; a ruby code block (`div`/`pre data-canonical-lang`/`span.line`), one without a
  language, a mermaid block; inline math; a list, an `ol start="3"`, a task list (done, open, inapplicable); a table
  aligned left, centre and right; a quote, a rule, a `details` with its `summary`; links to `https://docs.example/x`,
  `http://plain.example/`, the issue `#12`, `@anna`, a commit, the label `frontend`, `#section`, `mailto:`, `file:`
  and `javascript:`; lazy images (placeholder `src`, real `data-src`, each in its `a.no-attachment-icon`): the uploads
  `/-/project/7/uploads/0a1b2c3d4e5f60718293a4b5c6d7e8f9/shot.png` (served by the uploads API,
  `uploads/7/uploads/…/shot.png`), `…/f9e8d7c6b5a4938271605f4e3d2c1b0a/old.png` (the API answers 404; served on its
  web path, `pictures/-/project/7/uploads/…/old.png`), `…/1111aaaa2222bbbb3333cccc4444dddd/gone.png` (on neither),
  `https://images.example/cat.png`, `https://evil.example/-/project/7/uploads/5555eeee6666ffff7777000088881111/x.png`
  and `http://plain.example/p.png`. `graphql-description-51.json` holds `descriptionHtml: ""`;
  `graphql-description-50.json` planted markup: a `script`, an `img` with `onerror`, an `iframe`, a `style`, a
  stylesheet `link`, a `base` and a relative link after it, a `meta` refresh, a `form` with an `input` and a
  `button`, a `p` with `onclick`, `style`, `class` and `id`, an `svg` with `onload`, an `object`, an `embed`, a
  `video`, an `audio`, `noscript`, `template`, `title`, `textarea` and `select`, and 40 nested `blockquote`s;
  `graphql-description-49.err` and `.exit` (1) fail before any answer with "glab: a deadline line";
  `graphql-description-48.json` holds `mergeRequest: null`. `graphql-description-53.json` names two uploads, each
  answering `302 Found` on one route (`.status`) and holding a PNG on its web path: `2222cccc3333dddd4444eeee5555ffff`
  on the uploads API, `6666aaaa7777bbbb8888cccc9999dddd` (no API file, so 404 first) on its web path.
  `graphql-description-54.json` (no row on the page) holds nine lazy images on `https://images.example/`, each with
  its own `alt`, sized `width="300"`, `width="40%"`, `height="80"` alone, `width="200" height="100"`, `width="5000"`
  (wider than any panel), `width="abc"`, `width="12345"`, `height="50%"` and none.
  `self-managed/` is a scenario of its own: the project on `https://gitlab.example/taskboard/taskboard` and
  `graphql-description-52.json` naming `/-/project/7/uploads/0a1b2c3d4e5f60718293a4b5c6d7e8f9/shot.png` and
  `/taskboard/taskboard/uploads/f9e8d7c6b5a4938271605f4e3d2c1b0a/old.png`, which it serves on no route.
- `mr-links/` — a merge request's linked epics, issues and commits (`crates/merge-requests/tests/links.rs`): logged in;
  `merge-requests/`'s project (`taskboard/taskboard`, id 7, on `https://gitlab.example`); user `sam`; one page, the
  last, with the list query's fields: !62–!58 each with a description, !57 `null`; no `diffHeadSha`.
  `graphql-description-62.json`, in GitLab's shapes (`docs/slices/briefs/mr-links-design.md` §1.1), in order: `#12`
  (`gfm-issue`, `/taskboard/taskboard/-/work_items/12`), `&3` (`https://gitlab.example/groups/taskboard/-/epics/3`),
  `#13` (a `work_item` of type `task`), `other/lib#5`, `taskboard/web#6`, a plain link to
  `…/secret/vault/-/issues/9`, `#12` again as `…/taskboard/taskboard/-/issues/12#note_7`, a plain link to
  `…/taskboard/taskboard/-/work_items/99`, `…/groups/taskboard/-/work_items/4`, `…/groups/design/-/epics/2`, the
  commit `fa3335f3` (title "Backfill due dates"), this merge request's commit
  (`…/merge_requests/62/diffs?commit_id=6ea97d8c…`, "Snooze a reminder"), the range `a1b2c3d4…e5f6a7b8` ("Commits
  a1b2c3d4 through e5f6a7b8"), a plain link to `…/commit/fa3335f3` (the same commit, short), a plain link to
  `…/secret/vault/-/commit/0badc0de…`; then what is never listed: `!7`, the label `frontend`, `@anna`,
  `<code>#12</code>`, a code block holding `…/issues/14`, `https://gitlab.other/x/y/-/issues/1`, a milestone, a
  compare of branches and `https://docs.example/x`. `graphql-links-12-13-99.json` answers its one lookup
  (`queryComplexity` 50 of 250): part0 `taskboard/taskboard` 12 `Issue` "Snooze a reminder" (parent the epic 3 on
  `…/groups/taskboard/-/work_items/3`), 13 `Task` "Write the snooze test" (parent issue 12), no 99; part1 group
  `taskboard` 3 `Epic` "Board redesign" with a parent epic of its own, 4 `Epic` "Old board" `CLOSED`; part2
  `other/lib` 5 "Fix date parsing" `CLOSED`; part3 `taskboard/web` 6 "Web card" with a parent on
  `https://evil.example`; part4 (`secret/vault`) `null`; part5 group `design` 2 `Epic` "Design system".
  `graphql-description-61.json` links only what is never listed; `graphql-description-60.json` links `#30`, whose
  lookup `graphql-links-30.err` and `.exit` (1) fail before any answer with "glab: a deadline line";
  `graphql-description-59.json` (GitLab Free) links `#20`, `#21` (a task) and `…/groups/taskboard/-/epics/8`,
  answered by `graphql-links-20-21.json`: 20 `Issue` "Free issue" with the hierarchy widget's `parent: null`, 21
  `Task` "Free task" with parent 20, and the group part `{ "workItems": { "nodes": [] } }`;
  `graphql-description-58.json` links only the two commits given as plain links.
- `mr-threads/` — whose turn a discussion is, its whole thread and the four writes
  (`docs/slices/briefs/mr-threads-fixtures.md`; `crates/merge-requests/tests/{discussions,threads}.rs`, the thread app
  tests): logged in; `mr-description/`'s project on gitlab.com (id 7, `https://gitlab.com/taskboard/taskboard`: a
  comment's upload is fetched with the login only there); user `sam`; people sam "Sam Weller", anna "Anna Berg", ben
  "Ben Okafor", chiara "Chiara Rossi", dmitri "Dmitri Volkov" (user ids 1–5, avatars
  `/uploads/-/system/user/avatar/<id>/avatar.png` in `pictures/`). One page, the last: !91 (by sam, locked:
  `discussionLocked: true`, `createNote: false`; 3 open) and !90 (by dmitri; 13 open). Discussion ids `dNN` are the
  hex `000…0NN`. !90, in order: d01 on `src/board.ts`
  new line 12 — anna (a paragraph with `strong`, `code` and a link, a typescript code block, a table, `@ben`; edited
  by herself two days later), a system note, sam (a suggestion block and the lazy upload
  `/-/project/7/uploads/903a1b2c3d4e5f60718293a4b5c6d7e8/shot.png` at `width="60%"`, served by the uploads API,
  `uploads/7/uploads/…/shot.png`; edited by dmitri), dmitri (a web image at
  `height="80"` and `<code>@sam</code>`), anna; d02 anna, sam; d03 sam, anna; d04 on `src/due.ts` old line 4 — ben
  mentioning `@sam`, chiara; d05 anna mentioning `@sam`, sam, anna; d06 chiara, anna mentioning `@ben`; d07 anna, a
  system note, anna; d08 anna, dmitri; d09 dmitri; d10 two deleted users (`author: null`); d11 chiara, ben mentioning
  `@dmitri`; d12 ben, chiara with `@all` and the group `@taskboard`; d13 chiara mentioning herself. !91: d14 anna, sam
  (`resolveNote: false`); d15 sam, sam; d16 anna, anna. Answers: `graphql-discussions-91-90.json` (the batch, score
  88), `-90.json` and `-91.json` (one merge request, score 46); `draft-notes-90.json` sam's drafts 501 on d01 and 502
  on d05, `draft-notes-91.json` none; `markdown.json` a preview of `**Preview** of @anna`. Posts on !90's d01, in
  order: 1 the reply "Thanks" (`201 Created`, the note) → `graphql-discussions-90` and `-91-90.after-post-1` end d01
  with it; 2 the draft "Later" (`201 Created`, draft 503) → `draft-notes-90.after-post-2` lists 501, 502, 503; 3
  resolve (`200 OK`, the discussion) → `after-post-3` d01 resolved, its unedited notes' `lastEditedAt` moved; 4
  unresolve (`200 OK`) → `after-post-4` d01 open again; 5 submit the review (`204 No Content`, an empty body) →
  `after-post-5` d01 also ends with 501's and 503's notes and d05 with 502's, `draft-notes-90.after-post-5` `[]`.
- `mr-threads-refused/` — writes GitLab refuses: `mr-threads/`'s project, its page with !90 only, and copies of its
  `graphql-discussions-90.json` and `draft-notes-90.json`. Post 1 `403 Forbidden` (`{"message":"403 Forbidden"}`);
  post 2 `400 Bad Request` with `{"error":"note is missing"}` and its `.err`; post 3 fails before any answer (`.exit`
  1, a deadline line); post 4 `500 Internal Server Error`. The preview fails: `markdown.exit` 1 with
  "glab: 401 Unauthorized (HTTP 401)".
- `mr-remembered/` — glab's login and project asked once, forgotten when wrong (`crates/merge-requests/tests/remembered.rs`):
  `mr-threads/`'s project (`taskboard/taskboard` on gitlab.com), logged in, `markdown.json` a one-paragraph preview
  ("Remembered"). What changes after k posts (set by `Fake::answered_posts(k)`): 1 → every api call `401
  Unauthorized` and `glab auth status` logged out as `logged-out/` (exit 1); 2 → api as usual, logged in again; 3 →
  api `401 Unauthorized`, still logged in; 4 → api `404 Project Not Found`; 5 → api `403 Forbidden`; 6 → api as
  usual, `graphql-description-90.after-post-6.json` answering `project: null`; 7 → api `anonymous` and logged out
  again, `graphql-merge-request-90.json` the reviewers read (ben `REVIEWED`) a re-request runs before its mutation.

## Fake browser opener

`scripts/fake-open/xdg-open` stands in for xdg-open, first on PATH: it opens nothing, appends `argv: <arguments>`
to `$YAMT_FAKE_OPEN_LOG` (when unset, read from an `open.env` beside it, one `YAMT_FAKE_OPEN_LOG=<file>` line) and
exits 0.
