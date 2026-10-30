use std::os::unix::fs::PermissionsExt;

use serde_json::json;
use yamt_local_merge::{BranchBefore, MergeView, Refusal, ReturnTo, Started, find_live, start};

use crate::common::{CLEAN, DEVELOP, DUE_DATES, Fixture, IID, MAIN, branches};

const HOOK_MODE: u32 = 0o755;

#[test]
fn a_missing_branch_is_created_tracking_gitlab_and_the_merge_stops_with_conflicts() {
    let fixture = Fixture::new();
    let develop = fixture.tip(DEVELOP);

    let started = start(fixture.root(), &branches(DUE_DATES));

    let (branch, target) = (DUE_DATES.to_owned(), MAIN.to_owned());
    let conflicts = true;
    assert_eq!(
        started,
        Ok(Started {
            branch,
            target,
            conflicts
        })
    );
    let source = fixture.gitlab_tip(DUE_DATES);
    let goal = fixture.gitlab_tip(MAIN);
    assert_eq!(fixture.head(), format!("refs/heads/{DUE_DATES} {source}"));
    assert_eq!(fixture.git(&["rev-parse", "MERGE_HEAD"]), goal);
    assert_eq!(
        fixture.git(&["diff", "--name-only", "--diff-filter=U"]),
        "src/board/card.ts"
    );
    let upstream = fixture.git(&["rev-parse", "--abbrev-ref", &format!("{DUE_DATES}@{{u}}")]);
    assert_eq!(upstream, format!("origin/{DUE_DATES}"));
    assert_eq!(fixture.tip(DEVELOP), develop);
}

#[test]
fn the_record_names_what_abort_needs_and_the_window_sees_it() {
    let fixture = Fixture::new();

    start(fixture.root(), &branches(DUE_DATES)).unwrap();

    let record: serde_json::Value =
        serde_json::from_slice(&std::fs::read(fixture.record_path()).unwrap()).unwrap();
    let expected = json!({
        "format": 1, "iid": IID, "remote": "origin", "branch": DUE_DATES, "target": MAIN,
        "returnTo": { "kind": "branch", "name": DEVELOP },
        "branchBefore": { "kind": "created" },
        "head": fixture.gitlab_tip(DUE_DATES), "merging": fixture.gitlab_tip(MAIN),
    });
    assert_eq!(record, expected);
    let live = find_live(fixture.root()).unwrap().unwrap();
    assert_eq!(live.iid(), IID);
    let return_to = Some(ReturnTo::Branch {
        name: DEVELOP.to_owned(),
    });
    let (branch, target) = (DUE_DATES.to_owned(), MAIN.to_owned());
    let branch_before = BranchBefore::Created;
    let view = MergeView {
        branch,
        target,
        return_to,
        branch_before,
    };
    assert_eq!(live.view(), view);
}

fn merge_message_subject(fixture: &Fixture) -> String {
    let message = std::fs::read_to_string(fixture.root().join(".git/MERGE_MSG")).unwrap();
    message.lines().next().unwrap().to_owned()
}

#[test]
fn the_merge_names_gitlabs_target_as_git_names_a_remote_tracking_branch() {
    let fixture = Fixture::new();

    start(fixture.root(), &branches(DUE_DATES)).unwrap();

    let subject = format!("Merge remote-tracking branch 'origin/main' into {DUE_DATES}");
    assert_eq!(merge_message_subject(&fixture), subject);
}

#[test]
fn a_local_branch_named_like_the_remote_target_does_not_change_what_is_merged() {
    let fixture = Fixture::new();
    fixture.git(&["branch", "origin/main", DEVELOP]);

    start(fixture.root(), &branches(DUE_DATES)).unwrap();

    assert_eq!(
        fixture.git(&["rev-parse", "MERGE_HEAD"]),
        fixture.gitlab_tip(MAIN)
    );
    let subject =
        format!("Merge remote-tracking branch 'refs/remotes/origin/main' into {DUE_DATES}");
    assert_eq!(merge_message_subject(&fixture), subject);
}

