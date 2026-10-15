#![cfg(test)]

use std::fs;

use yamt_lsp_host::{Host, ProgramFolders, ProgramFound, ProjectFile};

const TEXT_LIMIT: usize = 64 * 1024;

#[test]
fn project_files_answers_each_path_in_order() {
    let repo = tempfile::tempdir().unwrap();
    let root = repo.path().join("repo");
    fs::create_dir_all(root.join("frontend")).unwrap();
    fs::write(root.join("frontend/package.json"), "{\"name\":\"é\"}").unwrap();
    fs::write(root.join("at-limit"), "a".repeat(TEXT_LIMIT)).unwrap();
    fs::write(root.join("above-limit"), "a".repeat(TEXT_LIMIT + 1)).unwrap();
    fs::write(root.join("binary"), b"\xff\xfe").unwrap();
    fs::write(repo.path().join("outside.json"), "{}").unwrap();
    let host = Host::new(&root);
    let paths = [
        "frontend/package.json",
        "frontend",
        "",
        "missing.json",
        "at-limit",
        "above-limit",
        "binary",
        "../outside.json",
        "frontend/../../outside.json",
    ];
    let paths: Vec<String> = paths.iter().map(|path| (*path).to_owned()).collect();
    let expected = vec![
        ProjectFile::Text {
            text: "{\"name\":\"é\"}".to_owned(),
        },
        ProjectFile::Folder,
        ProjectFile::Folder,
        ProjectFile::Missing,
        ProjectFile::Text {
            text: "a".repeat(TEXT_LIMIT),
        },
        ProjectFile::TooLarge,
        ProjectFile::NotText,
        ProjectFile::Missing,
        ProjectFile::Missing,
    ];
    assert_eq!(host.project_files(&paths), expected);
}

#[cfg(unix)]
#[test]
fn a_file_reached_through_a_link_out_of_the_repository_is_missing() {
    let repo = tempfile::tempdir().unwrap();
    let root = repo.path().join("repo");
    fs::create_dir_all(&root).unwrap();
    fs::write(repo.path().join("secret.json"), "{}").unwrap();
    std::os::unix::fs::symlink("../secret.json", root.join("link.json")).unwrap();
    fs::write(root.join("real.json"), "{}").unwrap();
    std::os::unix::fs::symlink("real.json", root.join("inside.json")).unwrap();
    let host = Host::new(&root);
    let paths = vec!["link.json".to_owned(), "inside.json".to_owned()];
    let text = ProjectFile::Text {
        text: "{}".to_owned(),
    };
    assert_eq!(host.project_files(&paths), vec![ProjectFile::Missing, text]);
}

#[test]
fn find_program_searches_nothing_for_a_project_outside_the_repository() {
    let repo = tempfile::tempdir().unwrap();
    let host = Host::new(repo.path());
    assert_eq!(
        host.find_program("tool", "../elsewhere", &ProgramFolders::default()),
        ProgramFound::NotFound {
            searched: Vec::new()
        }
    );
}
