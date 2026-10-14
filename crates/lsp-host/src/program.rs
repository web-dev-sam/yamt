use std::env;
use std::ffi::OsStr;
#[cfg(windows)]
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

const BIN_FOLDER: [&str; 2] = ["node_modules", ".bin"];
#[cfg(unix)]
const EXECUTE_BITS: u32 = 0o111;
/// Windows' own value when `PATHEXT` is not set (`cmd.exe` documentation, "PATHEXT").
#[cfg(windows)]
const DEFAULT_PATHEXT: &str = ".COM;.EXE;.BAT;.CMD";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, specta::Type)]
pub enum ProgramPlace {
    Project,
    Path,
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
pub(crate) fn find(root: &Path, project: &Path, program: &str) -> Result<Found, Vec<PathBuf>> {
    find_with_path(root, project, program, env::var_os("PATH").as_deref())
}

fn find_with_path(
    root: &Path,
    project: &Path,
    program: &str,
    path_variable: Option<&OsStr>,
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
    for (folder, place) in folders(root, project, path_variable) {
        if let Some(path) = runnable(&folder.join(program)) {
            return Ok(Found { path, place });
        }
        searched.push(folder);
    }
    Err(searched)
}

/// `node_modules/.bin` in `project` and each parent up to `root`, then each `PATH` entry.
fn folders(
    root: &Path,
    project: &Path,
    path_variable: Option<&OsStr>,
) -> Vec<(PathBuf, ProgramPlace)> {
    let mut folders = Vec::new();
    for folder in project.ancestors() {
        folders.push((
            folder.join(BIN_FOLDER.iter().collect::<PathBuf>()),
            ProgramPlace::Project,
        ));
        if folder == root {
            break;
        }
    }
    for folder in path_variable.map(env::split_paths).into_iter().flatten() {
        folders.push((folder, ProgramPlace::Path));
    }
    folders
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
    use std::ffi::OsString;

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

        fn path_variable(&self, names: &[&str]) -> OsString {
            let folders = names.iter().map(|name| self.path_folder(name));
            env::join_paths(folders).unwrap()
        }

        fn find(&self, program: &str, path_names: &[&str]) -> Result<Found, Vec<PathBuf>> {
            let path_variable = self.path_variable(path_names);
            find_with_path(&self.root(), &self.project(), program, Some(&path_variable))
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
    fn not_found_lists_every_folder_searched_in_order_and_stops_at_the_root() {
        let tree = Tree::new();
        put_program(&bin(tree.dir.path()), "tool");
        let searched = vec![
            bin(&tree.project()),
            bin(&tree.root().join("frontend")),
            bin(&tree.root()),
            tree.path_folder("p1"),
            tree.path_folder("p2"),
        ];
        assert_eq!(tree.find("tool", &["p1", "p2"]), Err(searched));
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
