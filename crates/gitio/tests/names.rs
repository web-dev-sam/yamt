#![cfg(test)]

use std::fs;
use std::path::Path;

use yamt_conflict_repo::{ConflictFile, FileKind, diverged_repo, git_ok};
use yamt_gitio::{Error, Oid, RemoteUrl, Repo};

const FILES: [ConflictFile<'static>; 1] = [ConflictFile {
    path: "a.txt",
    kind: FileKind::Regular,
    base: Some(b"base\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];

fn oid_of(root: &Path, revision: &str) -> Oid {
    let output = git_ok(root, &["rev-parse", revision]).unwrap();
    Oid::parse(String::from_utf8(output).unwrap().trim_end()).unwrap()
}

#[test]
fn branch_names_from_heads_and_remote_tracking_and_none_for_a_commit_id() {
    let dir = diverged_repo(&FILES).unwrap();
    let root = dir.path();
    let repo = Repo::discover(root).unwrap();
    git_ok(
        root,
        &["update-ref", "refs/remotes/origin/feature", "remote"],
    )
    .unwrap();
    let remote_commit = oid_of(root, "remote");
    let name = |name: &str| repo.symbolic_full_name(name).unwrap();

    let named: [(&str, Option<&[u8]>); 5] = [
        ("remote", Some(b"refs/heads/remote")),
        ("origin/feature", Some(b"refs/remotes/origin/feature")),
        ("HEAD", Some(b"refs/heads/local")),
        (remote_commit.as_str(), None),
        ("remote~1", None),
    ];
    for (typed, expected) in named {
        assert_eq!(name(typed), expected.map(<[u8]>::to_vec), "{typed}");
    }
    let range = repo.symbolic_full_name("main...remote");
    assert!(matches!(range, Err(Error::GitFailed { .. })), "{range:?}");
    git_ok(root, &["checkout", "--quiet", "--detach"]).unwrap();
    assert_eq!(name("HEAD"), Some(b"HEAD".to_vec()));
}

#[test]
fn remote_names_lists_every_remote() {
    let dir = diverged_repo(&FILES).unwrap();
    let root = dir.path();
    let repo = Repo::discover(root).unwrap();
    assert_eq!(repo.remote_names().unwrap(), Vec::<Vec<u8>>::new());

    for remote in ["upstream", "origin", "fork"] {
        let url = format!("https://gitlab.example/{remote}.git");
        git_ok(root, &["remote", "add", remote, &url]).unwrap();
    }

    let expected: [&[u8]; 3] = [b"fork", b"origin", b"upstream"];
    assert_eq!(repo.remote_names().unwrap(), expected);
}

#[test]
fn remote_urls_are_in_config_order_none_without_remotes_and_an_error_on_a_broken_config() {
    let dir = diverged_repo(&FILES).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();
    assert_eq!(repo.remote_urls().unwrap(), []);
    let remotes = [
        ("upstream", "git@gitlab.example:a/b.git"),
        ("fork", "https://gitlab.example/c/b"),
    ];

    for (name, url) in remotes {
        git_ok(dir.path(), &["remote", "add", name, url]).unwrap();
    }

    let expected = remotes.map(|(name, url)| RemoteUrl {
        name: name.as_bytes().to_vec(),
        url: url.as_bytes().to_vec(),
    });
    assert_eq!(repo.remote_urls().unwrap(), expected);
    fs::write(dir.path().join(".git/config"), "[remote \"broken\"\n").unwrap();
    let broken = repo.remote_urls();
    assert!(matches!(broken, Err(Error::GitFailed { .. })), "{broken:?}");
}
