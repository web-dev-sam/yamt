use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitStatus;

use crate::repo::Repo;
use crate::run::{Access, GIT_TIMEOUT, run_accepting};
use crate::{Error, Result};

// git-merge-file(1): "The exit value of this program is negative on error, and the number of
// conflicts otherwise (truncated to 127 if there are more than that many conflicts)."
const FIRST_ERROR_STATUS: i32 = 128;

/// The label `merge_file` writes after the open marker of every conflict.
pub const OURS_LABEL: &str = "ours";
const BASE_LABEL: &str = "base";
/// The label `merge_file` writes after the close marker of every conflict.
pub const THEIRS_LABEL: &str = "theirs";

/// How `git merge-file` merges: marker length, `--union`, and `--diff-algorithm=histogram`.
#[derive(Clone, Copy, Debug)]
pub struct MergeFileOptions {
    pub marker_size: usize,
    pub union: bool,
    pub histogram: bool,
}

impl Repo {
    /// git's merge of `base`, `local` and `remote`, written with the labels `OURS_LABEL`,
    /// `BASE_LABEL` and `THEIRS_LABEL`; the three inputs are written to files in `scratch`, an
    /// existing directory the caller removes.
    pub fn merge_file(
        &self,
        scratch: &Path,
        base: &[u8],
        local: &[u8],
        remote: &[u8],
        options: &MergeFileOptions,
    ) -> Result<Vec<u8>> {
        let local = write_input(scratch, "local", local)?;
        let base = write_input(scratch, "base", base)?;
        let remote = write_input(scratch, "remote", remote)?;
        let marker_size = format!("--marker-size={}", options.marker_size);
        let mut args = vec!["merge-file", "-p", "-q", marker_size.as_str()];
        if options.union {
            args.push("--union");
        }
        if options.histogram {
            args.push("--diff-algorithm=histogram");
        }
        args.extend(["-L", OURS_LABEL, "-L", BASE_LABEL, "-L", THEIRS_LABEL, "--"]);
        let mut command = self.command(Access::Read, &args);
        command.args([&local, &base, &remote]);
        run_accepting(command, None, GIT_TIMEOUT, is_conflict_count)
    }
}

fn is_conflict_count(status: ExitStatus) -> bool {
    status
        .code()
        .is_some_and(|code| (0..FIRST_ERROR_STATUS).contains(&code))
}

fn write_input(scratch: &Path, name: &str, bytes: &[u8]) -> Result<PathBuf> {
    let path = scratch.join(name);
    fs::write(&path, bytes).map_err(|source| Error::WriteFailed {
        path: path.clone(),
        source,
    })?;
    Ok(path)
}
