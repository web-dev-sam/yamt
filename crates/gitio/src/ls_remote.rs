use std::time::Duration;

use crate::entry::Oid;
use crate::fetch::run_without_prompts;
use crate::glab::first_line;
use crate::repo::Repo;
use crate::run::Access;

const LS_REMOTE: [&str; 3] = ["ls-remote", "--refs", "--end-of-options"];

/// One ref a remote advertises: its full name (git's bytes) and the object it names.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RemoteRef {
    pub name: Vec<u8>,
    pub id: Oid,
}

impl Repo {
    /// `git ls-remote --refs --end-of-options <remote> <patterns>…`: every ref the remote advertises that matches a
    /// pattern (git-ls-remote(1): a glob matched against the ref's tail), in git's order; no object is fetched and
    /// nothing is written. Runs through `fetch.rs` `run_without_prompts` (the no-prompt environment, RK40), killed at
    /// `timeout`. `Err` = git's first stderr line, else git's exit words (as `fetch_without_refs`).
    pub fn remote_refs(
        &self,
        remote: &str,
        patterns: &[&str],
        timeout: Duration,
    ) -> Result<Vec<RemoteRef>, String> {
        let mut command = self.command(Access::Read, &LS_REMOTE);
        command.arg(remote).args(patterns);
        let finished = run_without_prompts(command, "ls-remote", timeout)?;
        if !finished.status.success() {
            return Err(first_line(&finished.stderr)
                .unwrap_or_else(|| format!("git ls-remote failed: {}", finished.status)));
        }
        remote_refs_in(&finished.stdout)
    }
}

/// git-ls-remote(1) output: one `<oid> TAB <refname>` line per ref.
fn remote_refs_in(output: &[u8]) -> Result<Vec<RemoteRef>, String> {
    output
        .split(|&byte| byte == b'\n')
        .filter(|line| !line.is_empty())
        .map(remote_ref_in)
        .collect()
}

fn remote_ref_in(line: &[u8]) -> Result<RemoteRef, String> {
    let mut fields = line.splitn(2, |&byte| byte == b'\t');
    let id = fields.next().and_then(|id| std::str::from_utf8(id).ok());
    let id = id.and_then(|id| Oid::parse(id).ok());
    match (id, fields.next()) {
        (Some(id), Some(name)) if !name.is_empty() => Ok(RemoteRef {
            name: name.to_vec(),
            id,
        }),
        _ => Err(format!(
            "git ls-remote printed {:?}",
            String::from_utf8_lossy(line)
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MAIN_ID: &str = "1111111111111111111111111111111111111111";
    const HEAD_ID: &str = "2222222222222222222222222222222222222222";

    #[test]
    fn each_tab_separated_line_is_one_ref_in_gits_order() {
        let output = format!("{MAIN_ID}\trefs/heads/main\n{HEAD_ID}\trefs/merge-requests/7/head\n");

        let refs = remote_refs_in(output.as_bytes());

        assert_eq!(
            refs,
            Ok(vec![
                RemoteRef {
                    name: b"refs/heads/main".to_vec(),
                    id: Oid::parse(MAIN_ID).unwrap(),
                },
                RemoteRef {
                    name: b"refs/merge-requests/7/head".to_vec(),
                    id: Oid::parse(HEAD_ID).unwrap(),
                },
            ])
        );
    }

    #[test]
    fn an_empty_answer_is_no_ref() {
        assert_eq!(remote_refs_in(b""), Ok(Vec::new()));
    }

    #[test]
    fn a_name_keeps_gits_bytes() {
        let output = [MAIN_ID.as_bytes(), b"\trefs/heads/caf\xe9\n"].concat();

        let refs = remote_refs_in(&output).unwrap();

        assert_eq!(refs[0].name, b"refs/heads/caf\xe9".to_vec());
    }

    #[test]
    fn a_line_without_an_id_and_a_name_is_unreadable() {
        let no_tab = format!("{MAIN_ID} refs/heads/main\n");
        let bad_id = "1234\trefs/heads/main\n";
        let no_name = format!("{MAIN_ID}\t\n");

        for output in [no_tab.as_str(), bad_id, no_name.as_str()] {
            let line = output.trim_end_matches('\n');
            assert_eq!(
                remote_refs_in(output.as_bytes()),
                Err(format!("git ls-remote printed {line:?}")),
            );
        }
    }

    #[test]
    fn one_unreadable_line_fails_the_whole_answer() {
        let output = format!("{MAIN_ID}\trefs/heads/main\nwarning: something\n");

        assert_eq!(
            remote_refs_in(output.as_bytes()),
            Err("git ls-remote printed \"warning: something\"".to_owned())
        );
    }
}
