use std::env;
#[cfg(windows)]
use std::ffi::OsStr;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::files;

#[cfg(unix)]
const EXECUTE_BITS: u32 = 0o111;
/// Windows' own value when `PATHEXT` is not set (`cmd.exe` documentation, "PATHEXT").
#[cfg(windows)]
const DEFAULT_PATHEXT: &str = ".COM;.EXE;.BAT;.CMD";

/// Folders a server's program is looked for in besides PATH (plan §2 #72). Each entry is a relative path of plain
/// names separated by `/` (`node_modules/.bin`, `.venv/Scripts`, `go/bin`); an entry that is empty, absolute,
/// holds `..` or `.`, or has an empty name (`go/bin/`, `a//b`) is skipped.
#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize, specta::Type)]
pub struct ProgramFolders {
    /// Tried in the project folder, then each parent up to the repository root; within one folder in list order.
    pub project: Vec<String>,
    /// Tried after every PATH entry, relative to the user's home folder.
    pub home: Vec<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, specta::Type)]
pub enum ProgramPlace {
    Project,
    Path,
    Home,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, specta::Type)]
#[serde(tag = "kind")]
pub enum ProgramFound {
    Found { path: String, place: ProgramPlace },
    NotFound { searched: Vec<String> },
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct Found {
    pub(crate) path: PathBuf,
    pub(crate) place: ProgramPlace,
}

/// The program a server command names, seen from `project` (a folder inside `root`); `Err` lists
/// every folder searched, in order.
pub(crate) fn find(
    root: &Path,
    project: &Path,
    program: &str,
    folders: &ProgramFolders,
) -> Result<Found, Vec<PathBuf>> {
    let environment = Environment {
        path_variable: env::var_os("PATH"),
        home: env::home_dir(),
    };
    find_with(root, project, program, folders, &environment)
}

/// What the lookup reads from the user's environment; tests give their own.
struct Environment {
    path_variable: Option<OsString>,
    home: Option<PathBuf>,
}

fn find_with(
    root: &Path,
    project: &Path,
    program: &str,
    folders: &ProgramFolders,
    environment: &Environment,
) -> Result<Found, Vec<PathBuf>> {
    if program.contains('/') || program.contains(std::path::MAIN_SEPARATOR) {
        let candidate = project.join(program);
        let folder = candidate.parent().unwrap_or(project).to_owned();
        return match runnable(&candidate) {
            Some(path) => Ok(Found {
                path,
                place: ProgramPlace::Project,
            }),
            None => Err(vec![folder]),
        };
    }
    let mut searched = Vec::new();
    for (folder, place) in search_order(root, project, folders, environment) {
        if let Some(path) = runnable(&folder.join(program)) {
            return Ok(Found { path, place });
        }
        searched.push(folder);
    }
    Err(searched)
}

/// The project entries in `project` and each parent up to `root`, then each `PATH` entry, then
/// the home entries in the home folder.
fn search_order(
    root: &Path,
    project: &Path,
    folders: &ProgramFolders,
    environment: &Environment,
) -> Vec<(PathBuf, ProgramPlace)> {
    let project_entries = relative_folders(&folders.project);
    let mut order = Vec::new();
    for folder in project.ancestors() {
        for entry in &project_entries {
            order.push((folder.join(entry), ProgramPlace::Project));
        }
        if folder == root {
            break;
        }
    }
    let path_folders = environment.path_variable.iter().flat_map(env::split_paths);
    for folder in path_folders {
        order.push((folder, ProgramPlace::Path));
    }
    if let Some(home) = &environment.home {
        for entry in relative_folders(&folders.home) {
            order.push((home.join(entry), ProgramPlace::Home));
        }
    }
    order
}

fn relative_folders(entries: &[String]) -> Vec<PathBuf> {
    entries
        .iter()
        .filter_map(|entry| relative_folder(entry))
        .collect()
}

/// `entry`'s `/`-separated plain names as a relative path; `None` when one is not a plain name.
fn relative_folder(entry: &str) -> Option<PathBuf> {
    let mut folder = PathBuf::new();
    for segment in entry.split('/') {
        folder.push(files::plain_name(segment)?);
    }
    Some(folder)
}

#[cfg(unix)]
fn runnable(candidate: &Path) -> Option<PathBuf> {
    use std::os::unix::fs::PermissionsExt;

    let metadata = fs::metadata(candidate).ok()?;
    let executable = metadata.permissions().mode() & EXECUTE_BITS != 0;
    (metadata.is_file() && executable).then(|| candidate.to_owned())
}

#[cfg(windows)]
fn runnable(candidate: &Path) -> Option<PathBuf> {
    let pathext = env::var_os("PATHEXT").unwrap_or_else(|| OsString::from(DEFAULT_PATHEXT));
    windows_candidates(candidate, &pathext)
        .into_iter()
        .find(|path| fs::metadata(path).is_ok_and(|metadata| metadata.is_file()))
}

/// The candidate itself when its extension is one of `PATHEXT`'s, otherwise the candidate with
/// each of them appended: Windows runs no file without one.
#[cfg(windows)]
fn windows_candidates(candidate: &Path, pathext: &OsStr) -> Vec<PathBuf> {
    let pathext = pathext.to_string_lossy().to_ascii_lowercase();
    let extensions: Vec<&str> = pathext.split(';').filter(|ext| !ext.is_empty()).collect();
    let own = candidate
        .extension()
        .map(|ext| format!(".{}", ext.to_string_lossy().to_ascii_lowercase()));
    if own.is_some_and(|own| extensions.contains(&own.as_str())) {
        return vec![candidate.to_owned()];
    }
    let mut candidates = Vec::new();
    for extension in extensions {
        let mut name = candidate.as_os_str().to_owned();
        name.push(extension);
        candidates.push(PathBuf::from(name));
    }
    candidates
}

#[cfg(test)]
mod tests {
    use tempfile::TempDir;

