use std::path::PathBuf;
use std::process::Command;

use yamt_local_merge::{WindowClaim, claim_window};

use super::through_glab::{in_this_repository, run_with_fakes};
use super::*;

const RESOLVE_TEST: &str = "merge_requests::tests::resolve::resolve_replies_on_path_s_glab";
const CONTINUE_TEST: &str = "merge_requests::tests::resolve::continue_replies_on_path_s_glab";
const SCENARIO: &str = "mr-conflicts";
const NO_DISPLAY: &str = "cannot start yamt: no display";
/// Well inside `CLAIM_WAIT`, and past the first probes.
const WINDOW_CLAIMS_AFTER: Duration = Duration::from_millis(300);

/// A window on `scripts/mr-conflict-repo.sh`'s repository, on `develop`, whose `origin` is the fake GitLab.
fn mr_conflict_window() -> MergeRequestWindow {
    let repo = TempDir::new().unwrap();
    let script = in_this_repository("scripts/mr-conflict-repo.sh");
    let built = Command::new(script).arg(repo.path()).output().unwrap();
    assert!(built.status.success(), "{built:?}");
    open_window_in(repo)
}

fn root_of(window: &MergeRequestWindow) -> PathBuf {
    std::fs::canonicalize(window.repo.path()).unwrap()
}

fn resolve(window: &MergeRequestWindow, iid: u32) -> Value {
    let reply = block_on(resolve_merge_request(
        window.webview.clone(),
        MergeRequestIid(iid),
    ));
    serde_json::to_value(reply.unwrap()).unwrap()
}

fn continue_merge(window: &MergeRequestWindow, iid: u32) -> Value {
    let reply = block_on(continue_merge_request(
        window.webview.clone(),
        MergeRequestIid(iid),
    ));
    serde_json::to_value(reply.unwrap()).unwrap()
}

fn local(window: &MergeRequestWindow) -> Value {
    let reply = block_on(find_local_merge(window.webview.clone()));
    serde_json::to_value(reply.unwrap()).unwrap()
}

/// Resolves through the composing function with `start` as the window start.
fn resolved_with(
    window: &MergeRequestWindow,
    iid: u32,
    start: impl FnOnce(&Path) -> Result<(), String>,
) -> Value {
    let state = window.webview.state();
    let reply = resolved(&state, Glab::find().as_ref(), MergeRequestIid(iid), start);
    serde_json::to_value(reply).unwrap()
}

/// Continues through the composing function with `start` as the window start.
fn continued_with(
    window: &MergeRequestWindow,
    iid: u32,
    start: impl FnOnce(&Path) -> Result<(), String>,
) -> Value {
    let reply = continued(&window.webview.state(), MergeRequestIid(iid), start);
    serde_json::to_value(reply).unwrap()
}

fn failing_start(_: &Path) -> Result<(), String> {
    Err(NO_DISPLAY.to_owned())
}

/// Like a starting merge window: claims `root`'s merge after `WINDOW_CLAIMS_AFTER` and holds the claim in `claims`.
fn claim_later(root: &Path, claims: mpsc::Sender<WindowClaim>) {
    let root = root.to_owned();
    thread::spawn(move || {
        thread::sleep(WINDOW_CLAIMS_AFTER);
        claims.send(claim_window(&root).unwrap().unwrap()).unwrap();
    });
}

fn started_due_dates() -> Value {
    json!({ "branch": "feature/due-dates", "target": "main", "conflicts": true })
}

#[test]
fn without_a_project_resolve_refuses_continue_answers_ended_and_nothing_merges() {
    let plain = TempDir::new().unwrap();
    git_ok(plain.path(), &["init", "-q"]).unwrap();
    let window = open_window_in(plain);

    let failed = json!({ "kind": "failed", "message": NO_PROJECT });
    assert_eq!(
        resolve(&window, 21),
        json!({ "kind": "gitLabRefused", "refusal": failed })
    );
    assert_eq!(continue_merge(&window, 21), json!({ "kind": "ended" }));
    assert_eq!(local(&window), json!({ "kind": "free" }));
}

#[test]
fn resolve_merge_request_answers_every_refusal_and_starts_the_merge_window() {
    run_with_fakes(RESOLVE_TEST, SCENARIO);
}

