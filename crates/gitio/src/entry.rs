use std::ffi::OsStr;
use std::os::unix::ffi::OsStrExt;
use std::path::{Path, PathBuf};

use crate::{Error, Result};

const SHA1_HEX_LEN: usize = 40;
const SHA256_HEX_LEN: usize = 64;

/// A git object id: 40 (SHA-1) or 64 (SHA-256) lowercase hex characters.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Oid(String);

impl Oid {
    pub fn parse(hex: &str) -> Result<Oid> {
        let valid_len = hex.len() == SHA1_HEX_LEN || hex.len() == SHA256_HEX_LEN;
        let valid_chars = hex
            .bytes()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'));
        if valid_len && valid_chars {
            Ok(Oid(hex.to_owned()))
        } else {
            Err(Error::UnexpectedOutput {
                command: "oid",
                output: hex.to_owned(),
            })
        }
    }

    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// A conflict stage of the index: 1 = merge base, 2 = ours, 3 = theirs.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Stage {
    Base,
    Local,
    Remote,
}

impl Stage {
    fn from_index_number(number: &str) -> Option<Stage> {
        match number {
            "1" => Some(Stage::Base),
            "2" => Some(Stage::Local),
            "3" => Some(Stage::Remote),
            _ => None,
        }
    }

    fn index_number(self) -> u8 {
        match self {
            Stage::Base => 1,
            Stage::Local => 2,
            Stage::Remote => 3,
        }
    }
}

/// One line of `git ls-files -u`: a path at one conflict stage.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StageEntry {
    pub mode: u32,
    pub oid: Oid,
    pub stage: Stage,
    pub path: PathBuf,
}

const LS_FILES: &str = "ls-files";
const OCTAL: u32 = 8;

/// Parses `ls-files -u -z` output: records `<mode> SP <oid> SP <stage> TAB <path> NUL`.
pub(crate) fn parse_unmerged(output: &[u8]) -> Result<Vec<StageEntry>> {
    let mut entries = Vec::new();
    for record in output.split(|&byte| byte == b'\0') {
        if record.is_empty() {
            continue;
        }
        let entry = parse_record(record).ok_or_else(|| Error::UnexpectedOutput {
            command: LS_FILES,
            output: String::from_utf8_lossy(record).into_owned(),
        })?;
        entries.push(entry);
    }
    Ok(entries)
}

fn parse_record(record: &[u8]) -> Option<StageEntry> {
    let tab = record.iter().position(|&byte| byte == b'\t')?;
    let (meta, path) = (record.get(..tab)?, record.get(tab + 1..)?);
    let mut fields = std::str::from_utf8(meta).ok()?.split(' ');
    let mode = u32::from_str_radix(fields.next()?, OCTAL).ok()?;
    let oid = Oid::parse(fields.next()?).ok()?;
    let stage = Stage::from_index_number(fields.next()?)?;
    if fields.next().is_some() || path.is_empty() {
        return None;
    }
    let path = PathBuf::from(OsStr::from_bytes(path));
    Some(StageEntry {
        mode,
        oid,
        stage,
        path,
    })
}

/// Builds `update-index -z --index-info` input that replaces each path's index entries
/// with exactly the given stages.
pub(crate) fn index_info(entries: &[StageEntry]) -> Vec<u8> {
    let mut paths: Vec<&Path> = Vec::new();
    for entry in entries {
        if !paths.contains(&entry.path.as_path()) {
            paths.push(&entry.path);
        }
    }
    let mut input = Vec::new();
    for path in paths {
        let path_entries = entries.iter().filter(|entry| entry.path == path);
        for (index, entry) in path_entries.enumerate() {
            if index == 0 {
                push_removal_record(&mut input, entry);
            }
            push_stage_record(&mut input, entry);
        }
    }
    input
}

// git-update-index(1) "USING --INDEX-INFO": a higher stage is placed by first removing
// the path with a mode-0 record, then feeding `<mode> SP <oid> SP <stage> TAB <path>`.
fn push_removal_record(input: &mut Vec<u8>, entry: &StageEntry) {
    let zero_oid = "0".repeat(entry.oid.as_str().len());
    input.extend_from_slice(format!("0 {zero_oid}\t").as_bytes());
    push_path(input, &entry.path);
}

fn push_stage_record(input: &mut Vec<u8>, entry: &StageEntry) {
    let (mode, oid, stage) = (entry.mode, entry.oid.as_str(), entry.stage.index_number());
    input.extend_from_slice(format!("{mode:o} {oid} {stage}\t").as_bytes());
    push_path(input, &entry.path);
}

fn push_path(input: &mut Vec<u8>, path: &Path) {
    input.extend_from_slice(path.as_os_str().as_bytes());
    input.push(b'\0');
}

#[cfg(test)]
mod tests {
    use super::*;

    const OID: &str = "0123456789abcdef0123456789abcdef01234567";

    #[test]
    fn ls_files_record_parses_into_stage_entry() {
        let output = format!("100644 {OID} 2\tdir/a b.txt\0");
        let entries = parse_unmerged(output.as_bytes()).unwrap();
        let expected = StageEntry {
            mode: 0o100_644,
            oid: Oid::parse(OID).unwrap(),
            stage: Stage::Local,
            path: PathBuf::from("dir/a b.txt"),
        };
        assert_eq!(entries, vec![expected]);
    }

    #[test]
    fn stage_zero_record_is_unexpected_output() {
        let output = format!("100644 {OID} 0\ta.txt\0");
        let error = parse_unmerged(output.as_bytes()).unwrap_err();
        assert!(matches!(
            error,
            Error::UnexpectedOutput {
                command: LS_FILES,
                ..
            }
        ));
    }

    #[test]
    fn oid_rejects_uppercase_and_wrong_length() {
        assert!(Oid::parse(&OID.to_uppercase()).is_err());
        assert!(Oid::parse(&OID[1..]).is_err());
    }
}
