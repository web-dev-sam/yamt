#![cfg(test)]

use std::path::Path;

use yamt_conflict_repo::{
    ConflictFile, FileKind, TempDir, diverged_repo, git_ok, run_ignored_in_child,
};
use yamt_merge_requests::{GitLabProject, gitlab_repository};

const CORP_REMOTE: &str = "git@git.corp.example:taskboard/taskboard.git";
const GITLAB_HOST_TEST: &str = "a_remote_on_the_host_glab_is_set_up_for_is_gitlab";
const FILES: [ConflictFile<'static>; 1] = [ConflictFile {
    path: "a.txt",
    kind: FileKind::Regular,
    base: Some(b"base\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];

fn repo_with_remotes(remotes: &[(&str, &str)]) -> TempDir {
    let dir = diverged_repo(&FILES).unwrap();
    for (name, url) in remotes {
        git_ok(dir.path(), &["remote", "add", name, url]).unwrap();
    }
    dir
}

fn common_dir(root: &Path) -> String {
    let args = ["rev-parse", "--path-format=absolute", "--git-common-dir"];
    let output = git_ok(root, &args).unwrap();
    String::from_utf8(output).unwrap().trim_end().to_owned()
}

fn project_of(folder: &Path) -> GitLabProject {
    gitlab_repository(folder).map_or(GitLabProject::None, |found| found.project())
}

#[test]
fn a_repository_with_any_remote_on_gitlab_is_found_from_a_subfolder() {
    let repo = repo_with_remotes(&[
        ("github", "https://github.com/taskboard/taskboard.git"),
        ("origin", "git@gitlab.example:taskboard/taskboard.git"),
    ]);
    let subfolder = repo.path().join("sub");
    std::fs::create_dir(&subfolder).unwrap();

    let found = gitlab_repository(&subfolder).unwrap();

    let repository = common_dir(repo.path());
    assert_eq!(found.project(), GitLabProject::Found { repository });
    assert_eq!(found.root(), repo.path());
}

#[test]
fn no_repository_no_remote_or_no_gitlab_remote_is_no_project() {
    let folder = tempfile::tempdir().unwrap();
    let bare = repo_with_remotes(&[]);
    let elsewhere = repo_with_remotes(&[
        ("origin", "https://github.com/taskboard/taskboard.git"),
        ("local", "/srv/git/gitlab.git"),
        ("corp", CORP_REMOTE),
    ]);

    for folder in [folder.path(), bare.path(), elsewhere.path()] {
        assert_eq!(
            project_of(folder),
            GitLabProject::None,
            "{}",
            folder.display()
        );
    }
}

#[test]
fn gitlab_host_and_gl_host_name_glab_s_server() {
    for (variable, value) in [
        ("GITLAB_HOST", "https://git.corp.example/"),
        ("GL_HOST", "GIT.corp.example"),
    ] {
        let ran = run_ignored_in_child(&[GITLAB_HOST_TEST], |child| {
            child
                .env_remove("GITLAB_HOST")
                .env_remove("GL_HOST")
                .env(variable, value);
        });
        ran.unwrap_or_else(|error| panic!("{variable}={value}: {error}"));
    }
}

#[test]
#[ignore = "run by gitlab_host_and_gl_host_name_glab_s_server"]
fn a_remote_on_the_host_glab_is_set_up_for_is_gitlab() {
    let repo = repo_with_remotes(&[("corp", CORP_REMOTE)]);

    let found = project_of(repo.path());

    let repository = common_dir(repo.path());
    assert_eq!(found, GitLabProject::Found { repository });
}
