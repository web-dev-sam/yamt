# Slice local-conflicts-verify — the gate, the WebKit fixture and the real app for the local conflict check

Design: `docs/slices/briefs/local-conflicts-design.md` option A. Request acceptance:
`docs/slices/request-local-conflict-check.md` "Acceptance". Plan §2 #149–#150. Recipes: `skill://verification`
(VF4–VF11); windows only on a private display (VF8), screenshots only from the session or the private display (VF9).

## Target

**Owned:** none (read-only commands; your scratch folder only).

**Read-only:** the whole tree.

**Needs:** `LocalConflictsGitio`, `LocalConflictsCheck` (with `just bindings` applied) and `LocalConflictsPage`
committed. **Smoke pass** (steps B–C, no `just check`) as soon as `LocalConflictsPage` is committed, beside its
reviewers. **Final pass** once the docs keeper has named `scripts/local-conflicts-repo.sh` in the project map
(`just map-check`, PM6) and applied the design §4 "Shared edits" docs: `just check` once, then B–D.

**Non-goals:** the owner's GitLab playground check (below, for the orchestrator to hand on); fixing anything (VF1);
`just mutants` (VF7).

## Contract

Scenario `tests/glab/local-conflicts/` on `scripts/local-conflicts-repo.sh <dir>` (brief
`local-conflicts-check.md` "Scenario"). Words: rule 3's state "No conflicts (checked locally). GitLab has not checked
the rest yet" (icon Lucide `circle-dashed-check`, muted tone); "Has conflicts"; "Has conflicts. Also blocked:
discussions are unresolved; it is a draft"; "Ready to merge"; "Needs a rebase"; "GitLab is still checking whether it
can be merged". Fixture script `?mr=local` sends its checked rows 1,000 ms after the list's end.

## Change (the steps)

**A. Gate (final pass only).** `just check` → pass, or the failing recipe and its first 30 lines.

**B. WebKit fixture.** `just app-session start-fixture --name lc --diff --mr local --size 1600x1000`; open the
merge-request page; `read` the readiness labels of !640, !638, !635 at once (GitLab's: "Has conflicts", "Ready to
merge", "GitLab is still checking whether it can be merged") and again after 1.5 s (!640 and !635 rule 3's words,
!638 "Has conflicts"); one `shot` after, showing the dashed-ring icon; `stop --name lc`.

**C. Real app.** `scripts/local-conflicts-repo.sh <scratch>/lc`; snapshot `git -C <scratch>/lc for-each-ref`,
`status --porcelain`, `cat .git/HEAD`, `ls .git/FETCH_HEAD`; build the debug app with its pages as
`skill://verification` says; `just app-session start-app --name lc --diff --dir <scratch>/lc --glab local-conflicts`;
open the merge-request page; once the check has ended (the app log's one local-check line), `read` every row's
readiness label: !41, !43, !45, !48 rule 3's words; !42 "Has conflicts"; !47 "Has conflicts. Also blocked:
discussions are unresolved; it is a draft"; !44 "Ready to merge"; !46 "Needs a rebase"; !49 "GitLab is still
checking whether it can be merged". Refresh once: the same labels, and the log's second local-check line says no merge
ran. `shot` in dark and light; `stop --name lc`; the four snapshots byte-identical to before.

**D. Unreachable remote (real app).** As C on a fresh `<scratch>/lc2`, with the bare `.git/fake-gitlab.git` moved away
before the page opens: every row keeps GitLab's label, no problem box, one warning line in the log.

## Acceptance

Each step: pass/fail with the observed labels, log lines and snapshot comparison pasted verbatim; screenshots' paths.

Owner check (hand on, not run): on the GitLab playground (`scripts/gitlab-playground.sh`), push to a merge request's
target so GitLab marks it conflicting while it merges clean (or the reverse); without opening it in GitLab, yamt's
list shows rule 3's state (or "Has conflicts").
