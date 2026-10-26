#![cfg(test)]

mod common;

use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use yamt_agent::{CheckoutLook, CheckoutReply, Error, Pair, Workspace};
use yamt_conflict_repo::{git, git_ok, run_ignored_in_child};

use common::{Fixture, commit_of, pair_in};

const INHERITED_GIT_DIR_TEST: &str = "preparing_under_an_inherited_git_dir";
#[cfg(unix)]
const AGENT_WAIT: std::time::Duration = std::time::Duration::from_secs(10);

impl Fixture {
    fn ready(&self) -> CheckoutReply {
        CheckoutReply::Ready {
            folder: self.checkout().to_string_lossy().into_owned(),
        }
    }

    fn changed(&self, files: &[&str], refs: &[&str], head_moved: bool) -> CheckoutLook {
        CheckoutLook::Changed {
            folder: self.checkout().to_string_lossy().into_owned(),
            files: files.iter().map(|file| (*file).to_owned()).collect(),
            refs: refs.iter().map(|name| (*name).to_owned()).collect(),
            head_moved,
        }
    }

    /// The sweep as a window on another pair of the same data folder runs it.
    fn sweep_from_another_pair(&self) {
        let other = Pair {
            folder: self
                .range_dir
                .path()
                .join("other-0123456789abcdef")
                .join("a-b"),
            ..self.pair.clone()
        };
        Workspace::new(other).sweep_leftovers(self.range_dir.path());
    }
}

fn text_of(root: &Path, args: &[&str]) -> String {
    String::from_utf8(git_ok(root, args).unwrap()).unwrap()
}

fn commit_everything(root: &Path, message: &str) {
    git_ok(root, &["add", "--all"]).unwrap();
    git_ok(root, &["commit", "--quiet", "--allow-empty", "-m", message]).unwrap();
}

#[cfg(unix)]
fn set_mode(folder: &Path, mode: u32) {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(folder, fs::Permissions::from_mode(mode)).unwrap();
}

#[test]
fn prepare_makes_the_checkout_in_the_pair_folder_and_reuses_it_the_second_time() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();

    assert_eq!(workspace.prepare(), fixture.ready());

    let checkout = fixture.checkout();
    assert_eq!(fs::read(checkout.join("a.txt")).unwrap(), b"remote\n");
    assert_eq!(commit_of(&checkout, "HEAD"), fixture.pair.new_commit);
    assert!(
        !git(&checkout, &["symbolic-ref", "-q", "HEAD"])
            .unwrap()
            .status
            .success()
    );
    assert_eq!(text_of(&checkout, &["remote"]), "");
    assert!(!fixture.pair.folder.join("checkout.partial").exists());
    let marker = checkout.join(".git").join("yamt-test-marker");
    fs::write(&marker, b"").unwrap();

    assert_eq!(workspace.prepare(), fixture.ready());
    assert!(marker.exists());
}

#[test]
fn prepare_reuses_a_kept_checkout_with_its_changes_and_commits() {
    let fixture = Fixture::new();
    let mut first = fixture.workspace();
    first.prepare();
    let checkout = fixture.checkout();
    fs::write(checkout.join("a.txt"), b"the AI's line\n").unwrap();
    commit_everything(&checkout, "the AI's commit");
    let commit = commit_of(&checkout, "HEAD");
    fs::write(checkout.join("new.txt"), b"not committed\n").unwrap();
    first.end();

    let mut next = fixture.workspace();
    assert_eq!(next.prepare(), fixture.ready());

    assert_eq!(commit_of(&checkout, "HEAD"), commit);
    assert_eq!(
        fs::read(checkout.join("new.txt")).unwrap(),
        b"not committed\n"
    );
    assert_eq!(
        next.look_job().look(),
        fixture.changed(&["new.txt"], &[], true)
    );
}

#[test]
fn a_partial_checkout_left_by_a_crash_is_removed_before_prepare() {
    let fixture = Fixture::new();
    let partial = fixture.pair.folder.join("checkout.partial");
    let removing = fixture.pair.folder.join("checkout.removing");
    fs::create_dir_all(&partial).unwrap();
    fs::write(partial.join("stale.txt"), b"half a clone\n").unwrap();
    fs::create_dir_all(&removing).unwrap();

    assert_eq!(fixture.workspace().prepare(), fixture.ready());

    assert!(!partial.exists());
    assert!(!removing.exists());
    assert!(!fixture.checkout().join("stale.txt").exists());
    assert_eq!(
        fs::read(fixture.checkout().join("a.txt")).unwrap(),
        b"remote\n"
    );
}

#[test]
fn a_failed_prepare_leaves_no_partial_checkout() {
    let mut fixture = Fixture::new();
    fixture.pair.new_commit = "0".repeat(40);
    let mut workspace = fixture.workspace();

    let reply = workspace.prepare();

    assert!(matches!(reply, CheckoutReply::Failed { message } if !message.is_empty()));
    assert!(!fixture.pair.folder.join("checkout.partial").exists());
    assert!(!fixture.checkout().exists());
}

