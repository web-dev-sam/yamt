#![cfg(test)]
#![cfg(unix)]

#[expect(dead_code, reason = "these tests use part of the shared helpers")]
mod fake_glab;

use std::fs;
use std::sync::mpsc;

use yamt_conflict_repo::{TempDir, git_ok};
use yamt_merge_requests::{
    ImageKind, ListedPage, fetch_picture, gitlab_repository, list_merge_requests,
};

use fake_glab::{Fake, in_this_repository};

const GITLAB_REMOTE: &str = "https://gitlab.example/taskboard/taskboard.git";
const PICTURES: &str = "tests/glab/mr-row-details/pictures/uploads/-/system/user/avatar";

#[test]
fn a_listed_picture_is_fetched_through_glab_byte_for_byte() {
    let repo = TempDir::new().unwrap();
    git_ok(repo.path(), &["init", "-q"]).unwrap();
    git_ok(repo.path(), &["remote", "add", "origin", GITLAB_REMOTE]).unwrap();
    let repository = gitlab_repository(repo.path()).unwrap();
    let fake = Fake::new("mr-row-details");
    let (sender, sent) = mpsc::channel();
    list_merge_requests(&repository, Some(&fake.glab), &|listed: ListedPage| {
        sender.send(listed.pictures).unwrap();
    });
    let pictures = sent.recv().unwrap();

    let fetched: Vec<_> = pictures
        .iter()
        .map(|offered| fetch_picture(&fake.glab, repository.root(), &offered.address).unwrap())
        .collect();

    let expected = [
        fs::read(in_this_repository(&format!("{PICTURES}/2/avatar.png"))).unwrap(),
        fs::read(in_this_repository(&format!("{PICTURES}/1/avatar.png"))).unwrap(),
    ];
    assert!(
        expected[0].contains(&0),
        "the fixture holds a NUL byte, which printf would drop"
    );
    let bytes: Vec<&Vec<u8>> = fetched.iter().map(|picture| &picture.bytes).collect();
    assert_eq!(bytes, [&expected[0], &expected[1]]);
    assert!(fetched.iter().all(|picture| picture.kind == ImageKind::Png));
    let argv = fake.logged("argv: ");
    let asked: Vec<&String> = argv.iter().filter(|line| line.contains("://")).collect();
    let anna = "argv: api https://gitlab.example/uploads/-/system/user/avatar/2/avatar.png";
    let sam = "argv: api https://gitlab.example/uploads/-/system/user/avatar/1/avatar.png";
    assert_eq!(asked, [anna, sam]);
}
