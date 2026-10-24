use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::entry::{Oid, path_from_git};
use crate::repo::Repo;
use crate::run::{Access, GIT_TIMEOUT, run};
use crate::{Error, Result};

const DIFF_TREE: &str = "diff-tree";
const OCTAL: u32 = 8;
const NUMSTAT_FIELDS: usize = 3;
const BINARY_COUNT: &str = "-";

/// One side of a changed pair as a tree holds it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TreeSide {
    pub path: PathBuf,
    pub mode: u32,
    pub oid: Oid,
}

/// A pair `git diff-tree --raw` lists, by its status letter.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Changed {
    Added {
        new: TreeSide,
    },
    Deleted {
        old: TreeSide,
    },
    /// Raw `M`, and `T`: a kind change, which the modes tell apart.
    Modified {
        old: TreeSide,
        new: TreeSide,
    },
    /// Raw `R<score>`.
    Renamed {
        old: TreeSide,
        new: TreeSide,
    },
}

/// The line counts `--numstat` gives a pair.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Numstat {
    Lines { added: u32, removed: u32 },
    Binary,
    Missing,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ChangedFile {
    pub change: Changed,
    pub numstat: Numstat,
}

impl Changed {
    fn destination(&self) -> &Path {
        match self {
            Changed::Added { new }
            | Changed::Modified { new, .. }
            | Changed::Renamed { new, .. } => &new.path,
            Changed::Deleted { old } => &old.path,
        }
    }
}

impl Repo {
    /// `git diff-tree -r -z --raw --numstat --no-abbrev -M --diff-algorithm=histogram --ignore-submodules=none <old> <new>`
    pub fn changed_files(&self, old: &Oid, new: &Oid) -> Result<Vec<ChangedFile>> {
        let args = [
            DIFF_TREE,
            "-r",
            "-z",
            "--raw",
            "--numstat",
            "--no-abbrev",
            "-M",
            "--diff-algorithm=histogram",
            "--ignore-submodules=none",
            old.as_str(),
            new.as_str(),
        ];
        let output = run(self.command(Access::Read, &args), None, GIT_TIMEOUT)?;
        parse_changed_files(&output)
    }
}

// git diff.c `diff_flush`: every raw record comes first, then every numstat record, nothing between them.
// `-z` raw: `:<mode> <mode> <oid> <oid> <status>\0<path>\0` (a rename: `\0<old>\0<new>\0`);
// `-z` numstat: `<added>\t<removed>\t<path>\0` (a rename: `<added>\t<removed>\t\0<old>\0<new>\0`), `-` for binary.
fn parse_changed_files(output: &[u8]) -> Result<Vec<ChangedFile>> {
    let mut fields = output.split(|&byte| byte == b'\0').peekable();
    let mut changes = Vec::new();
    while let Some(header) = fields.next_if(|field| field.starts_with(b":")) {
        changes.push(raw_change(header, &mut fields)?);
    }
    let mut counts = HashMap::new();
    while let Some(record) = fields.next_if(|field| !field.is_empty()) {
        let (path, numstat) = numstat_record(record, &mut fields)?;
        if counts.insert(path, numstat).is_some() {
            return Err(unexpected(record));
        }
    }
    match (fields.next(), fields.next()) {
        (Some([]), None) => {}
        (Some(field), _) => return Err(unexpected(field)),
        (None, _) => return Err(unexpected(output)),
    }
    Ok(changes
        .into_iter()
        .map(|change| {
            let numstat = counts
                .remove(change.destination())
                .unwrap_or(Numstat::Missing);
            ChangedFile { change, numstat }
        })
        .collect())
}

fn raw_change<'a>(header: &[u8], fields: &mut impl Iterator<Item = &'a [u8]>) -> Result<Changed> {
    let text = header
        .strip_prefix(b":")
        .and_then(|fields| std::str::from_utf8(fields).ok())
        .ok_or_else(|| unexpected(header))?;
    let parts: Vec<&str> = text.split(' ').collect();
    let [old_mode, new_mode, old_oid, new_oid, status] = parts.as_slice() else {
        return Err(unexpected(header));
    };
    let old_mode = mode_of(old_mode, header)?;
    let new_mode = mode_of(new_mode, header)?;
    let (old_oid, new_oid) = (Oid::parse(old_oid)?, Oid::parse(new_oid)?);
    let path = next_path(fields, header)?;
    let side = |path: PathBuf, mode: u32, oid: Oid| TreeSide { path, mode, oid };
    match *status {
        "A" => Ok(Changed::Added {
            new: side(path, new_mode, new_oid),
        }),
        "D" => Ok(Changed::Deleted {
            old: side(path, old_mode, old_oid),
        }),
        "M" | "T" => Ok(Changed::Modified {
            old: side(path.clone(), old_mode, old_oid),
            new: side(path, new_mode, new_oid),
        }),
        rename if is_rename(rename) => Ok(Changed::Renamed {
            old: side(path, old_mode, old_oid),
            new: side(next_path(fields, header)?, new_mode, new_oid),
        }),
        _ => Err(unexpected(header)),
    }
}

