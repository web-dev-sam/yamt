# Rules review after v0 (curator, Propose mode)

Context: yamt's rules review after the v0 work (desktop shell, git cross-check, window reads git,
keep work per file, file icons, choose a side, choice panel, release), before the follow-up rows 11
and 12 and any later milestone. The owner approves each change in plain language; this run only
proposes and changes nothing.
Inputs: `.omp/run/findings.jsonl` lines 284–405 (finding id = line number; `source: "human"` weighs
most). Board: `docs/slices/SLICES.md` v0 section and rows 11/12. Decision record: `docs/plan.md` §2
rows 1–43 (latest #36–#43). Last review's outcome: `.omp/GUARDRAILS.md` changelog (2026-10-10).
Output schema: the curator agent definition's.

## Task

Run the retro procedure of `skill://guardrail-evolution` in Propose mode over findings #284–#405.
Cover each item below as its own proposal or an explicit "no change" with a reason:

- **Owner, #356:** the orchestrator handed off a session that still had most of its room; the owner
  wants work continued until the context is actually near its limit or the owner asks.
- **Ownership grants mid-run (#286/#296):** a grant only works through the isolated clone's own
  registry, not the main checkout's — the orchestrate skill §3 says the opposite.
- **Hooks:** oxlint `/*` globs miss nested specifiers (#336); a bash redirect into `frontend/src/`
  was not blocked (#337).
- **Screenshots (#377):** an implementer screenshotted "the active window" and captured the owner's
  browser. Smoke recipes should target the test window only.
- **Desktop smoke recipe (#405):** port 5173 is often held by the owner's other projects; the
  release binary (embedded frontend) avoided it. Should the Tauri smoke in `skill://verification`
  prefer the release binary, or keep the dev binary with a check?
- **Mutation testing (#401–#404):** which survivors count as wiring (dropped) vs real gaps; the
  `fileIcon.ts` anomaly (#402) as a verification-skill note only if the cause is known — otherwise
  "no change, investigate in row 11".
- **Licence file (#381):** the release jobs check `THIRD_PARTY_LICENSES.txt` is current; should a
  dependency change also run `just third-party-licenses` (e.g. a note in the dependency-change
  rule), or is the release check enough?
- **Review loop:** the release work needed two follow-up rounds plus a polish task; look at
  #366–#397 for a rule that would have caught the blocks (inherited environment variables;
  install steps never run on a clean machine) before review.
- **`skill://project-map`:** confirm it matches the tree after `dd9abc4` (`just map-check` passes;
  check the prose, state table and module descriptions too). Bump the verified commit in Apply mode.
- **Risk register:** rows for the AppImage environment (#366/#372/#387) and the close fallback
  (#315/#353/#375), if not already there.

Each proposal must be small enough that the owner can approve or reject it on its own, with one
plain sentence saying what changes for the owner.
