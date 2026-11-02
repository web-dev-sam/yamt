# Slice mr-row-details-verify — the gate, the WebKit fixture and the real app for the row details

Design: `docs/slices/briefs/mr-row-details-design.md` option A. Request acceptance:
`docs/slices/request-mr-row-details.md` "Acceptance". Proposed plan §2 #151–#157. Recipes: `skill://verification`
(VF4–VF11); windows only on a private display (VF8), screenshots only from the session or the private display (VF9).

## Target

**Owned:** none (read-only commands; your scratch folder only).

**Read-only:** the whole tree.

**Needs:** `mr-row-details-rust` (with `just bindings` applied), `-core`, `-state`, `-hover` and `-page` committed.
**Smoke pass** (steps B–C, no `just check`) as soon as `-page` is committed, beside its reviewers. **Final pass** once
the docs keeper has named every new file in the project map (`just map-check`, PM6) and `rerequest_review` /
`MergeRequestSource.rerequestReview` in architecture and ipc-contract: `just check` once, then B–C.

**Non-goals:** the owner's GitLab playground check (below, for the orchestrator to hand on); fixing anything (VF1);
`just mutants` (VF7).

## Contract

Fixture scripts `?mr=list` and `?mr=local` as `mr-row-details-state` built them (the owner's example keeps !639, !627,
!623, !619, !607, !603: "6 of 40 merge requests"; !635 has a zero size and, under `local`, `mergesCleanly`; the fixture
loads no remote address). Scenario `tests/glab/mr-row-details/` (!52, !51, !50, posts 1–2, pictures 1–3) as
`mr-row-details-rust` recorded it. Words: "Author: Anna Berg", "No assignee or reviewer", "No approvals", "Review
requested", "Reviewed", "Approved", "Changes requested", "Re-request review", "Due today", "1 day left", "1 day
overdue", "Assignee: not Me", "+0 −0 · 0 files". CSP `img-src 'self' data: yamt-picture: http://yamt-picture.localhost
https://secure.gravatar.com https://www.gravatar.com`.

## Change (the steps)

**A. Gate (final pass only).** `just check` → pass, or the failing recipe and its first 30 lines.

**B. WebKit fixture.** The page brief's nine fixture steps (`mr-row-details-page.md` Acceptance "WebKit fixture"),
`--size 1600x1000`, in dark and light; plus: hover three tooltips in a row (each after the first shows at once), Escape
and a list scroll each hide a shown tip; the CI box still opens on hover and closes on leaving; keyboard: Tab to the
Assignee button, Enter opens the checklist with focus on its first value, Space toggles, Shift+Space excludes, Escape
closes with focus back on the button; Tab into a people box reaches each re-request button, Enter re-requests.

**C. Real app.** The page brief's real-app steps (`--glab mr-row-details` on `scripts/local-conflicts-repo.sh
<scratch>/rd`), plus: no CSP error in the app's log for the `yamt-picture:` pictures; the only `img` addresses on the
page are `yamt-picture:` ones and the scenario's Gravatar address; a second opening of the page asks glab for no
picture again (the fake log); post 1 (ben on !52) reads "Review requested" and its body names ben's global id; then
"Re-request review" on chiara (approved) on !52 (post 2) shows its refusal sentence in the box, gone once the box closes; no fake-glab log line
names a Gravatar host or any mutation but `mergeRequestReviewerRereview`; the app log has one line per re-request.
`shot` in dark and light.

## Acceptance

Each step: pass/fail with the observed labels, tips, log lines and fake-glab log lines pasted verbatim; screenshots'
paths.

Owner check (hand on, not run): on the GitLab playground, run `scripts/gitlab-playground.sh` (it adds the "Empty
change" merge request), open the page in the real app: uploaded pictures load, people without one show their Gravatar
(GitLab's identicon when they have none there); "Empty change" shows "+0 −0 · 0 files" and both status icons; after a
reviewer has reviewed, "Re-request review" in yamt shows in GitLab as a new review request for that reviewer (their
state back to awaiting review); record the logged `queryComplexity`.