#[test]
#[ignore = "run by resolve_merge_request_answers_every_refusal_and_starts_the_merge_window"]
fn resolve_replies_on_path_s_glab() {
    let window = mr_conflict_window();
    let root = root_of(&window);
    let refused_by_gitlab =
        |kind: &str| json!({ "kind": "gitLabRefused", "refusal": { "kind": kind } });
    assert_eq!(resolve(&window, 22), refused_by_gitlab("fromFork"));
    assert_eq!(resolve(&window, 30), refused_by_gitlab("notOpen"));
    std::fs::write(root.join("README.md"), "edited\n").unwrap();
    let uncommitted = json!({ "kind": "refused", "refusal": { "kind": "uncommittedChanges" } });
    assert_eq!(resolve(&window, 21), uncommitted);
    git_ok(&root, &["checkout", "--", "README.md"]).unwrap();
    assert_eq!(local(&window), json!({ "kind": "free" }));

    let window_failed = resolved_with(&window, 21, failing_start);

    let failed =
        json!({ "kind": "windowFailed", "started": started_due_dates(), "message": NO_DISPLAY });
    assert_eq!(window_failed, failed);
    let merging = |open: bool| json!({ "kind": "merging", "iid": 21, "windowOpen": open });
    assert_eq!(local(&window), merging(false));
    let claim = claim_window(&root).unwrap().unwrap();
    assert_eq!(local(&window), merging(true));
    drop(claim);
    let already = json!({ "kind": "alreadyMerging", "iid": 21 });
    assert_eq!(
        resolve(&window, 21),
        json!({ "kind": "refused", "refusal": already })
    );

    git_ok(&root, &["merge", "--abort"]).unwrap();
    let (claims, claimed) = mpsc::channel();
    let mut roots = Vec::new();
    let started = resolved_with(&window, 21, |root| {
        roots.push(std::fs::canonicalize(root).unwrap());
        claim_later(root, claims);
        Ok(())
    });

    assert_eq!(
        started,
        json!({ "kind": "started", "started": started_due_dates() })
    );
    assert_eq!(local(&window), merging(true));
    assert_eq!(roots, [root]);
    drop(claimed.recv().unwrap());
}

#[test]
fn continue_merge_request_answers_ended_already_open_opened_and_window_failed() {
    run_with_fakes(CONTINUE_TEST, SCENARIO);
}

#[test]
#[ignore = "run by continue_merge_request_answers_ended_already_open_opened_and_window_failed"]
fn continue_replies_on_path_s_glab() {
    let window = mr_conflict_window();
    let root = root_of(&window);
    let ended = json!({ "kind": "ended" });
    assert_eq!(continue_merge(&window, 21), ended);
    let mut claims = Vec::new();
    let mut claimed_at = None;
    let started = resolved_with(&window, 21, |root| {
        claims.push(claim_window(root).unwrap().unwrap());
        claimed_at = Some(Instant::now());
        Ok(())
    });
    assert_eq!(started["kind"], "started", "{started}");
    assert!(claimed_at.unwrap().elapsed() < CLAIM_WAIT);
    assert_eq!(continue_merge(&window, 23), ended);
    assert_eq!(
        continue_merge(&window, 21),
        json!({ "kind": "alreadyOpen" })
    );
    drop(claims);

    let (claims, claimed) = mpsc::channel();
    let mut roots = Vec::new();
    let opened = continued_with(&window, 21, |root| {
        roots.push(std::fs::canonicalize(root).unwrap());
        claim_later(root, claims);
        Ok(())
    });

    let names = json!({ "kind": "opened", "branch": "feature/due-dates", "target": "main" });
    assert_eq!(opened, names);
    assert_eq!(local(&window)["windowOpen"], true);
    assert_eq!(roots, std::slice::from_ref(&root));
    drop(claimed.recv().unwrap());
    let asked = Instant::now();
    assert_eq!(continued_with(&window, 21, |_| Ok(())), names);
    assert!(asked.elapsed() >= CLAIM_WAIT);
    assert_eq!(
        continued_with(&window, 21, failing_start),
        json!({ "kind": "windowFailed", "message": NO_DISPLAY })
    );
    git_ok(&root, &["merge", "--abort"]).unwrap();
    assert_eq!(continue_merge(&window, 21), ended);
}
