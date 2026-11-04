# MrLinksDesign

Agent output (`agent://MrLinksDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksDesign.md), collected 2026-11-04T00:59:39.930Z.

{
  "options": [
    {
      "name": "A — Rust finds links in the description walk, one lookup query per hover",
      "summary": "read_links(iid): logged_in_project, the description's own fetch, the panel's walk (its pages + new commit_titles); pages on the project's https server classified by GitLab's routes (issues/work_items/epics/commit/diffs?commit_id/compare); one entry per thing at first mention; issues+epics via one aliased query of project|group.workItems(iids) with the hierarchy parent (CE fields only); commit titles from GitLab's reference title. Window draws three lists.",
      "visions": [
        2,
        3,
        4,
        1
      ],
      "cost": "No dependency; one command, one source method; 3–4 glab runs per first hover; long descriptions cut into calls ≤200 score; 4 implementer slices + verifier."
    },
    {
      "name": "B — the window classifies the panel's tree and names the lookups",
      "summary": "A core TS module walks readDescription's tree, classifies DescriptionLink pages, groups and dedupes; a new Rust command looks up the window-named namespaces/iids; the tree gains a commit-title field only the box uses.",
      "visions": [
        1
      ],
      "cost": "Two commands per hover; address rules in Rust and TS; the window names what GitLab is asked; costs visions 2 and 3."
    },
    {
      "name": "C — raw Markdown parsed for references, workItemsByReference",
      "summary": "Parse the list's raw description for GLFM references skipping code; look up via workItemsByReference (16.7+ experiment) and Repository.commit per commit (absent at 15.6). Lists short refs GitLab doesn't link, but every 7-hex word becomes a commit candidate.",
      "visions": [
        5
      ],
      "cost": "A second GLFM reader; false commit lines; 16.7+ floor for any lookup; costs visions 2 and 1."
    }
  ],
  "recommendation": "Option A. The same walk the description panel uses decides what is linked (vision 2); GitLab's routes, not its data-* internals, classify; one CE-only query (measured: 50 of 200 for 2 parts/5 iids, null part or missing iid answers without error) gives titles, states and direct parents; commits need no query. Rust offers every line and parent page before replying, so open_page stays (RK41). Cost: one command, 3–4 glab runs per first hover, Group.workItems needs 16.3 for epics; request slice 3 (core) folds into Rust and the page's words file.",
  "design_doc": "docs/slices/briefs/mr-links-design.md",
  "briefs_written": [
    "docs/slices/briefs/mr-links-rust.md",
    "docs/slices/briefs/mr-links-app.md",
    "docs/slices/briefs/mr-links-state.md",
    "docs/slices/briefs/mr-links-page.md",
    "docs/slices/briefs/mr-links-verify.md"
  ],
  "slice_graph": "Wave 1: mr-links-rust (crate, fake glab, scenario mr-links) beside the running mr-description-page. Wave 2: mr-links-app (needs rust). Then orchestrator `just bindings`. Wave 3: mr-links-state (needs app+bindings; may run beside mr-description-page). Wave 4: mr-links-page (needs state AND mr-description-page committed: it owns MergeRequestRow.vue after that). Wave 5: docs keeper + mr-links-verify (smoke after page, final after docs). Wave 6: owner check. Never more than two implementers.",
  "open_questions": []
}
