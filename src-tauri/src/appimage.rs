use std::ffi::OsString;
use std::path::PathBuf;

// The AppImage's AppRun changes into `$APPDIR/usr` and must stay there: linuxdeploy rewrites
// WebKitGTK's helper paths relative to it (`././/lib/webkit2gtk-4.1/WebKitNetworkProcess`). The
// AppImage runtime keeps the directory it was started in as `OWD` (AppImageKit `runtime.c`).
const APPIMAGE_VAR: &str = "APPIMAGE";
const START_DIR_VAR: &str = "OWD";

pub(crate) fn repo_from_start_dir(repo: PathBuf) -> PathBuf {
    resolved(
        repo,
        std::env::var_os(APPIMAGE_VAR),
        std::env::var_os(START_DIR_VAR),
    )
}

fn resolved(repo: PathBuf, appimage: Option<OsString>, start: Option<OsString>) -> PathBuf {
    match appimage.and(start) {
        Some(start) if repo.is_relative() => PathBuf::from(start).join(repo),
        Some(_) | None => repo,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const APPIMAGE: &str = "/home/u/yamt.AppImage";
    const START: &str = "/tmp/repo";

    #[test]
    fn an_appimage_resolves_a_relative_repo_from_where_it_was_started() {
        assert_eq!(
            resolved(".".into(), Some(APPIMAGE.into()), Some(START.into())),
            PathBuf::from("/tmp/repo/.")
        );
        assert_eq!(
            resolved("sub".into(), Some(APPIMAGE.into()), Some(START.into())),
            PathBuf::from("/tmp/repo/sub")
        );
    }

    #[test]
    fn an_absolute_repo_stays() {
        assert_eq!(
            resolved("/srv/r".into(), Some(APPIMAGE.into()), Some(START.into())),
            PathBuf::from("/srv/r")
        );
    }

    #[test]
    fn without_both_variables_the_repo_stays() {
        assert_eq!(
            resolved(".".into(), None, Some(START.into())),
            PathBuf::from(".")
        );
        assert_eq!(
            resolved(".".into(), Some(APPIMAGE.into()), None),
            PathBuf::from(".")
        );
    }
}
