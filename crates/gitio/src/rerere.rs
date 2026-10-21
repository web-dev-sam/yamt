use std::path::PathBuf;
use std::process::ExitStatus;

use crate::entry::path_from_git;
use crate::repo::{Repo, read_if_present};
use crate::run::{Access, GIT_TIMEOUT, run_accepting};
use crate::{Error, Result};

const MERGE_RR: &str = "MERGE_RR";
const RR_CACHE: &str = "rr-cache";
const ENABLED_ARGS: [&str; 4] = ["config", "--type=bool", "--get", "rerere.enabled"];
// git-config(1): `--get` exits with 1 when the key is not set.
const UNSET_STATUS: i32 = 1;

impl Repo {
    /// The paths rerere still tracks (`MERGE_RR` through `--git-path`, records `<id>[.<n>]\t<path>\0`); None when
    /// rerere is not enabled, or there is no `MERGE_RR` (nothing recorded at this stop).
    pub fn rerere_tracked(&self) -> Result<Option<Vec<PathBuf>>> {
        let [merge_rr, rr_cache] = self.git_paths([MERGE_RR, RR_CACHE])?;
        // rerere.c `is_rerere_enabled`: `rerere.enabled`, or when unset whether `rr-cache` is a directory.
        let enabled = match self.rerere_enabled()? {
            Some(enabled) => enabled,
            None => rr_cache.is_dir(),
        };
        if !enabled {
            return Ok(None);
        }
        match read_if_present(&merge_rr)? {
            Some(records) => tracked_paths(&records).map(Some),
            None => Ok(None),
        }
    }

    /// `rerere.enabled` as git reads a boolean; None when it is not set.
    fn rerere_enabled(&self) -> Result<Option<bool>> {
        let command = self.command(Access::Read, &ENABLED_ARGS);
        let output = run_accepting(command, None, GIT_TIMEOUT, is_found_or_unset)?;
        match output.as_slice() {
            b"" => Ok(None),
            b"true\n" => Ok(Some(true)),
            b"false\n" => Ok(Some(false)),
            _ => Err(Error::UnexpectedOutput {
                command: "config rerere.enabled",
                output: String::from_utf8_lossy(&output).into_owned(),
            }),
        }
    }
}

fn is_found_or_unset(status: ExitStatus) -> bool {
    status.success() || status.code() == Some(UNSET_STATUS)
}

// rerere.c `write_rr`: a path whose resolution was replayed is dropped from the list; every other
// record is the conflict id, a tab, the path and a NUL.
fn tracked_paths(records: &[u8]) -> Result<Vec<PathBuf>> {
    let mut paths = Vec::new();
    for record in records.split(|&byte| byte == b'\0') {
        if record.is_empty() {
            continue;
        }
        let Some(tab) = record.iter().position(|&byte| byte == b'\t') else {
            return Err(Error::UnexpectedOutput {
                command: MERGE_RR,
                output: String::from_utf8_lossy(records).into_owned(),
            });
        };
        paths.push(path_from_git(record.get(tab + 1..).unwrap_or_default()));
    }
    Ok(paths)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_record_gives_its_path_with_or_without_a_variant() {
        let records = b"0a1b\tsrc/board.ts\x002c3d.1\twith\ttab.txt\x00";

        assert_eq!(
            tracked_paths(records).unwrap(),
            [
                PathBuf::from("src/board.ts"),
                PathBuf::from("with\ttab.txt")
            ]
        );
        assert_eq!(tracked_paths(b"").unwrap(), Vec::<PathBuf>::new());
    }

    #[test]
    fn a_record_without_a_tab_is_unexpected() {
        assert!(matches!(
            tracked_paths(b"0a1b src/board.ts\x00"),
            Err(Error::UnexpectedOutput { .. })
        ));
    }
}
