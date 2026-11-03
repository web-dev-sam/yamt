# MrDiscussionsRustBoundary

Agent output (`agent://MrDiscussionsRustBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsRustBoundary.md), collected 2026-11-03T14:48:29.251Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all changes under Owned globs (crate AGENTS.md too); no Cargo.toml/gitio edits; src-tauri adds no gitio/merge-core edge (PM1); out-of-Owned docs listed in deviations.",
    "Contract and bindings match: types/derives/tags, both fns, discussions_args, WebPage::note, From<NoProject>, DiscussionDetails + file key; readDiscussions, setDiscussionDetails, discussionDetails present.",
    "Reuse: page.rs Connection/PageInfo/graphql_data/Nodes/Complexity, merge_request_iid, one_per_username, People::person; WebPage::note builds on merge_request. Fetch seam mirrors list.rs pages().",
    "Deviations accepted: empty-ask integration test, no 77.json (reply exits on .exit), answer.rs split (RS6), pub(crate) consts, `queries` name, README wording. Open risk 1 is the brief's serde contract.",
    "Fake glab: iids route precedes iid; `^iid=` cannot match iids=; reply always exits. Settings layout/docs and src-tauri command mirror set_antialiasing; all StoredSettings fixtures updated.",
    "State: discussions_reply as a writer of `pages` is contract-mandated (design §1.5). Lock dropped before Pictures::offer. read_job_log still refuses note pages via job_parts. state.md row 64 left to the docs keeper."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/discussions/tests.rs",
      "line": 399,
      "severity": "should",
      "rule_id": "RS11",
      "problem": "The crate's first unit test with real files and a subprocess copies tests/fake_glab/mod.rs `Fake` setup (glab.env, symlink, ETXTBSY rule) to pin `Tally.queries`; AGENTS.md calls `Fake` the one shared helper. The next private counter would copy it a third time.",
      "fix": "Count fetch calls inside `answered` and return them with the complexity, so `through_glab` takes no `&mut Tally`. Cover the count with a closure unit test like `paged()`, and delete this fake-glab test."
    },
    {
      "file": "crates/merge-requests/src/discussions.rs",
      "line": 192,
      "severity": "should",
      "problem": "Log figures reach `log_read` two ways: `queries` through a `&mut Tally` the fetch closure mutates, `complexity` as `answered`'s tuple result copied into it. A reader must trace both; each new figure adds a third path.",
      "fix": "Have `answered` return a single struct holding the rows, pictures, query count and complexity; `read_discussions` logs from it, and `Tally` goes away."
    },
    {
      "file": "src-tauri/src/merge_requests.rs",
      "line": 67,
      "severity": "should",
      "problem": "MergeRequestState's doc still says `pages` holds 'every merge request's and failed job's page a list sent', and open_page's warning (line 389) says 'a GitLab page no list sent'. discussions_reply now adds note pages, so 'what can change pages?' reads wrong.",
      "fix": "Name the note pages that read_discussions sends in the struct doc, and reword the open_page warning to 'a GitLab page this window was never sent'."
    },
    {
      "file": "src-tauri/src/merge_requests/discussions.rs",
      "line": 19,
      "severity": "should",
      "problem": "The rule 'add pages, release the lock, then pictures.offer, all before replying' is now written here and in `forward_page`. Each later reply that offers pages copies it again and may hold both locks.",
      "fix": "Extract one `offer(state, pages: impl IntoIterator<Item = WebPage>, pictures)` in merge_requests.rs, used by both forward_page and discussions_reply."
    }
  ]
}