    use super::*;

    struct Tree {
        dir: TempDir,
    }

    impl Tree {
        fn new() -> Tree {
            let tree = Tree {
                dir: tempfile::tempdir().unwrap(),
            };
            fs::create_dir_all(tree.project()).unwrap();
            tree
        }

        fn root(&self) -> PathBuf {
            self.dir.path().join("repo")
        }

        fn project(&self) -> PathBuf {
            self.root().join("frontend").join("app")
        }

        fn path_folder(&self, name: &str) -> PathBuf {
            self.dir.path().join(name)
        }

        fn home(&self) -> PathBuf {
            self.dir.path().join("home")
        }

        fn environment(&self, path_names: &[&str], home: Option<PathBuf>) -> Environment {
            let folders = path_names.iter().map(|name| self.path_folder(name));
            Environment {
                path_variable: Some(env::join_paths(folders).unwrap()),
                home,
            }
        }

        fn find(&self, program: &str, path_names: &[&str]) -> Result<Found, Vec<PathBuf>> {
            let folders = program_folders(&["node_modules/.bin"], &["go/bin"]);
            self.find_in(program, &folders, path_names)
        }

        fn find_in(
            &self,
            program: &str,
            folders: &ProgramFolders,
            path_names: &[&str],
        ) -> Result<Found, Vec<PathBuf>> {
            let environment = self.environment(path_names, Some(self.home()));
            find_with(
                &self.root(),
                &self.project(),
                program,
                folders,
                &environment,
            )
        }
    }

    fn program_folders(project: &[&str], home: &[&str]) -> ProgramFolders {
        let texts = |entries: &[&str]| entries.iter().map(|entry| (*entry).to_owned()).collect();
        ProgramFolders {
            project: texts(project),
            home: texts(home),
        }
    }

