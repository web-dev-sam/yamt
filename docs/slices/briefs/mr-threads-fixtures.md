# Slice mr-threads-fixtures — fake glab routes for threads, replies, resolves, reviews and previews; the scenarios

Feature: whose turn it really is, the whole thread beside the box, answering it, and sized images. Sources:

- Request `docs/slices/request-mr-threads.md`: the Rust and real-app acceptance (the scenarios they run on).
- Design `docs/slices/briefs/mr-threads-design.md` option A, §1.1, §1.3 "Fake glab", §3.2 (RK54 amended).
- Proposed plan §2 #179–#184.

Runs in wave 1, beside `mr-threads-http` (no shared file). `mr-threads-images`, `mr-threads-crate` and `mr-threads-app`
test on these scenarios; the window's real-app smoke (`mr-threads-box`, `mr-threads-verify`) runs on `mr-threads`.

## Target

**Owned:**

- `scripts/fake-glab/glab`
- `tests/glab/README.md`
- `tests/glab/mr-threads/**` (new), `tests/glab/mr-threads-refused/**` (new)
- `tests/glab/mr-discussions/**`, `tests/glab/mr-review-mode/**` (the new fields only)
- `tests/glab/mr-description/graphql-description-54.json` (new)

**Read-only:** everything else.

- `crates/**`, `src-tauri/**`: no Rust changes here; every existing test stays green (serde ignores the extra fields:
  no `deny_unknown_fields` in `crates/merge-requests/src`).
- Other scenarios under `tests/glab/`: copy from them, never edit them.
- `docs/**` outside your globs: lines in `deviations_from_brief`.

**Non-goals:** the Rust that reads these files (`mr-threads-images`, `mr-threads-crate`); any route not named here.

## Contract

Fixed; you may add, never change.

### Fake glab routes (`scripts/fake-glab/glab` `api()`, design §1.3)

In this order before today's routes (`:244-262`); every new route's comment names what it imitates:

| method and endpoint                  | answer                                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `POST */draft_notes/bulk_publish`    | `post` (counted)                                                                                                     |
| `POST */discussions/*/notes`         | `post` (counted)                                                                                                     |
| `PUT */discussions/*`                | `post` (counted)                                                                                                     |
| `POST markdown`                      | `reply "$scenario/markdown" '201 Created'` (**not** counted: a preview writes nothing)                               |
| `GET */merge_requests/*/draft_notes` | `reply "$scenario/draft-notes-<iid>" '200 OK'` when that `.json` exists, else today's `answer_file draft-notes.json` |

`<iid>` is the path segment before `/draft_notes`. Today's `"POST "*/draft_notes` and `"GET "*/draft_notes` stay for
the range window.

**Answers after a write.** In `reply()` (`:106-118`), before its other steps: when `$YAMT_FAKE_GLAB_STATE` names a
file holding n > 0, the answer path `$1` becomes `$1.after-post-<k>` for the largest k with 1 ≤ k ≤ n whose
`$1.after-post-<k>.json` exists (`.status`, `.err`, `.exit`, `.sleep` follow the chosen path). Posts themselves
(`post-<n>`) are never redirected. So a thread read, a reload or a draft list after the k-th write shows it. One
comment above `reply()` says so.

### Scenario `tests/glab/mr-threads/` (project `taskboard/taskboard`, id 7, on `https://gitlab.example`; user `sam`)

`project.json` as `merge-requests/project.json`; `auth-status.out` absent (logged in). `graphql-page-1.json`: one page,
the last, rows **!91** (author **sam**, 3 open discussions) and **!90** (author **dmitri**, 13 open discussions), the
list query's fields as `mr-discussions/graphql-page-1.json`. Discussion ids are 40 lowercase hex digits, GraphQL `id`
`gid://gitlab/Discussion/<hex>`; below `dNN` means the hex `00000000000000000000000000000000000000NN` (`d01` … `d15`).

