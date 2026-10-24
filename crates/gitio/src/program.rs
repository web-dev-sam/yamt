use std::ffi::OsStr;
use std::path::{Path, PathBuf};

/// The first absolute folder of `search_path` holding a runnable `name` (`name.exe` on Windows).
pub(crate) fn program_in(search_path: &OsStr, name: &str) -> Option<PathBuf> {
    let file_name = format!("{name}{}", std::env::consts::EXE_SUFFIX);
    std::env::split_paths(search_path)
        .filter(|dir| dir.is_absolute())
        .map(|dir| dir.join(&file_name))
        .find(|candidate| is_runnable(candidate))
}

#[cfg(unix)]
fn is_runnable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    const ANY_EXECUTE_BIT: u32 = 0o111;
    path.metadata().is_ok_and(|metadata| {
        metadata.is_file() && metadata.permissions().mode() & ANY_EXECUTE_BIT != 0
    })
}

// Windows has no execute bit: the `.exe` name is what makes a file runnable.
#[cfg(not(unix))]
fn is_runnable(path: &Path) -> bool {
    path.is_file()
}

#[cfg(test)]
mod tests {
    use std::ffi::OsString;
    use std::fs;

    use super::*;

    const GIT: &str = "git";

    fn search_path(dirs: &[&Path]) -> OsString {
        std::env::join_paths(dirs).unwrap()
    }

    fn program_file(dir: &Path, name: &str) -> PathBuf {
        dir.join(format!("{name}{}", std::env::consts::EXE_SUFFIX))
    }

    #[cfg(unix)]
    fn runnable_program_in(dir: &Path, name: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;
        let program = program_file(dir, name);
        fs::write(&program, "").unwrap();
        fs::set_permissions(&program, fs::Permissions::from_mode(0o755)).unwrap();
        program
    }

    #[cfg(not(unix))]
    fn runnable_program_in(dir: &Path, name: &str) -> PathBuf {
        let program = program_file(dir, name);
        fs::write(&program, "").unwrap();
        program
    }

    #[test]
    fn a_relative_path_entry_is_skipped_and_the_same_folder_found_by_its_absolute_path() {
        let dir = tempfile::tempdir_in(".").unwrap();
        runnable_program_in(dir.path(), GIT);
        let name = dir.path().file_name().unwrap();
        let (relative, absolute) = (Path::new(name), std::env::current_dir().unwrap().join(name));
        assert_eq!(program_in(&search_path(&[relative]), GIT), None);
        let found = program_in(&search_path(&[relative, &absolute]), GIT);
        assert_eq!(found, Some(program_file(&absolute, GIT)));
    }

    #[test]
    fn only_the_program_named_is_found() {
        let (with_git, with_glab) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
        runnable_program_in(with_git.path(), GIT);
        let glab = runnable_program_in(with_glab.path(), "glab");
        let both = search_path(&[with_git.path(), with_glab.path()]);

        assert_eq!(program_in(&both, "glab"), Some(glab));
        assert_eq!(program_in(&search_path(&[with_git.path()]), "glab"), None);
    }

    #[cfg(unix)]
    #[test]
    fn a_git_without_an_execute_bit_is_skipped_and_the_next_executable_one_found() {
        use std::os::unix::fs::PermissionsExt;
        let (plain, runnable) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
        let not_executable = plain.path().join("git");
        fs::write(&not_executable, "").unwrap();
        fs::set_permissions(&not_executable, fs::Permissions::from_mode(0o644)).unwrap();
        let git = runnable_program_in(runnable.path(), GIT);
        assert_eq!(
            program_in(&search_path(&[plain.path(), runnable.path()]), GIT),
            Some(git)
        );
    }

    #[cfg(not(unix))]
    #[test]
    fn a_git_without_the_exe_name_is_skipped_and_the_next_git_exe_found() {
        let (plain, runnable) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
        fs::write(plain.path().join("git"), "").unwrap();
        let git = runnable_program_in(runnable.path(), GIT);
        assert_eq!(
            program_in(&search_path(&[plain.path(), runnable.path()]), GIT),
            Some(git)
        );
    }
}
