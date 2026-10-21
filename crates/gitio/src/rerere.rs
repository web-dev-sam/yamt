use std::path::PathBuf;

use crate::entry::path_from_git;
use crate::repo::{Repo, read_if_present};
use crate::{Error, Result};

const MERGE_RR: &str = "MERGE_RR";

impl Repo {
    /// The paths rerere still tracks (`MERGE_RR` through `--git-path`, records `<id>[.<n>]\t<path>\0`); None when
    /// there is no `MERGE_RR` (rerere off, or nothing recorded at this stop).
    pub fn rerere_tracked(&self) -> Result<Option<Vec<PathBuf>>> {
        match read_if_present(&self.git_path(MERGE_RR)?)? {
            Some(records) => tracked_paths(&records).map(Some),
            None => Ok(None),
        }
    }
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
