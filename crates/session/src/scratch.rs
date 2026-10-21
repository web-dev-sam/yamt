use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::session::LOG_TARGET;

const SCRATCH_ATTEMPTS: u32 = 1000;
#[cfg(unix)]
const SCRATCH_MODE: u32 = 0o700;

/// A directory under the system temp directory, removed when dropped.
pub(crate) struct ScratchDir(pub(crate) PathBuf);

impl ScratchDir {
    pub(crate) fn create() -> io::Result<ScratchDir> {
        let temp = std::env::temp_dir();
        let process = std::process::id();
        for attempt in 0..SCRATCH_ATTEMPTS {
            let dir = temp.join(format!("yamt-merge-file-{process}-{attempt}"));
            match create_private_dir(&dir) {
                Ok(()) => return Ok(ScratchDir(dir)),
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
                Err(error) => return Err(error),
            }
        }
        Err(io::Error::from(io::ErrorKind::AlreadyExists))
    }
}

#[cfg(unix)]
fn create_private_dir(dir: &Path) -> io::Result<()> {
    use std::os::unix::fs::DirBuilderExt;
    fs::DirBuilder::new().mode(SCRATCH_MODE).create(dir)
}

// Windows: a new folder inherits the ACL of the user's temp folder, which only the user (and the
// system and administrators) may read.
#[cfg(not(unix))]
fn create_private_dir(dir: &Path) -> io::Result<()> {
    fs::create_dir(dir)
}

impl Drop for ScratchDir {
    fn drop(&mut self) {
        if let Err(error) = fs::remove_dir_all(&self.0) {
            let dir = self.0.display();
            tracing::warn!(target: LOG_TARGET, event = "scratch_not_removed", %dir, %error, "temporary merge inputs were left behind");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_scratch_dir_is_removed_when_dropped() {
        let scratch = ScratchDir::create().unwrap();
        let dir = scratch.0.clone();
        assert!(dir.is_dir());
        drop(scratch);
        assert!(!dir.exists());
    }

    #[cfg(unix)]
    #[test]
    fn the_scratch_dir_is_readable_by_its_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        const PERMISSION_BITS: u32 = 0o777;
        let scratch = ScratchDir::create().unwrap();
        let mode = fs::metadata(&scratch.0).unwrap().permissions().mode();
        assert_eq!(mode & PERMISSION_BITS, SCRATCH_MODE);
    }
}
