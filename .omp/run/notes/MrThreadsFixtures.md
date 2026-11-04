# MrThreadsFixtures

Agent output (`agent://MrThreadsFixtures`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsFixtures.md), collected 2026-11-04T12:37:02.237Z.

{
  "summary": "The fake glab now answers four write routes as counted posts (submit review, reply to a discussion, PUT on a discussion, plus the existing draft POST), POST markdown without counting it, and per-iid draft lists. After the k-th post, a read is answered from its `.after-post-<k>` file. New scenarios: `mr-threads` (!90 d01–d13, !91 locked d14–d16, posts 1–5 each with its after-post reads, a preview, pictures) and `mr-threads-refused`. New `mr-description/graphql-description-54.json` has the sized images. `mr-discussions` and `mr-review-mode` gained the thread fields. README updated.",
  "files_changed": [
    "scripts/fake-glab/glab",
    "tests/glab/README.md",
    "tests/glab/mr-discussions/graphql-discussions-82-81-79-78.json",
    "tests/glab/mr-discussions/graphql-discussions-81.json",
    "tests/glab/mr-discussions/graphql-discussions-79-after-d-2.json",
    "tests/glab/mr-review-mode/graphql-discussions-97-96-95-94-93-92-90.json",
    "tests/glab/mr-description/graphql-description-54.json",
    "tests/glab/mr-threads/** (new: project, graphql-page-1, graphql-discussions-{90,91,91-90}.json and the 90 / 91-90 .after-post-{1,3,4,5}.json files, draft-notes-90{,.after-post-2,.after-post-5}.json, draft-notes-91.json, markdown.json, post-1..5 .json and .status, pictures/uploads/-/system/user/avatar/{1..5}/avatar.png, pictures/uploads/-/system/note/attachment/903/shot.png)",
    "tests/glab/mr-threads-refused/** (new: project, graphql-page-1, graphql-discussions-90, draft-notes-90, post-1..4 .json/.status/.err/.exit, markdown.exit, markdown.err)"
  ],
  "tests_added": [],
  "smoke_evidence": [
    {
      "command": "sh -n scripts/fake-glab/glab",
      "observed": "syntax-ok (exit 0)"
    },
    {
      "command": "printf '{\"body\":\"x\"}' | $F api --include --method POST 'projects/taskboard%2Ftaskboard/merge_requests/90/discussions/0000000000000000000000000000000000000001/notes' --input -; cat $S",
      "observed": "HTTP/2.0 201 Created / Content-Type: application/json / {\"id\": 951, \"type\": \"DiffNote\", \"body\": \"Thanks\", \"author\": {… \"username\": \"sam\" …} …}, exit=0, state: 1"
    },
    {
      "command": "$F api graphql -f 'query=query MergeRequestDiscussions(…' -F 'iids=[\"90\"]' -F first=1 | grep -c after; …| jq d01's last note; same for iids=[\"91\",\"90\"]",
      "observed": "grep -c after → 2 (the base answer gives the same 2: d09's text \"…after the release.\"). jq on the answer: d01's last note is \"sam: Thanks\", in both the single answer and the batch (after-post-1)."
    },
    {
      "command": "reply, then the draft POST …/draft_notes, GET --paginate …/90/draft_notes, PUT …/discussions/<d01> {\"resolved\":true}, discussions read, PUT {\"resolved\":false}, read, POST …/draft_notes/bulk_publish, GET draft_notes",
      "observed": "201, 201, state 2, drafts [501,502,503]; PUT 200 OK → d01 [true, lastEditedAt of the unedited notes 2026-11-04T10:05:00Z, sam's edited note kept at 12:30]; PUT 200 OK → resolved false; bulk_publish: `HTTP/2.0 204 No Content^M$ Content-Type: application/json^M$ ^M$`, empty body, exit=0, state 5; draft_notes → []; batch d01 ends [\"I'll take the second option.\",\"Later\"], d05 ends with 502's text"
    },
    {
      "command": "printf '{\"text\":\"x\",\"gfm\":true}' | $F api --include --method POST markdown --input -; cat $S (state 5 before; then again with no state file)",
      "observed": "HTTP/2.0 201 Created, {\"html\": \"<p data-sourcepos=\\\"1:1-1:16\\\" dir=\\\"auto\\\"><strong>Preview</strong> of <a href=\\\"/anna\\\" …>@anna</a></p>\"}, exit=0, state stays 5. With no state file the preview runs and no state file is created."
    },
    {
      "command": "YAMT_FAKE_GLAB=tests/glab/mr-threads-refused, fresh state: 4 reply posts, then POST markdown",
      "observed": "post 1 HTTP/2.0 403 Forbidden, exit=1, stderr 'glab: 403 Forbidden (HTTP 403)'; post 2 400 Bad Request, exit=1, 'glab: note is missing (HTTP 400)'; post 3 no stdout, exit=1, 'glab: Post \"https://gitlab.example/api/v4/…/notes\": context deadline exceeded'; post 4 500 Internal Server Error, exit=1, 'glab: 500 Internal Server Error (HTTP 500)'; state 4; markdown → 'glab: 401 Unauthorized (HTTP 401)', exit=1"
    },
    {
      "command": "for f in tests/glab/mr-threads*/*.json tests/glab/mr-discussions/*.json tests/glab/mr-review-mode/*.json tests/glab/mr-description/graphql-description-54.json; do jq -e . \"$f\" >/dev/null || echo \"$f\"; done",
      "observed": "prints exactly one line, tests/glab/mr-threads/post-5.json: the 204's empty body, which jq -e answers with exit 4. Every other file parses."
    },
    {
      "command": "fallbacks: drafted GET …/merge_requests/12/draft_notes; commit-route GET …/draft_notes; mr-threads GET …/91/draft_notes; iids=[\"91\"]",
      "observed": "[300,301,302] (draft-notes.json as before); 404 {\"message\":\"404 Not Found\"} exit=1 (as before); []; [true,{\"createNote\":false},{\"resolveNote\":false}]"
    },
    {
      "command": "hermetic env … cargo nextest run -p yamt-merge-requests -p yamt-review -p yamt-app --no-fail-fast",
      "observed": "Starting 580 tests across 20 binaries (37 tests skipped) … Summary [7.752s] 580 tests run: 580 passed, 37 skipped. An earlier run timed out at 1800 s; it was the cold build."
    },
    {
      "command": "git diff -U0 tests/glab | changed lines other than the added fields",
      "observed": "only 19× `pageInfo { hasPreviousPage }` → `{ hasNextPage: false, hasPreviousPage: false }`; text and order unchanged"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 'mutants: no Rust changes since HEAD' / 'mutants: no TypeScript changes since HEAD' (only shell and fixture changes)",
    "survivors": []
  },
  "acceptance_not_run": [
    "shellcheck scripts/fake-glab/glab: shellcheck is not installed here, and the justfile's lint does not run it (no shellcheck in justfile), so by the brief's condition it is not required."
  ],
  "deviations_from_brief": [
    "reply() is split in two. reply() does the after-post redirect, carries the one comment, then calls respond() (the old body). post() calls respond() directly, so posts are never redirected.",
    "post-5.json is empty (204 No Content, empty body, as the contract says), so the brief's `jq -e` loop prints that one file. Every other file parses.",
    "Acceptance `grep -c after` cannot tell the after-post answer from the base one: both print 2 (d09's \"after the release\"). I showed d01's new last note with jq instead.",
    "mr-threads-refused also has a copy of draft-notes-90.json, so a thread read succeeds before the refused writes. It is not in the brief's list.",
    "The @all link has data-author=\"4\" (chiara, who wrote the note), not the brief's \"1\". Rust does not read the attribute.",
    "The new mr-threads discussion files carry only `notes.pageInfo { hasNextPage }`, as the new query asks. hasPreviousPage is kept only in the updated mr-discussions and mr-review-mode files.",
    "Every after-post file exists twice, single (-90) and batch (-91-90), for k = 1, 3, 4, 5. Resolve and unresolve move the unedited d01 notes' lastEditedAt and leave the edited notes alone (design §1.3's measurement). Post 5 publishes 501 and 503 onto d01 and 502 onto d05.",
    "Write texts follow mr-threads-verify: post 1 is \"Thanks\", post 2 is \"Later\" (draft 503). I wrote the text of 502 and all other note texts. The upload path is my choice: /uploads/-/system/note/attachment/903/shot.png.",
    "Avatars of ben, chiara and dmitri are copies of the existing small PNGs from mr-people.",
    "I generated the derived JSON with jq from the hand-written base files (throwaway programs in /tmp, now deleted). I formatted it with the main checkout's oxfmt 0.72: width 120 as mr-discussions uses, width 100 for mr-review-mode. oxfmt also realigned the README's table at width 120.",
    "Docs outside my globs: architecture or ipc-contract may need lines naming the new fake-glab routes and the scenarios mr-threads and mr-threads-refused (docs keeper)."
  ],
  "open_risks": [
    {
      "location": "tests/glab/mr-threads/graphql-discussions-90.json (d01 note 903)",
      "risk": "On https://gitlab.example the upload /uploads/-/system/note/attachment/903/shot.png is a web image, not an uploads-API route. The pictures/ file is served only if something fetches it through glab [INFERENCE]."
    },
    {
      "location": "tests/glab/mr-threads/*.json bodyHtml",
      "risk": "The data-sourcepos values are hand-counted approximations, not measured. Rust ignores them, but a golden test that pins them would pin my numbers."
    },
    {
      "location": "scripts/fake-glab/glab:107-116",
      "risk": "If the state file holds a non-number (never written so by post or Fake::answered_posts), the `-gt` test fails quietly and the base answer is served."
    }
  ]
}