#[test]
fn a_local_branch_named_like_the_remote_target_does_not_change_what_is_merged_without_ambiguity_warnings()
 {
    let fixture = Fixture::new();
    fixture.git(&["config", "core.warnAmbiguousRefs", "false"]);
    fixture.git(&["branch", "origin/main", DEVELOP]);

    start(fixture.root(), &branches(DUE_DATES)).unwrap();

    assert_eq!(
        fixture.git(&["rev-parse", "MERGE_HEAD"]),
        fixture.gitlab_tip(MAIN)
    );
}

#[test]
fn a_branch_only_behind_is_fast_forwarded() {
    let fixture = Fixture::new();
    let behind = fixture.gitlab(&["rev-parse", &format!("{DUE_DATES}~1")]);
    fixture.git(&["branch", DUE_DATES, &behind]);

    let started = start(fixture.root(), &branches(DUE_DATES)).unwrap();

    assert!(started.conflicts);
    let source = fixture.gitlab_tip(DUE_DATES);
    assert_eq!(fixture.head(), format!("refs/heads/{DUE_DATES} {source}"));
    let view = find_live(fixture.root()).unwrap().unwrap().view();
    let id = behind[..7].to_owned();
    assert_eq!(view.branch_before, BranchBefore::MovedFrom { id });
    assert_eq!(fixture.config(&format!("branch.{DUE_DATES}.remote")), None);
}

#[test]
fn a_branch_already_at_gitlabs_tip_is_unchanged_and_may_be_checked_out() {
    let fixture = Fixture::new();
    let source = fixture.gitlab_tip(DUE_DATES);
    fixture.git(&["checkout", "-q", "-b", DUE_DATES, &source]);

    let started = start(fixture.root(), &branches(DUE_DATES)).unwrap();

    assert!(started.conflicts);
    let view = find_live(fixture.root()).unwrap().unwrap().view();
    assert_eq!(view.branch_before, BranchBefore::Unchanged);
    assert_eq!(view.return_to, None);
}

#[test]
fn a_stale_has_conflicts_merges_clean_and_still_stops() {
    let fixture = Fixture::new();

    let started = start(fixture.root(), &branches(CLEAN));

    let (branch, target) = (CLEAN.to_owned(), MAIN.to_owned());
    let conflicts = false;
    assert_eq!(
        started,
        Ok(Started {
            branch,
            target,
            conflicts
        })
    );
    assert_eq!(
        fixture.git(&["rev-parse", "MERGE_HEAD"]),
        fixture.gitlab_tip(MAIN)
    );
    assert_eq!(fixture.git(&["ls-files", "-u"]), "");
    assert!(find_live(fixture.root()).unwrap().is_some());
}

#[test]
fn an_untracked_file_the_merge_would_overwrite_puts_everything_back() {
    let fixture = Fixture::new();
    fixture.git(&["checkout", "-q", "--detach", &format!("{MAIN}~1")]);
    fixture.write("src/board/priority.ts", "mine\n");
    let before = fixture.checkout();

    let started = start(fixture.root(), &branches(DUE_DATES));

    let Err(Refusal::GitRefused { message, left }) = started else {
        panic!("{started:?}");
    };
    assert!(
        message.starts_with(
            "error: The following untracked working tree files would be overwritten by merge"
        ),
        "{message}"
    );
    assert_eq!(left, []);
    assert_eq!(fixture.checkout(), before);
    let mine = std::fs::read_to_string(fixture.root().join("src/board/priority.ts")).unwrap();
    assert_eq!(mine, "mine\n");
    assert_eq!(fixture.config(&format!("branch.{DUE_DATES}.remote")), None);
}

#[test]
fn a_target_moved_between_the_fetch_and_the_merge_puts_everything_back() {
    let fixture = Fixture::new();
    let hooks = fixture.root().join(".git/hooks");
    std::fs::create_dir_all(&hooks).unwrap();
    let hook = hooks.join("post-checkout");
    let moves_target = "#!/bin/sh\ngit update-ref refs/remotes/origin/main refs/heads/develop\n";
    std::fs::write(&hook, moves_target).unwrap();
    std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(HOOK_MODE)).unwrap();
    let before = fixture.checkout();

    let started = start(fixture.root(), &branches(DUE_DATES));

    let Err(Refusal::GitRefused { left, .. }) = started else {
        panic!("{started:?}");
    };
    assert_eq!(left, []);
    assert_eq!(fixture.checkout(), before);
    assert!(!fixture.root().join(".git/MERGE_HEAD").exists());
}