Every discussions answer has the design's query fields (design §3.1 row #179): per merge request `iid`,
`discussionLocked`, `userPermissions { createNote }`; per discussion `id`, `resolvable`, `resolved`, `userPermissions {
resolveNote }`, `notes { pageInfo { hasNextPage } nodes { … } }`; per note `system`, `author { username name avatarUrl
}` (null for a deleted user), `body`, `bodyHtml`, `createdAt`, `lastEditedAt`, `lastEditedBy`, `url`, `position`.
Mentions in `bodyHtml` are GitLab's measured shape: `<a href="/ben" data-reference-type="user" data-user="3"
data-original="@ben" title="Ben Okafor" class="gfm gfm-project_member js-user-link">@ben</a>`; a group mention
`<a href="/taskboard" data-reference-type="user" data-group="9" …>@taskboard</a>`; `@all` `<a href="/taskboard/taskboard"
data-reference-type="user" data-project="7" data-author="1" …>@all</a>`. An unedited note has `lastEditedAt` =
`createdAt` and `lastEditedBy: null`.

People: `sam` "Sam Weller", `anna` "Anna Berg", `ben` "Ben Okafor", `chiara` "Chiara Rossi", `dmitri` "Dmitri Volkov"
(the window fixture's names, `frontend/src/ipc/fixtureMergeRequestData.ts:56-62`).

**!90's discussions** (author dmitri; the case numbers are the core tests' in `mr-threads-box`), in this order:

| id  | place                      | person notes, oldest first (a system note where marked) | case                                 |
| --- | -------------------------- | ------------------------------------------------------- | ------------------------------------ |
| d01 | `src/board.ts` new line 12 | **the thread note set** below                           | 5 (sam in the middle, anna last)     |
| d02 | Overview                   | anna, then sam                                          | 1                                    |
| d03 | Overview                   | sam, then anna                                          | 2                                    |
| d04 | `src/due.ts` old line 4    | ben mentions `@sam`, then chiara                        | 3                                    |
| d05 | Overview                   | anna mentions `@sam`, sam, then anna                    | 4                                    |
| d06 | Overview                   | chiara, then anna mentions `@ben`                       | 6                                    |
| d07 | Overview                   | anna, (system note), anna                               | 7                                    |
| d08 | Overview                   | anna, then dmitri                                       | 8 (the owner check's)                |
| d09 | Overview                   | dmitri only                                             | 9                                    |
| d10 | Overview                   | deleted user (`author: null`), then a deleted user      | 10                                   |
| d11 | Overview                   | chiara, then ben mentions `@dmitri`                     | 11                                   |
| d12 | Overview                   | ben, then chiara with `@all` and the group mention      | 12                                   |
| d13 | Overview                   | chiara mentions `@chiara` (herself)                     | 7 (a self-mention counts for nobody) |

**d01, the thread note set** (its `url`s `…/merge_requests/90#note_<n>` from note_901; the first note's
`position` the place): 1. anna (starter), `bodyHtml` with a paragraph, `<strong>`, inline `<code>`, a link to
`https://docs.example/board`, a GitLab code block (`<div class="gl-relative markdown-code-block"><pre lang="typescript"
class="code highlight js-syntax-highlight language-typescript" …><code><span class="line" lang="typescript">…`), a
table, a mention of `@ben`, edited by herself (`lastEditedBy` anna, `lastEditedAt` two days after `createdAt`); 2. a
system note ("changed this line"); 3. sam, a suggestion block (`<pre … class="… language-suggestion …"><code>…`) and an
uploaded image `<img … data-src="/uploads/-/system/note/…/shot.png" width="60%" …>` (a lazy upload, `pictures/` file),
edited by dmitri (`lastEditedBy` dmitri); 4. dmitri, a web image `<img … data-src="https://images.example/arch.png"
height="80" …>` and `<code>@sam</code>` (no mention); 5. anna, one line. `userPermissions { resolveNote: true }`.

`draft-notes-90.json` (REST shape as `docs.gitlab.com/api/draft_notes`): two of sam's drafts, id 501 on d01 ("I'll
take the second option.") and id 502 on d05 (`discussion_id` the hex, `note` raw, `author_id` 1).

**Writes on !90, d01, in this order** (the real-app smoke and the app tests; each `post-<n>.json` as GitLab answers,
status as given):

| n   | write          | `post-<n>`                                                | then answers                                                                                                         |
| --- | -------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | comment on d01 | `201 Created`, a note `{ id, body, author, … }`           | `graphql-discussions-90.after-post-1.json`, `graphql-discussions-91-90.after-post-1.json`: d01 gains sam's note last |
| 2   | draft on d01   | `201 Created`, a draft `{ id: 503, discussion_id, note }` | `draft-notes-90.after-post-2.json`: 501, 502, 503                                                                    |
| 3   | resolve d01    | `200 OK`, the discussion                                  | discussions `after-post-3`: d01 `resolved: true`                                                                     |
| 4   | unresolve d01  | `200 OK`                                                  | discussions `after-post-4`: d01 open again                                                                           |
| 5   | submit review  | `204 No Content`, empty body                              | discussions `after-post-5`: d01 and d05 gain sam's published notes; `draft-notes-90.after-post-5.json`: `[]`         |

**!91's discussions** (author sam): d14 anna, then sam (case 13); d15 sam, then sam (case 14); d16 (`…0016`) anna, then
anna (case 15). `draft-notes-91.json`: `[]`. **!91 is locked**: `discussionLocked: true`, `createNote: false`; d14's
`resolveNote: false`.

Files: `graphql-discussions-91-90.json` (the batch, list order), `graphql-discussions-90.json`,
`graphql-discussions-91.json` (one merge request: the thread read and the reload), their `after-post-<k>` files as
above, `markdown.json` (`{ "html": "<p data-sourcepos=\"1:1-1:16\" dir=\"auto\"><strong>Preview</strong> of <a href=\"/anna\" data-reference-type=\"user\" data-user=\"2\" …>@anna</a></p>" }`),
`pictures/…` for every avatar and the upload. Each `queryComplexity` 46 of 250 for one merge request, 88 for the batch
(design §1.2, measured logged out).