fn is_rename(status: &str) -> bool {
    status
        .strip_prefix('R')
        .is_some_and(|score| !score.is_empty() && score.bytes().all(|byte| byte.is_ascii_digit()))
}

fn numstat_record<'a>(
    record: &[u8],
    fields: &mut impl Iterator<Item = &'a [u8]>,
) -> Result<(PathBuf, Numstat)> {
    let parts: Vec<&[u8]> = record
        .splitn(NUMSTAT_FIELDS, |&byte| byte == b'\t')
        .collect();
    let [added, removed, path] = parts.as_slice() else {
        return Err(unexpected(record));
    };
    let numstat = counts_of(added, removed).ok_or_else(|| unexpected(record))?;
    if !path.is_empty() {
        return Ok((path_from_git(path), numstat));
    }
    let _old_path = next_path(fields, record)?;
    Ok((next_path(fields, record)?, numstat))
}

fn counts_of(added: &[u8], removed: &[u8]) -> Option<Numstat> {
    let (added, removed) = (
        std::str::from_utf8(added).ok()?,
        std::str::from_utf8(removed).ok()?,
    );
    if added == BINARY_COUNT && removed == BINARY_COUNT {
        return Some(Numstat::Binary);
    }
    Some(Numstat::Lines {
        added: added.parse().ok()?,
        removed: removed.parse().ok()?,
    })
}

fn mode_of(octal: &str, header: &[u8]) -> Result<u32> {
    u32::from_str_radix(octal, OCTAL).map_err(|_| unexpected(header))
}

fn next_path<'a>(fields: &mut impl Iterator<Item = &'a [u8]>, record: &[u8]) -> Result<PathBuf> {
    match fields.next() {
        Some(path) if !path.is_empty() => Ok(path_from_git(path)),
        Some(_) | None => Err(unexpected(record)),
    }
}

