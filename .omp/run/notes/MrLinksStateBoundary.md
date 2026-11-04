# MrLinksStateBoundary

Agent output (`agent://MrLinksStateBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksStateBoundary.md), collected 2026-11-04T02:12:39.923Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: the hook ownership.ts blocks writes outside registered globs and the descriptionDomain.ts edits went through, so they were granted. The Goal itself is not re-readable [INFERENCE]. Other files are in Owned.",
    "Edges (PM2/3/5/10): mergeRequestLinks.ts imports only vue, ../ipc, ./mergeRequestActions (setRow reused) and ./problem. ipc files import only ipc siblings. No window root, no lsp/.",
    "fixtureProject accepted: a pure function named like fixtureLinks/fixtureDiscussions that keeps createFixtureMergeRequests under max-lines-per-function, same behaviour. linksScript(log) spread as the brief says.",
    "Accepted: TIMED_OUT (precedent fixtureMergeRequestDescriptions.ts:202, mr-description-verify.md:39) and kind \"thrown\" for non-ok. Queue matches Contract: askLinks skips loading/read; dropped resets generation/map/queue.",
    "Slice: linkQueue beside discussionQueue (mergeRequests.ts:193), linksOf hides dropped (tested), ListState has Pick<LinkQueue,\"dropped\">. Step links with brief's words. tauri readLinks = converted(toResult, toLinksReply).",
    "Comments: CP2 one-liners on contract items, no narration or TODOs. The toLink refactor keeps the error text pinned by readDescription_throws_on_a_linked_page_that_is_not_http."
  ],
  "findings": [
    {
      "file": "frontend/src/ipc/descriptionDomain.ts",
      "line": 56,
      "severity": "block",
      "rule_id": "TS11",
      "problem": "descriptionDomain.ts now holds two concepts with separate commands: the description tree (toDescriptionReply) and the links lookup (Linked* types, LinksReply, toLinksReply at :168). Rust splits them (description/ vs links/), and ipc/AGENTS.md needs a sentence telling readers LinksReply lives there: the module has a second job.",
      "fix": "Move the Linked* types, DescriptionLinks, LinksReply and toLinksReply to a new ipc/linksDomain.ts with linksDomain.test.ts, re-exported by index.ts; the orchestrator grants the files. Callers import ../ipc, so the page slice is unaffected."
    },
    {
      "file": "frontend/src/ipc/descriptionDomain.ts",
      "line": 89,
      "severity": "block",
      "problem": "The Contract says links pages are branded with toWebPage (non-https throws), tested by every_links_page_is_branded_and_a_non_https_one_fails; the patch accepts http, renames the test, and nothing proves non-https fails. Rust only sends https links pages (target.rs:74-92, lookup.rs:172-175).",
      "fix": "Brand links pages with the https guard (isWebPage), exported once from domain.ts beside isLinkedPage, and restore the brief's test name. If the Goal truly mandated isLinkedPage, the orchestrator amends the Contract and Acceptance instead."
    },
    {
      "file": "frontend/src/ui/mergeRequestLinks.ts",
      "line": 114,
      "severity": "block",
      "problem": "useRowLinks is a verbatim copy of useRowDiscussions (mergeRequestDiscussions.ts:202-214), including the watch([open, () => load.value === undefined]) rule that asks again when an entry vanishes. A fix to that rule must now find both copies, and a third hover box would make a third.",
      "fix": "Put one generic useAskedRow<L>(entries, ask, iid, open) beside setRow in ui/mergeRequestActions.ts, and have useRowLinks and useRowDiscussions return it, keeping the signatures the page slices import."
    },
    {
      "file": "frontend/src/ui/mergeRequestsList.ts",
      "line": 66,
      "severity": "should",
      "problem": "Replacing the list resets each per-row cache by hand: discussionQueue.replaced and linkQueue.dropped are called together at two sites (:65-66, :109-110). Each new cache adds a call at both sites, and the list module ends up knowing every queue's name.",
      "fix": "Give ListState one rowsReplaced(rows) dependency that mergeRequests.ts composes from both queues, and call it once at each site."
    },
    {
      "file": "docs/slices/briefs/mr-links-page.md",
      "line": 162,
      "severity": "should",
      "problem": "Because of the accepted TIMED_OUT deviation, fixture !636 now reads \"Could not read the links: glab timed out\". mr-links-page.md:162 and mr-links-verify.md:37 and :83 still expect \"glab: a deadline line\", so the running page slice's smoke and the verify run will report a false mismatch.",
      "fix": "The orchestrator changes those three fixture lines to \"glab timed out\", as in mr-description-verify.md:39; the real-glab lines at mr-links-verify.md:45 and :107 stay."
    }
  ]
}
