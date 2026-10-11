use std::ffi::OsString;
use std::path::PathBuf;

// The AppImage's AppRun changes into `$APPDIR/usr` and must stay there: linuxdeploy rewrites
// WebKitGTK's helper paths relative to it (`././/lib/webkit2gtk-4.1/WebKitNetworkProcess`). The
// AppImage runtime sets `APPIMAGE`, `APPDIR` and keeps the directory it was started in as `OWD`
// (AppImageKit `runtime.c`); child processes inherit all three, so only a binary under `APPDIR`
// is the AppImage itself.
const APPIMAGE_VAR: &str = "APPIMAGE";
const APPDIR_VAR: &str = "APPDIR";
const START_DIR_VAR: &str = "OWD";

pub(crate) fn repo_from_start_dir(repo: PathBuf) -> PathBuf {
    let inside_appimage = is_inside_appimage(
        std::env::var_os(APPIMAGE_VAR).is_some(),
        std::env::var_os(APPDIR_VAR).map(PathBuf::from),
        std::env::current_exe().ok(),
    );
    resolved(repo, inside_appimage, std::env::var_os(START_DIR_VAR))
}

fn is_inside_appimage(appimage_set: bool, appdir: Option<PathBuf>, exe: Option<PathBuf>) -> bool {
    let (Some(appdir), Some(exe)) = (appdir, exe) else {
        return false;
    };
    appimage_set && exe.starts_with(appdir)
}

fn resolved(repo: PathBuf, inside_appimage: bool, start: Option<OsString>) -> PathBuf {
    match start.map(PathBuf::from) {
        Some(start) if inside_appimage && start.is_absolute() && repo.is_relative() => {
            start.join(repo)
        }
        Some(_) | None => repo,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const APPDIR: &str = "/tmp/.mount_yamtAbC";
    const EXE_IN_APPDIR: &str = "/tmp/.mount_yamtAbC/usr/bin/yamt";
    const EXE_ELSEWHERE: &str = "/usr/bin/yamt";
    const START: &str = "/tmp/repo";

    #[test]
    fn an_appimage_resolves_a_relative_repo_from_where_it_was_started() {
        assert_eq!(
            resolved(".".into(), true, Some(START.into())),
            PathBuf::from("/tmp/repo/.")
        );
        assert_eq!(
            resolved("sub".into(), true, Some(START.into())),
            PathBuf::from("/tmp/repo/sub")
        );
    }

    #[test]
    fn an_absolute_repo_stays() {
        assert_eq!(
            resolved("/srv/r".into(), true, Some(START.into())),
            PathBuf::from("/srv/r")
        );
    }

    #[test]
    fn outside_an_appimage_or_without_a_start_dir_the_repo_stays() {
        assert_eq!(
            resolved(".".into(), false, Some(START.into())),
            PathBuf::from(".")
        );
        assert_eq!(resolved(".".into(), true, None), PathBuf::from("."));
    }

    #[test]
    fn an_empty_or_relative_start_dir_is_ignored() {
        assert_eq!(
            resolved(".".into(), true, Some("".into())),
            PathBuf::from(".")
        );
        assert_eq!(
            resolved(".".into(), true, Some("tmp/repo".into())),
            PathBuf::from(".")
        );
    }

    #[test]
    fn only_a_binary_under_appdir_with_appimage_set_is_inside_the_appimage() {
        assert!(is_inside_appimage(
            true,
            Some(APPDIR.into()),
            Some(EXE_IN_APPDIR.into())
        ));
        assert!(!is_inside_appimage(
            false,
            Some(APPDIR.into()),
            Some(EXE_IN_APPDIR.into())
        ));
        assert!(!is_inside_appimage(true, None, Some(EXE_IN_APPDIR.into())));
        assert!(!is_inside_appimage(true, Some(APPDIR.into()), None));
    }

    #[test]
    fn inherited_variables_with_the_binary_outside_appdir_keep_the_repo_as_given() {
        let inside = is_inside_appimage(true, Some(APPDIR.into()), Some(EXE_ELSEWHERE.into()));
        assert!(!inside);
        assert_eq!(
            resolved(".".into(), inside, Some(START.into())),
            PathBuf::from(".")
        );
    }
}
