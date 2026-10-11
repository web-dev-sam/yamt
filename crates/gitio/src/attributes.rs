use std::os::unix::ffi::OsStrExt;
use std::path::Path;

use crate::repo::Repo;
use crate::run::{Access, GIT_TIMEOUT, run};
use crate::{Error, Result};

const CHECK_ATTR: &str = "check-attr";
const MARKER_SIZE: &str = "conflict-marker-size";
const MERGE: &str = "merge";
const WORKING_TREE_ENCODING: &str = "working-tree-encoding";
const ATTRIBUTES: usize = 3;
const FIELDS_PER_RECORD: usize = 3;

/// One attribute of one path, as `git check-attr` reports it (gitattributes(5)).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AttributeValue {
    Unspecified,
    Unset,
    Set,
    Value(Vec<u8>),
}

/// The attributes that decide how git merged a path and wrote it to the worktree.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MergeAttributes {
    pub conflict_marker_size: AttributeValue,
    pub merge: AttributeValue,
    pub working_tree_encoding: AttributeValue,
}

impl Repo {
    /// One entry per path, in the order of `paths`.
    pub fn attributes(&self, paths: &[&Path]) -> Result<Vec<MergeAttributes>> {
        if paths.is_empty() {
            return Ok(Vec::new());
        }
        let args = [
            CHECK_ATTR,
            "-z",
            "--stdin",
            MARKER_SIZE,
            MERGE,
            WORKING_TREE_ENCODING,
        ];
        let mut input = Vec::new();
        for path in paths {
            input.extend_from_slice(path.as_os_str().as_bytes());
            input.push(b'\0');
        }
        let output = run(self.command(Access::Read, &args), Some(input), GIT_TIMEOUT)?;
        parse_attributes(&output, paths).ok_or_else(|| Error::UnexpectedOutput {
            command: CHECK_ATTR,
            output: String::from_utf8_lossy(&output).into_owned(),
        })
    }
}

// git-check-attr(1) `-z`: `<path> NUL <attribute> NUL <info> NUL`, for each path in input order and
// each attribute in command-line order.
fn parse_attributes(output: &[u8], paths: &[&Path]) -> Option<Vec<MergeAttributes>> {
    let mut fields: Vec<&[u8]> = output.split(|&byte| byte == b'\0').collect();
    let ends_with_nul = fields.pop().is_some_and(<[u8]>::is_empty);
    if !ends_with_nul || fields.len() != paths.len() * ATTRIBUTES * FIELDS_PER_RECORD {
        return None;
    }
    let (records, _) = fields.as_chunks::<FIELDS_PER_RECORD>();
    let mut records = records.iter();
    let mut attributes = Vec::with_capacity(paths.len());
    for path in paths {
        let mut value_of = |name: &str| {
            let [record_path, attribute, info] = records.next()?;
            let matches =
                *record_path == path.as_os_str().as_bytes() && *attribute == name.as_bytes();
            matches.then(|| attribute_value(info))
        };
        attributes.push(MergeAttributes {
            conflict_marker_size: value_of(MARKER_SIZE)?,
            merge: value_of(MERGE)?,
            working_tree_encoding: value_of(WORKING_TREE_ENCODING)?,
        });
    }
    Some(attributes)
}

fn attribute_value(info: &[u8]) -> AttributeValue {
    match info {
        b"unspecified" => AttributeValue::Unspecified,
        b"unset" => AttributeValue::Unset,
        b"set" => AttributeValue::Set,
        value => AttributeValue::Value(value.to_vec()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_parse_per_path_in_order_and_a_missing_record_is_unexpected() {
        let output = b"a.txt\0conflict-marker-size\x0012\0a.txt\0merge\0unset\0a.txt\0working-tree-encoding\0unspecified\0\
b c\0conflict-marker-size\0unspecified\0b c\0merge\0set\0b c\0working-tree-encoding\0UTF-16\0";
        let paths = [Path::new("a.txt"), Path::new("b c")];
        let parsed = parse_attributes(output, &paths).unwrap();
        assert_eq!(
            parsed,
            [
                MergeAttributes {
                    conflict_marker_size: AttributeValue::Value(b"12".to_vec()),
                    merge: AttributeValue::Unset,
                    working_tree_encoding: AttributeValue::Unspecified,
                },
                MergeAttributes {
                    conflict_marker_size: AttributeValue::Unspecified,
                    merge: AttributeValue::Set,
                    working_tree_encoding: AttributeValue::Value(b"UTF-16".to_vec()),
                },
            ]
        );
        assert_eq!(parse_attributes(output, &paths[..1]), None);
        assert_eq!(parse_attributes(&output[..40], &paths[..1]), None);
        let one_more = [paths[0], paths[1], Path::new("c")];
        assert_eq!(parse_attributes(output, &one_more), None);
        assert_eq!(parse_attributes(output, &[paths[1], paths[0]]), None);
    }
}
