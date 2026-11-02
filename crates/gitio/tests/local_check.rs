#![cfg(test)]

use std::path::{Path, PathBuf};
use std::time::Duration;

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git_ok};
use yamt_gitio::{Error, FETCH_TIMEOUT, MergeOutcome, MergeTreeRun, Oid, RemoteRef, Repo};

const MERGE_TIMEOUT: Duration = Duration::from_secs(30);
const UNKNOWN_ID: &str = "0123456789abcdef0123456789abcdef01234567";
const SAME_LINE: [ConflictFile<'static>; 1] = [ConflictFile {
    path: "a.txt",
    kind: FileKind::Regular,
    base: Some(b"base\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];
const DISJOINT: [ConflictFile<'static>; 2] = [
    ConflictFile {
        path: "a.txt",
        kind: FileKind::Regular,
        base: Some(b"a\n"),
        local: Some(b"a local\n"),
        remote: Some(b"a\n"),
    },
    ConflictFile {
        path: "b.txt",
        kind: FileKind::Regular,
        base: Some(b"b\n"),
        local: Some(b"b\n"),
        remote: Some(b"b remote\n"),
    },
];

fn text(dir: &Path, args: &[&str]) -> String {
    String::from_utf8(git_ok(dir, args).unwrap()).unwrap()
}

fn commit(repo: &Repo, name: &str) -> Oid {
    repo.commit_named(name).unwrap().unwrap()
}

/// Every run the installed git can do: `Writing` works wherever `Quiet` does.
fn supported_runs(repo: &Repo) -> Vec<MergeTreeRun> {
    match MergeTreeRun::for_version(repo.version().unwrap()) {
        Some(MergeTreeRun::Quiet) => vec![MergeTreeRun::Quiet, MergeTreeRun::Writing],
        Some(MergeTreeRun::Writing) => vec![MergeTreeRun::Writing],
        None => Vec::new(),
    }
}

/// What a merge must leave as it was: every ref, the status, the index and HEAD.
fn untouched(root: &Path) -> [String; 4] {
    [
        text(root, &["for-each-ref"]),
        text(root, &["status", "--porcelain"]),
        text(root, &["hash-object", ".git/index"]),
        text(root, &["rev-parse", "HEAD"]),
    ]
}

#[test]
fn merge_tree_is_clean_for_disjoint_changes_and_conflicts_for_the_same_line() {
    let disjoint = diverged_repo(&DISJOINT).unwrap();
    let same_line = diverged_repo(&SAME_LINE).unwrap();
    let disjoint = Repo::discover(disjoint.path()).unwrap();
    let same_line = Repo::discover(same_line.path()).unwrap();
    let runs = supported_runs(&disjoint);

    for run in runs {
        let clean = disjoint.merge_tree(
            &commit(&disjoint, "local"),
            &commit(&disjoint, "remote"),
            run,
            MERGE_TIMEOUT,
        );
        let conflicts = same_line.merge_tree(
            &commit(&same_line, "local"),
            &commit(&same_line, "remote"),
            run,
            MERGE_TIMEOUT,
        );

        assert_eq!(clean.unwrap(), MergeOutcome::Clean, "{run:?}");
        assert_eq!(conflicts.unwrap(), MergeOutcome::Conflicts, "{run:?}");
    }
}

#[test]
fn a_quiet_merge_writes_no_object_and_leaves_refs_index_and_worktree_alone() {
    let dir = diverged_repo(&SAME_LINE).unwrap();
    let root = dir.path();
    let repo = Repo::discover(root).unwrap();
    let (local, remote) = (commit(&repo, "local"), commit(&repo, "remote"));

    for run in supported_runs(&repo) {
        let before = untouched(root);
        let objects_before = text(root, &["count-objects", "-v"]);

        let merged = repo.merge_tree(&local, &remote, run, MERGE_TIMEOUT);

        assert_eq!(merged.unwrap(), MergeOutcome::Conflicts, "{run:?}");
        assert_eq!(untouched(root), before, "{run:?}");
        let objects_after = text(root, &["count-objects", "-v"]);
        match run {
            MergeTreeRun::Quiet => assert_eq!(objects_after, objects_before),
            MergeTreeRun::Writing => assert_ne!(objects_after, objects_before),
        }
    }
}

#[test]
fn a_merge_of_a_missing_commit_or_unrelated_histories_is_an_error_not_a_conflict() {
    let dir = diverged_repo(&SAME_LINE).unwrap();
    let root = dir.path();
    let unrelated = text(root, &["commit-tree", "-m", "unrelated", "main^{tree}"]);
    let unrelated = Oid::parse(unrelated.trim_end()).unwrap();
    let unknown = Oid::parse(UNKNOWN_ID).unwrap();
    let repo = Repo::discover(root).unwrap();
    let local = commit(&repo, "local");

    for run in supported_runs(&repo) {
        for other in [&unknown, &unrelated] {
            let merged = repo.merge_tree(&local, other, run, MERGE_TIMEOUT);

            assert!(
                matches!(merged, Err(Error::GitFailed { .. })),
                "{run:?} {other:?}: {merged:?}"
            );
        }
    }
}

#[test]
fn a_merge_past_its_deadline_is_a_timeout() {
    let dir = diverged_repo(&SAME_LINE).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();
    let (local, remote) = (commit(&repo, "local"), commit(&repo, "remote"));

    for run in supported_runs(&repo) {
        let merged = repo.merge_tree(&local, &remote, run, Duration::ZERO);

        assert!(
            matches!(merged, Err(Error::Timeout { .. })),
            "{run:?}: {merged:?}"
        );
    }
}

/// A repository with a remote `gitlab`, a bare clone of it holding merge-request heads.
struct Fixture {
    repo: TempDir,
    _server: TempDir,
    bare: PathBuf,
}

fn fixture() -> Fixture {
    let repo = diverged_repo(&SAME_LINE).unwrap();
    let server = tempfile::tempdir().unwrap();
    let bare = server.path().join("gitlab.git");
    let bare_path = bare.display().to_string();
    let root = repo.path().display().to_string();
    git_ok(server.path(), &["clone", "-q", "--bare", &root, &bare_path]).unwrap();
    git_ok(repo.path(), &["remote", "add", "gitlab", &bare_path]).unwrap();
    Fixture {
        repo,
        _server: server,
        bare,
    }
}

fn remote_ref(bare: &Path, name: &str) -> RemoteRef {
    let id = text(bare, &["rev-parse", name]);
    RemoteRef {
        name: name.as_bytes().to_vec(),
        id: Oid::parse(id.trim_end()).unwrap(),
    }
}

#[test]
fn remote_refs_lists_the_branch_and_merge_request_heads_of_a_bare_remote_and_writes_nothing() {
    let fixture = fixture();
    let (root, bare) = (fixture.repo.path(), &fixture.bare);
    git_ok(
        bare,
        &["update-ref", "refs/merge-requests/7/head", "remote"],
    )
    .unwrap();
    git_ok(bare, &["tag", "-a", "-m", "eight", "eight", "remote"]).unwrap();
    git_ok(bare, &["update-ref", "refs/merge-requests/8/head", "eight"]).unwrap();
    let expected = vec![
        remote_ref(bare, "refs/heads/main"),
        remote_ref(bare, "refs/merge-requests/7/head"),
        remote_ref(bare, "refs/merge-requests/8/head"),
    ];
    let before = untouched(root);
    let objects_before = text(root, &["count-objects", "-v"]);
    assert!(!root.join(".git/FETCH_HEAD").exists());

    let repo = Repo::discover(root).unwrap();
    let patterns = ["refs/heads/main", "refs/merge-requests/*/head"];
    let listed = repo.remote_refs("gitlab", &patterns, FETCH_TIMEOUT);

    assert_eq!(listed, Ok(expected));
    assert_eq!(untouched(root), before);
    assert_eq!(text(root, &["count-objects", "-v"]), objects_before);
    assert!(!root.join(".git/FETCH_HEAD").exists());
}

#[test]
fn remote_refs_of_an_unreachable_remote_gives_gits_first_line() {
    let fixture = fixture();
    let root = fixture.repo.path();
    let gone = fixture.bare.with_file_name("gone.git");
    let gone = gone.display().to_string();
    git_ok(root, &["remote", "add", "gone", &gone]).unwrap();
    let repo = Repo::discover(root).unwrap();

    let listed = repo.remote_refs("gone", &["refs/heads/main"], FETCH_TIMEOUT);

    assert_eq!(
        listed,
        Err(format!(
            "fatal: '{gone}' does not appear to be a git repository"
        ))
    );
}

#[cfg(unix)]
#[test]
fn remote_refs_runs_with_no_prompt_of_git_ssh_or_a_credential_manager() {
    let fixture = fixture();
    let root = fixture.repo.path();
    let recorded = root.join("ls-remote.env");
    let upload_pack = format!("env > '{}'; git-upload-pack", recorded.display());
    git_ok(root, &["config", "remote.gitlab.uploadpack", &upload_pack]).unwrap();
    let repo = Repo::discover(root).unwrap();

    repo.remote_refs("gitlab", &["refs/heads/main"], FETCH_TIMEOUT)
        .unwrap();

    let environment = std::fs::read_to_string(&recorded).unwrap();
    let lines: Vec<&str> = environment.lines().collect();
    for wanted in [
        "GIT_TERMINAL_PROMPT=0",
        "GCM_INTERACTIVE=never",
        "SSH_ASKPASS_REQUIRE=force",
        "SSH_ASKPASS=false",
        "LC_ALL=C",
    ] {
        assert!(lines.contains(&wanted), "{wanted} not in {environment}");
    }
}

#[test]
fn missing_commits_names_unknown_ids_and_non_commits_in_order() {
    let dir = diverged_repo(&SAME_LINE).unwrap();
    let root = dir.path();
    let tree = Oid::parse(text(root, &["rev-parse", "main^{tree}"]).trim_end()).unwrap();
    let unknown = Oid::parse(UNKNOWN_ID).unwrap();
    let repo = Repo::discover(root).unwrap();
    let (local, remote) = (commit(&repo, "local"), commit(&repo, "remote"));
    let ids = [local, unknown.clone(), remote, tree.clone()];

    let missing = repo.missing_commits(&ids);

    assert_eq!(missing.unwrap(), vec![unknown, tree]);
}

/// A blobless partial clone (`--filter=blob:none --no-checkout`, so it holds no blob) of a bare server; the
/// server's upload-pack leaves `contacted` behind, so any fetch from it, a lazy one too, shows.
struct PartialClone {
    clone: TempDir,
    _server: TempDir,
    bare: PathBuf,
    contacted: PathBuf,
}

fn partial_clone() -> PartialClone {
    let source = diverged_repo(&SAME_LINE).unwrap();
    let server = tempfile::tempdir().unwrap();
    let bare = server.path().join("gitlab.git");
    let bare_path = bare.display().to_string();
    let source_path = source.path().display().to_string();
    git_ok(
        server.path(),
        &["clone", "-q", "--bare", &source_path, &bare_path],
    )
    .unwrap();
    git_ok(&bare, &["config", "uploadpack.allowFilter", "true"]).unwrap();
    git_ok(&bare, &["config", "uploadpack.allowAnySHA1InWant", "true"]).unwrap();
    let clone = tempfile::tempdir().unwrap();
    let url = format!("file://{bare_path}");
    let into = clone.path().display().to_string();
    let blobless: [&str; 6] = [
        "clone",
        "-q",
        "--filter=blob:none",
        "--no-checkout",
        &url,
        &into,
    ];
    git_ok(server.path(), &blobless).unwrap();
    let contacted = server.path().join("contacted");
    let upload_pack = format!("touch '{}'; git-upload-pack", contacted.display());
    git_ok(
        clone.path(),
        &["config", "remote.origin.uploadpack", &upload_pack],
    )
    .unwrap();
    PartialClone {
        clone,
        _server: server,
        bare,
        contacted,
    }
}

#[test]
fn missing_commits_of_a_partial_clone_names_a_head_only_the_server_has_without_fetching_it() {
    let partial = partial_clone();
    let head = text(
        &partial.bare,
        &["commit-tree", "-p", "main", "-m", "head", "main^{tree}"],
    );
    let head = Oid::parse(head.trim_end()).unwrap();
    let repo = Repo::discover(partial.clone.path()).unwrap();
    let known = commit(&repo, "origin/local");

    let missing = repo.missing_commits(&[known, head.clone()]);

    assert_eq!(missing.unwrap(), vec![head]);
    assert!(!partial.contacted.exists());
}

#[test]
fn merge_tree_of_a_partial_clone_fails_on_a_blob_it_lacks_instead_of_fetching_it() {
    let partial = partial_clone();
    let repo = Repo::discover(partial.clone.path()).unwrap();
    let (local, remote) = (
        commit(&repo, "origin/local"),
        commit(&repo, "origin/remote"),
    );
    for run in supported_runs(&repo) {
        let merged = repo.merge_tree(&local, &remote, run, MERGE_TIMEOUT);

        assert!(
            matches!(merged, Err(Error::GitFailed { .. })),
            "{run:?}: {merged:?}"
        );
    }
    assert!(!partial.contacted.exists());
}

#[test]
fn blob_sizes_of_a_partial_clone_still_fetches_a_blob_it_lacks() {
    let partial = partial_clone();
    let blob = text(&partial.bare, &["rev-parse", "remote:a.txt"]);
    let blob = Oid::parse(blob.trim_end()).unwrap();
    let repo = Repo::discover(partial.clone.path()).unwrap();

    let sizes = repo.blob_sizes(&[blob]);

    assert_eq!(sizes.unwrap(), [Some(7)]);
    assert!(partial.contacted.exists());
}