fn unexpected(output: &[u8]) -> Error {
    Error::UnexpectedOutput {
        command: DIFF_TREE,
        output: String::from_utf8_lossy(output).into_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const REGULAR: u32 = 0o100_644;

    fn oid(digit: char) -> Oid {
        Oid::parse(&digit.to_string().repeat(40)).unwrap()
    }

    fn hex(digit: char) -> String {
        digit.to_string().repeat(40)
    }

    fn raw(old_mode: &str, new_mode: &str, old: char, new: char, status: &str) -> Vec<u8> {
        format!(
            ":{old_mode} {new_mode} {} {} {status}\0",
            hex(old),
            hex(new)
        )
        .into_bytes()
    }

    fn side(path: &str, mode: u32, digit: char) -> TreeSide {
        TreeSide {
            path: PathBuf::from(path),
            mode,
            oid: oid(digit),
        }
    }

    fn counted(change: Changed, added: u32, removed: u32) -> ChangedFile {
        let numstat = Numstat::Lines { added, removed };
        ChangedFile { change, numstat }
    }

    #[test]
    fn numstat_records_out_of_raw_order_are_matched_by_destination_path() {
        let mut output = raw("100644", "100644", '1', '2', "M");
        output.extend_from_slice(b"b.txt\0");
        output.extend(raw("100644", "100644", '3', '4', "R087"));
        output.extend_from_slice(b"old.txt\0new.txt\0");
        output.extend(raw("100644", "000000", '5', '0', "D"));
        output.extend_from_slice(b"gone.txt\0");
        output.extend(raw("000000", "100755", '0', '6', "A"));
        output.extend_from_slice(b"a.txt\0");
        output.extend_from_slice(b"3\t0\ta.txt\0");
        output.extend_from_slice(b"0\t4\tgone.txt\0");
        output.extend_from_slice(b"1\t2\t\0old.txt\0new.txt\0");
        output.extend_from_slice(b"7\t5\tb.txt\0");

        let files = parse_changed_files(&output).unwrap();

        let (old, new) = (side("b.txt", REGULAR, '1'), side("b.txt", REGULAR, '2'));
        let modified = counted(Changed::Modified { old, new }, 7, 5);
        let (old, new) = (side("old.txt", REGULAR, '3'), side("new.txt", REGULAR, '4'));
        let renamed = counted(Changed::Renamed { old, new }, 1, 2);
        let old = side("gone.txt", REGULAR, '5');
        let deleted = counted(Changed::Deleted { old }, 0, 4);
        let new = side("a.txt", 0o100_755, '6');
        let added = counted(Changed::Added { new }, 3, 0);
        assert_eq!(files, [modified, renamed, deleted, added]);
    }

    #[test]
    fn a_binary_pair_is_binary_and_a_pair_without_a_numstat_record_is_missing() {
        let mut output = raw("100644", "100644", '1', '2', "M");
        output.extend_from_slice(b"logo.png\0");
        output.extend(raw("100644", "100644", '3', '4', "T"));
        output.extend_from_slice(b"uncounted\0");
        output.extend_from_slice(b"-\t-\tlogo.png\0");

        let numstats: Vec<Numstat> = parse_changed_files(&output)
            .unwrap()
            .into_iter()
            .map(|file| file.numstat)
            .collect();

        assert_eq!(numstats, [Numstat::Binary, Numstat::Missing]);
    }

    #[test]
    fn a_half_binary_count_is_unexpected_output() {
        let mut output = raw("100644", "100644", '1', '2', "M");
        output.extend_from_slice(b"a\0-\t3\ta\0");

        let error = parse_changed_files(&output).unwrap_err();

        assert!(
            matches!(
                error,
                Error::UnexpectedOutput {
                    command: DIFF_TREE,
                    ..
                }
            ),
            "{error:?}"
        );
    }

    #[test]
    fn two_numstat_records_for_one_path_are_unexpected_output() {
        let mut output = raw("100644", "100644", '1', '2', "M");
        output.extend_from_slice(b"a\0");
        output.extend_from_slice(b"1\t1\ta\0");
        output.extend_from_slice(b"2\t2\ta\0");

        let error = parse_changed_files(&output).unwrap_err();

        assert!(matches!(error, Error::UnexpectedOutput { .. }), "{error:?}");
    }

    #[cfg(unix)]
    #[test]
    fn a_path_with_a_tab_a_newline_a_space_and_non_utf8_bytes_is_kept_as_bytes() {
        use std::os::unix::ffi::OsStrExt;
        let name: &[u8] = b"odd\tname\nwith space \xff.txt";
        let mut output = raw("000000", "100644", '0', '1', "A");
        output.extend_from_slice(name);
        output.push(b'\0');
        output.extend_from_slice(b"2\t0\t");
        output.extend_from_slice(name);
        output.push(b'\0');

        let files = parse_changed_files(&output).unwrap();

        let [
            ChangedFile {
                change: Changed::Added { new },
                numstat,
            },
        ] = files.as_slice()
        else {
            panic!("{files:?}");
        };
        assert_eq!(new.path.as_os_str().as_bytes(), name);
        assert_eq!(
            *numstat,
            Numstat::Lines {
                added: 2,
                removed: 0
            }
        );
    }

    #[test]
    fn no_output_is_no_changed_file() {
        assert_eq!(parse_changed_files(b"").unwrap(), []);
    }

    #[test]
    fn copied_unmerged_and_unknown_statuses_are_unexpected_output() {
        for status in ["C075", "U", "X", "R", "Rx", "MM"] {
            let mut output = raw("100644", "100644", '1', '2', status);
            output.extend_from_slice(b"a\0b\0");

            let error = parse_changed_files(&output).unwrap_err();

            assert!(
                matches!(error, Error::UnexpectedOutput { .. }),
                "{status}: {error:?}"
            );
        }
    }

    #[test]
    fn output_cut_inside_a_record_is_unexpected_output() {
        let mut renamed = raw("100644", "100644", '1', '2', "R100");
        renamed.extend_from_slice(b"old\0");
        let mut uncounted = raw("100644", "100644", '1', '2', "M");
        uncounted.extend_from_slice(b"a\0");
        uncounted.extend_from_slice(b"1\t1\t\0a\0");
        let mut unterminated = raw("100644", "100644", '1', '2', "M");
        unterminated.extend_from_slice(b"a");

        for output in [renamed, uncounted, unterminated] {
            let error = parse_changed_files(&output).unwrap_err();

            assert!(matches!(error, Error::UnexpectedOutput { .. }), "{error:?}");
        }
    }
}