### Scenario `tests/glab/mr-threads-refused/`

As `mr-threads` for project, page (only !90) and `graphql-discussions-90.json` (copy), plus:

| n   | `post-<n>`                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------- |
| 1   | `403 Forbidden`, `{"message":"403 Forbidden"}`                                                                 |
| 2   | `400 Bad Request`, `{"error":"note is missing"}`, `post-2.err` "glab: note is missing (HTTP 400)"              |
| 3   | `.exit` 1, `.err` "glab: Post \"https://gitlab.example/api/v4/…\": context deadline exceeded" (no HTTP answer) |
| 4   | `500 Internal Server Error`, `{"message":"500 Internal Server Error"}`                                         |

`markdown.exit` 1 with `markdown.err` "glab: 401 Unauthorized (HTTP 401)" (a failed preview).

### Updated scenarios

- `mr-discussions/graphql-discussions-*.json`, `mr-review-mode/graphql-discussions-*.json`: every discussion gains
  `id` (unique `gid://gitlab/Discussion/<hex>`), `userPermissions { resolveNote: true }`, each note `bodyHtml`
  (GitLab's rendering of its `body`; the `<script>` body of `-81` as GitLab escapes it), `lastEditedAt` = `createdAt`,
  `lastEditedBy: null`; each merge request `discussionLocked: false`, `userPermissions { createNote: true }`;
  `notes.pageInfo` gains `hasNextPage: false` (keep `hasPreviousPage` until `mr-threads-crate` drops it). Text and
  order unchanged: today's tests stay green and `mr-threads-crate` re-reads them.
- `mr-description/graphql-description-54.json` (new; the query shape of the scenario's `-<iid>.json` files, iid 54 on
  the scenario's page if the page needs a row; else only the description): `descriptionHtml` with lazy images
  (`data-src`) carrying `width="300"`, `width="40%"`, `height="80"` alone, `width="200" height="100"`, `width="5000"`
  (wider than any panel), `width="abc"`, `width="12345"`, `height="50%"`, and one without size, each with a distinct
  `alt`.

## Change

1. Fake glab routes and the after-post rule; a shell smoke (below) per route.
2. `mr-threads/`, `mr-threads-refused/`, `mr-description/graphql-description-54.json`, pictures.
3. The field additions in `mr-discussions/` and `mr-review-mode/`.
4. `tests/glab/README.md`: rows for `draft-notes-<iid>.json`, `markdown.json`, `<answer>.after-post-<k>.json`, the
   three counted routes in `post-<n>.json`'s row; both scenarios in "Scenarios".

## Acceptance

**Smoke** (paste each output), with `F=scripts/fake-glab/glab`, `S=$(mktemp)`, `L=$(mktemp)`,
`export YAMT_FAKE_GLAB=tests/glab/mr-threads YAMT_FAKE_GLAB_STATE=$S YAMT_FAKE_GLAB_LOG=$L`:

- `printf '{"body":"x"}' | $F api --include --method POST 'projects/taskboard%2Ftaskboard/merge_requests/90/discussions/0000000000000000000000000000000000000001/notes' --input -; cat $S` →
  `HTTP/2.0 201 Created`, post-1's body, state `1`.
- `$F api graphql -f 'query=query MergeRequestDiscussions(…' -F 'iids=["90"]' -F first=1 | grep -c after` → the
  after-post-1 answer (d01's new last note).
- the draft POST, the `PUT …/discussions/<d01>` twice and `POST …/draft_notes/bulk_publish` → posts 2–5, state `5`;
  `$F api --paginate 'projects/taskboard%2Ftaskboard/merge_requests/90/draft_notes'` → `[]` (after-post-5).
- `printf '{"text":"x","gfm":true}' | $F api --include --method POST markdown --input -; cat $S` → `201 Created`, the
  html, state unchanged.
- with `YAMT_FAKE_GLAB=tests/glab/mr-threads-refused` and a fresh state: posts 1–4 print the statuses and exits above;
  the markdown POST exits 1 with its line.
- `jq` each new or edited JSON (`for f in tests/glab/mr-threads*/*.json tests/glab/mr-discussions/*.json
  tests/glab/mr-review-mode/*.json tests/glab/mr-description/graphql-description-54.json; do jq -e . "$f" >/dev/null
  || echo "$f"; done` prints nothing).

**Commands:** `sh -n scripts/fake-glab/glab`; `shellcheck scripts/fake-glab/glab` if the justfile's lint runs it;
`cargo nextest run -p yamt-merge-requests -p yamt-review -p yamt-app` (hermetic prefix as `just test`): all green,
unchanged.

## Skills

`skill://rust-conventions`, `skill://risk-register` (RK54 amended), `skill://verification`.