    /// The file a lookup finds for `name` in `folder`: on Windows a `.cmd` beside it.
    fn put_program(folder: &Path, name: &str) -> PathBuf {
        fs::create_dir_all(folder).unwrap();
        let path = folder.join(program_file_name(name));
        fs::write(&path, "#!/bin/sh\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        }
        path
    }

    fn program_file_name(name: &str) -> String {
        if cfg!(windows) {
            format!("{name}.cmd")
        } else {
            name.to_owned()
        }
    }

    fn bin(folder: &Path) -> PathBuf {
        folder.join("node_modules").join(".bin")
    }

    fn found(path: PathBuf, place: ProgramPlace) -> Found {
        Found { path, place }
    }

    #[test]
    fn the_project_s_own_bin_folder_wins_over_its_parents_and_path() {
        let tree = Tree::new();
        let own = put_program(&bin(&tree.project()), "tool");
        put_program(&bin(&tree.root()), "tool");
        put_program(&tree.path_folder("p1"), "tool");
        assert_eq!(
            tree.find("tool", &["p1"]),
            Ok(found(own, ProgramPlace::Project))
        );
    }

    #[test]
    fn a_parent_s_bin_folder_up_to_the_root_comes_before_path() {
        let tree = Tree::new();
        let at_root = put_program(&bin(&tree.root()), "tool");
        put_program(&tree.path_folder("p1"), "tool");
        assert_eq!(
            tree.find("tool", &["p1"]),
            Ok(found(at_root, ProgramPlace::Project))
        );
    }

    #[test]
    fn path_entries_are_searched_in_their_order() {
        let tree = Tree::new();
        let second = put_program(&tree.path_folder("p2"), "tool");
        put_program(&tree.path_folder("p3"), "tool");
        assert_eq!(
            tree.find("tool", &["p1", "p2", "p3"]),
            Ok(found(second, ProgramPlace::Path))
        );
    }

    #[test]
    fn not_found_lists_every_folder_searched_in_order() {
        let tree = Tree::new();
        let folders = program_folders(&["a", "b/bin"], &["go/bin", ".local/bin"]);
        let searched = vec![
            tree.project().join("a"),
            tree.project().join("b").join("bin"),
            tree.root().join("frontend").join("a"),
            tree.root().join("frontend").join("b").join("bin"),
            tree.root().join("a"),
            tree.root().join("b").join("bin"),
            tree.path_folder("p1"),
            tree.path_folder("p2"),
            tree.home().join("go").join("bin"),
            tree.home().join(".local").join("bin"),
        ];
        assert_eq!(tree.find_in("tool", &folders, &["p1", "p2"]), Err(searched));
    }

    #[test]
    fn nothing_above_the_root_is_searched() {
        let tree = Tree::new();
        put_program(&bin(tree.dir.path()), "tool");
        let Err(searched) = tree.find("tool", &[]) else {
            panic!("found above the root");
        };
        assert!(!searched.contains(&bin(tree.dir.path())));
    }

    #[test]
    fn two_project_entries_in_one_folder_are_tried_in_list_order() {
        let tree = Tree::new();
        let folders = program_folders(&[".venv/bin", "vendor/bin"], &[]);
        let in_vendor = put_program(&tree.project().join("vendor").join("bin"), "tool");
        put_program(&tree.root().join(".venv").join("bin"), "tool");
        assert_eq!(
            tree.find_in("tool", &folders, &[]),
            Ok(found(in_vendor.clone(), ProgramPlace::Project))
        );
        let in_venv = put_program(&tree.project().join(".venv").join("bin"), "tool");
        assert_eq!(
            tree.find_in("tool", &folders, &[]),
            Ok(found(in_venv, ProgramPlace::Project))
        );
    }

    #[test]
    fn a_home_entry_is_found_after_path_with_place_home() {
        let tree = Tree::new();
        let in_home = put_program(&tree.home().join("go").join("bin"), "tool");
        assert_eq!(
            tree.find("tool", &["p1"]),
            Ok(found(in_home, ProgramPlace::Home))
        );
    }

    #[test]
    fn path_beats_home() {
        let tree = Tree::new();
        put_program(&tree.home().join("go").join("bin"), "tool");
        let on_path = put_program(&tree.path_folder("p1"), "tool");
        assert_eq!(
            tree.find("tool", &["p1"]),
            Ok(found(on_path, ProgramPlace::Path))
        );
    }

    #[test]
    fn empty_absolute_and_dotted_entries_are_never_searched() {
        let tree = Tree::new();
        let bad = ["", "/abs", "a/../b", "./x", "a//b"];
        let folders = program_folders(&bad, &bad);
        for folder in [tree.project().join("b"), tree.project().join("x")] {
            put_program(&folder, "tool");
        }
        put_program(&tree.home().join("b"), "tool");
        let searched = vec![tree.path_folder("p1")];
        assert_eq!(tree.find_in("tool", &folders, &["p1"]), Err(searched));
    }

    #[test]
    fn without_a_home_folder_home_entries_are_skipped() {
        let tree = Tree::new();
        put_program(&tree.home().join("go").join("bin"), "tool");
        let folders = program_folders(&[], &["go/bin"]);
        let environment = tree.environment(&["p1"], None);
        let found = find_with(
            &tree.root(),
            &tree.project(),
            "tool",
            &folders,
            &environment,
        );
        assert_eq!(found, Err(vec![tree.path_folder("p1")]));
    }

    #[test]
    fn a_program_with_a_separator_is_taken_relative_to_the_project_only() {
        let tree = Tree::new();
        let relative = put_program(&tree.project().join("bin"), "tool");
        put_program(&tree.path_folder("p1"), "tool");
        let program = format!("bin/{}", program_file_name("tool"));
        assert_eq!(
            tree.find(&program, &["p1"]),
            Ok(found(relative, ProgramPlace::Project))
        );
        let missing = tree.find("other/tool", &["p1"]);
        assert_eq!(missing, Err(vec![tree.project().join("other")]));
    }

    #[cfg(unix)]
    #[test]
    fn a_file_without_execute_permission_is_not_a_program() {
        use std::os::unix::fs::PermissionsExt;

        let tree = Tree::new();
        let plain = put_program(&bin(&tree.project()), "tool");
        fs::set_permissions(&plain, fs::Permissions::from_mode(0o644)).unwrap();
        let on_path = put_program(&tree.path_folder("p1"), "tool");
        assert_eq!(
            tree.find("tool", &["p1"]),
            Ok(found(on_path, ProgramPlace::Path))
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_tries_each_pathext_extension_unless_the_name_has_one() {
        let pathext = OsStr::new(".COM;.CMD;;");
        let candidate = Path::new(r"C:\bin\tool");
        let expected = vec![
            PathBuf::from(r"C:\bin\tool.com"),
            PathBuf::from(r"C:\bin\tool.cmd"),
        ];
        assert_eq!(windows_candidates(candidate, pathext), expected);
        let named = Path::new(r"C:\bin\tool.Cmd");
        assert_eq!(windows_candidates(named, pathext), vec![named.to_owned()]);
        let other = Path::new(r"C:\bin\tool.js");
        assert_eq!(windows_candidates(other, pathext).len(), 2);
    }

    #[cfg(windows)]
    #[test]
    fn windows_skips_a_file_without_an_extension() {
        let tree = Tree::new();
        let bare = bin(&tree.project()).join("tool");
        fs::create_dir_all(bare.parent().unwrap()).unwrap();
        fs::write(&bare, "#!/bin/sh\n").unwrap();
        let on_path = put_program(&tree.path_folder("p1"), "tool");
        assert_eq!(
            tree.find("tool", &["p1"]),
            Ok(found(on_path, ProgramPlace::Path))
        );
    }
}