#[test]
fn look_is_missing_before_prepare_and_clean_after() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();
    assert_eq!(workspace.look_job().look(), CheckoutLook::Missing);

    workspace.prepare();

    assert_eq!(workspace.look_job().look(), CheckoutLook::Clean);
}

#[test]
fn an_edited_file_an_untracked_file_and_a_moved_head_each_count_as_changed() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();
    workspace.prepare();
    let checkout = fixture.checkout();

    fs::write(checkout.join("a.txt"), b"edited\n").unwrap();
    assert_eq!(
        workspace.look_job().look(),
        fixture.changed(&["a.txt"], &[], false)
    );
    git_ok(&checkout, &["checkout", "--", "a.txt"]).unwrap();

    fs::write(checkout.join("untracked.txt"), b"new\n").unwrap();
    assert_eq!(
        workspace.look_job().look(),
        fixture.changed(&["untracked.txt"], &[], false)
    );
    fs::remove_file(checkout.join("untracked.txt")).unwrap();

    commit_everything(&checkout, "an empty commit");
    assert_eq!(workspace.look_job().look(), fixture.changed(&[], &[], true));
}

#[test]
fn a_stash_alone_counts_as_changed_and_so_does_a_branch() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();
    workspace.prepare();
    let checkout = fixture.checkout();
    fs::write(checkout.join("a.txt"), b"the AI's stashed work\n").unwrap();

    git_ok(&checkout, &["stash", "--quiet"]).unwrap();

    assert_eq!(
        workspace.look_job().look(),
        fixture.changed(&[], &["stash"], false)
    );
    git_ok(&checkout, &["stash", "drop", "--quiet"]).unwrap();
    git_ok(&checkout, &["branch", "ai-work"]).unwrap();
    assert_eq!(
        workspace.look_job().look(),
        fixture.changed(&[], &["ai-work"], false)
    );
    workspace.end();
    assert!(fixture.checkout().exists());
}

#[test]
fn an_ignored_file_alone_counts_as_clean() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();
    workspace.prepare();
    let ignored = fixture.checkout().join("ignored");
    fs::create_dir_all(&ignored).unwrap();
    fs::write(ignored.join("build.out"), b"output\n").unwrap();

    assert_eq!(workspace.look_job().look(), CheckoutLook::Clean);

    workspace.end();
    assert!(!fixture.checkout().exists());
}

#[test]
fn a_checkout_git_cannot_read_is_unreadable_and_never_removed_by_end_or_sweep() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();
    workspace.prepare();
    let checkout = fixture.checkout();
    let borrowed = checkout
        .join(".git")
        .join("objects")
        .join("info")
        .join("alternates");
    fs::remove_file(borrowed).unwrap();

    let look = workspace.look_job().look();
    let CheckoutLook::Unreadable { folder, message } = look else {
        panic!("{look:?} instead of Unreadable");
    };
    assert_eq!(folder, checkout.to_string_lossy());
    assert_ne!(message, "");

    fixture.sweep_from_another_pair();
    assert!(checkout.join("a.txt").exists());
    workspace.end();
    assert!(checkout.join("a.txt").exists());
}

#[test]
fn a_checkout_without_its_own_git_folder_is_unreadable_inside_another_repository() {
    let fixture = Fixture::new();
    let outer = fixture.range_dir.path();
    git_ok(outer, &["init", "--quiet"]).unwrap();
    commit_everything(outer, "a repository around the data folder");
    let mut workspace = fixture.workspace();
    workspace.prepare();
    fs::remove_dir_all(fixture.checkout().join(".git")).unwrap();

    let look = workspace.look_job().look();

    assert!(matches!(look, CheckoutLook::Unreadable { .. }), "{look:?}");
    workspace.end();
    assert!(fixture.checkout().join("a.txt").exists());
}

#[test]
fn end_removes_a_clean_checkout_and_keeps_a_changed_one() {
    let fixture = Fixture::new();
    let mut clean = fixture.workspace();
    clean.prepare();
    clean.end();
    assert!(!fixture.checkout().exists());
    assert!(!fixture.pair.folder.join("checkout.removing").exists());

    let mut changed = fixture.workspace();
    changed.prepare();
    fs::write(fixture.checkout().join("a.txt"), b"edited\n").unwrap();
    changed.end();
    assert_eq!(
        fs::read(fixture.checkout().join("a.txt")).unwrap(),
        b"edited\n"
    );
}

#[test]
fn discard_removes_a_changed_checkout() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();
    workspace.prepare();
    fs::write(fixture.checkout().join("a.txt"), b"edited\n").unwrap();
    commit_everything(&fixture.checkout(), "the AI's commit");

    workspace.discard().unwrap();

    assert!(!fixture.checkout().exists());
    assert!(!fixture.pair.folder.join("checkout.removing").exists());
    assert_eq!(workspace.look_job().look(), CheckoutLook::Missing);
}

#[test]
fn discard_without_a_checkout_succeeds() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();

    workspace.discard().unwrap();
    workspace.prepare();
    workspace.discard().unwrap();

    workspace.discard().unwrap();
    assert!(!fixture.checkout().exists());
}

