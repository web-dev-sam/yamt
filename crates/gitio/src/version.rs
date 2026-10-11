use crate::repo::Repo;
use crate::run::{Access, GIT_TIMEOUT, run};
use crate::{Error, Result};

const VERSION: &str = "version";
const VERSION_PREFIX: &str = "git version ";

/// The release of the git binary in use; ordered by major, then minor.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct GitVersion {
    pub major: u32,
    pub minor: u32,
}

impl Repo {
    pub fn version(&self) -> Result<GitVersion> {
        let output = run(self.command(Access::Read, &[VERSION]), None, GIT_TIMEOUT)?;
        let line = String::from_utf8_lossy(&output);
        parse_version(&line).ok_or_else(|| Error::UnexpectedOutput {
            command: VERSION,
            output: line.into_owned(),
        })
    }
}

fn parse_version(line: &str) -> Option<GitVersion> {
    let numbers = line.trim_end().strip_prefix(VERSION_PREFIX)?;
    let dotted = numbers.split(' ').next()?;
    let mut parts = dotted.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    Some(GitVersion { major, minor })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apple_and_plain_version_lines_give_major_and_minor() {
        assert_eq!(
            parse_version("git version 2.39.5 (Apple Git-154)\n"),
            Some(GitVersion {
                major: 2,
                minor: 39
            })
        );
        assert_eq!(
            parse_version("git version 2.56.0\n"),
            Some(GitVersion {
                major: 2,
                minor: 56
            })
        );
        assert_eq!(
            parse_version("git version 2.45.windows.1"),
            Some(GitVersion {
                major: 2,
                minor: 45
            })
        );
        assert_eq!(parse_version("hub version 2.14.2"), None);
        assert_eq!(parse_version("git version 2"), None);
    }

    #[test]
    fn versions_order_by_major_then_minor() {
        let version = |major, minor| GitVersion { major, minor };
        assert!(version(2, 39) < version(2, 44));
        assert!(version(2, 44) < version(3, 0));
        assert!(version(2, 56) >= version(2, 44));
    }
}
