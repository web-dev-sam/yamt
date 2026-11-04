# MrDescriptionRustCorrect

Agent output (`agent://MrDescriptionRustCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionRustCorrect.md), collected 2026-11-04T00:05:00.989Z.

{
  "verdict": "pass",
  "checked": [
    "RK66 walk: typed output only. Crossing attrs: href, data-src/src, alt/title, lang, ol start, exact td style, open, task-box flags. LEFT_OUT has all 27 brief tags; comments skipped",
    "Nesting: html wrapper is depth 0, so 32 user levels kept. nesting_past_32_levels_is_left_out pins 32 quotes and 31 ems exactly, so an off-by-one fails it. The warn is untested, like every crate log",
    "Offers: pages pushed only for kept Page links; no subtree walked twice or offered from a dropped one; lifted images always appended. pages_and_uploads_are_collected_once_each_in_order pins dedup and order",
    "Addresses: link_of = parse-else-join. Other host and port 8443 fail the upload origin check (tested); url drops dot segments. REST route goes to glab's host; fallback is same-origin",
    "Accepted deviations: sub-path REST route for the legacy path form (falls back to web path; Contract gives only base); element.rs; Described.web_images; ' kept in a page (no opener treats it specially)",
    "All Acceptance test names present. Survivors: 156 mutants, 0 missed, none kept, so VF7 has nothing to grade. fake glab routes ordered right. No tests run: no block depended on one"
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/picture.rs",
      "line": 259,
      "severity": "should",
      "rule_id": "RK53",
      "problem": "[INFERENCE] Not verified here. GitLab can answer an upload (REST or web path) with a 302 to object storage. Go's client follows it and still sends a PRIVATE-TOKEN header to the new host. The login would then reach a host other than the project's GitLab. Uploads add this to every description image, and nothing pins it.",
      "fix": "Run `glab api --include` on the !200000 upload by both routes and record whether either answers 3xx. If one does, before uploads ship, take the redirect question to the design (refuse redirects or the route) and record it in RK53."
    },
    {
      "file": "crates/merge-requests/src/web_page.rs",
      "line": 117,
      "severity": "nit",
      "problem": "The Windows opener comment names `project_page` as the only reason no URL needs quoting. `WebPage::linked` (url's serialisation) now feeds the opener too, so a reader auditing RK41 has to find the second guard alone; nothing else gets harder.",
      "fix": "Reword it to: `project_page` and `WebPage::linked` (url's percent-encoding) let no space, quote or control character in."
    }
  ]
}