#[cfg(unix)]
#[test]
fn discard_that_cannot_rename_the_checkout_answers_remove_and_keeps_it() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();
    workspace.prepare();

    set_mode(&fixture.pair.folder, 0o555);
    let discarded = workspace.discard();
    set_mode(&fixture.pair.folder, 0o755);

    assert!(
        matches!(&discarded, Err(Error::Remove { folder, .. }) if *folder == fixture.checkout()),
        "{discarded:?}"
    );
    assert!(fixture.checkout().join("a.txt").exists());
}

#[cfg(unix)]
#[test]
fn discard_that_cannot_delete_the_checkout_answers_remove() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();
    workspace.prepare();
    let sub = fixture.checkout().join("sub");
    fs::create_dir(&sub).unwrap();
    fs::write(sub.join("kept.txt"), b"kept\n").unwrap();
    set_mode(&sub, 0o555);

    let discarded = workspace.discard();

    let removing = fixture.pair.folder.join("checkout.removing");
    set_mode(&removing.join("sub"), 0o755);
    assert!(
        matches!(&discarded, Err(Error::Remove { folder, .. }) if *folder == removing),
        "{discarded:?}"
    );
}

#[test]
fn a_checkout_left_after_a_kill_is_reused_by_the_next_window() {
    let fixture = Fixture::new();
    let mut killed = fixture.workspace();
    killed.prepare();
    fs::write(fixture.checkout().join("untracked.txt"), b"kept\n").unwrap();
    drop(killed);

    let mut next = fixture.workspace();
    assert_eq!(next.prepare(), fixture.ready());

    assert_eq!(
        fs::read(fixture.checkout().join("untracked.txt")).unwrap(),
        b"kept\n"
    );
    assert_eq!(
        next.look_job().look(),
        fixture.changed(&["untracked.txt"], &[], false)
    );
}

#[test]
fn prepare_never_acts_on_the_repository_an_inherited_git_dir_names() {
    let fixture = Fixture::new();
    let source = &fixture.pair.repo;
    git_ok(
        source,
        &["remote", "add", "origin", "https://example.invalid/r.git"],
    )
    .unwrap();

    let ran = run_ignored_in_child(&[INHERITED_GIT_DIR_TEST], |child| {
        child.env("GIT_DIR", source.join(".git"));
    });

    ran.unwrap_or_else(|error| panic!("{error}"));
}

/// Branches, remotes and HEAD of `source`, as git lists them.
fn refs_and_head(source: &Path) -> String {
    let mut state = text_of(source, &["for-each-ref", "refs/heads"]);
    state.push_str(&text_of(source, &["remote", "-v"]));
    state.push_str(&text_of(source, &["symbolic-ref", "HEAD"]));
    state
}

#[test]
#[ignore = "run by prepare_never_acts_on_the_repository_an_inherited_git_dir_names"]
fn preparing_under_an_inherited_git_dir() {
    let git_dir = PathBuf::from(env::var_os("GIT_DIR").unwrap());
    let source = git_dir.parent().unwrap();
    let before = refs_and_head(source);
    let (_range_dir, pair) = pair_in(source);
    let checkout = pair.folder.join("checkout");
    let mut workspace = Workspace::new(pair);

    let reply = workspace.prepare();

    assert_eq!(
        reply,
        CheckoutReply::Ready {
            folder: checkout.to_string_lossy().into_owned()
        }
    );
    assert_eq!(refs_and_head(source), before);
    assert_eq!(workspace.look_job().look(), CheckoutLook::Clean);
    assert_eq!(fs::read(checkout.join("a.txt")).unwrap(), b"remote\n");
    #[cfg(unix)]
    the_agent_finds_the_checkout_s_own_repository(&mut workspace, &checkout);
}

#[cfg(unix)]
fn the_agent_finds_the_checkout_s_own_repository(workspace: &mut Workspace, checkout: &Path) {
    use yamt_agent::{AgentCommand, AgentStartReply, HostEvent};

    let print = AgentCommand {
        program: "sh".to_owned(),
        args: vec![
            "-c".to_owned(),
            "echo \"${GIT_DIR-unset} $(git rev-parse --show-toplevel)\"".to_owned(),
        ],
        home_folders: Vec::new(),
    };
    let (sender, events) = std::sync::mpsc::channel();
    let reply = workspace.start(&print, sender);
    assert!(
        matches!(reply, AgentStartReply::Started { .. }),
        "{reply:?}"
    );
    let printed = match events.recv_timeout(AGENT_WAIT).unwrap() {
        HostEvent::Message { text } => text,
        other @ (HostEvent::Log { .. } | HostEvent::Exited { .. }) => panic!("{other:?}"),
    };
    let (git_dir, top) = printed.split_once(' ').unwrap();
    assert_eq!(git_dir, "unset");
    assert_eq!(
        fs::canonicalize(top).unwrap(),
        fs::canonicalize(checkout).unwrap()
    );
}
