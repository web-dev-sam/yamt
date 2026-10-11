use std::process::ExitStatus;

use crate::Result;
use crate::repo::Repo;
use crate::run::{Access, GIT_TIMEOUT, run_accepting};

const CONFIG: &str = "config";
const MERGE_DRIVER_KEYS: &str = r"^merge\.(default|.+\.driver)$";
const DEFAULT_KEY: &[u8] = b"merge.default";
const DRIVER_KEY_PREFIX: &[u8] = b"merge.";
const DRIVER_KEY_SUFFIX: &[u8] = b".driver";
// git-config(1): `--get-regexp` exits with 1 when no key matches.
const NO_MATCH_STATUS: i32 = 1;

/// The config that picks a merge driver (gitattributes(5) "Defining a custom merge driver"), as
/// git stores it.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct MergeConfig {
    /// `merge.default`: the driver of a path whose `merge` attribute is unspecified.
    pub default: Option<Vec<u8>>,
    /// Every `<name>` that has a `merge.<name>.driver`.
    pub drivers: Vec<Vec<u8>>,
}

impl Repo {
    pub fn merge_config(&self) -> Result<MergeConfig> {
        let args = [CONFIG, "-z", "--get-regexp", MERGE_DRIVER_KEYS];
        let command = self.command(Access::Read, &args);
        let output = run_accepting(command, None, GIT_TIMEOUT, is_found_or_no_match)?;
        Ok(parse_merge_config(&output))
    }
}

fn is_found_or_no_match(status: ExitStatus) -> bool {
    status.success() || status.code() == Some(NO_MATCH_STATUS)
}

// git-config(1) `-z`: each entry is `<key> NL <value> NUL`, or `<key> NUL` for a key without a
// value; section and variable names are lowercase, the `<name>` subsection is kept as written.
fn parse_merge_config(output: &[u8]) -> MergeConfig {
    let mut config = MergeConfig::default();
    for entry in output.split(|&byte| byte == b'\0') {
        let mut parts = entry.splitn(2, |&byte| byte == b'\n');
        let (Some(key), Some(value)) = (parts.next(), parts.next()) else {
            continue;
        };
        if key == DEFAULT_KEY {
            config.default = Some(value.to_vec());
        } else if let Some(name) = key
            .strip_prefix(DRIVER_KEY_PREFIX)
            .and_then(|rest| rest.strip_suffix(DRIVER_KEY_SUFFIX))
        {
            config.drivers.push(name.to_vec());
        }
    }
    config
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_last_default_wins_and_every_driver_name_is_kept_as_written() {
        let output = b"merge.default\nunion\0merge.mergiraf.driver\nmergiraf merge %O %A %B\0\
merge.default\nbinary\0merge.My.Tool.driver\nrun %A\0merge.valueless.driver\0";

        let config = parse_merge_config(output);

        assert_eq!(config.default, Some(b"binary".to_vec()));
        assert_eq!(config.drivers, [b"mergiraf".to_vec(), b"My.Tool".to_vec()]);
        assert_eq!(parse_merge_config(b""), MergeConfig::default());
    }
}
