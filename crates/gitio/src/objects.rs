use crate::blob::CAT_FILE;
use crate::entry::Oid;
use crate::repo::Repo;
use crate::run::{Access, GIT_TIMEOUT, run};
use crate::{Error, Result};

const BATCH_CHECK: &str = "--batch-check=%(objectname) %(objecttype)";
const COMMIT: &str = "commit";

impl Repo {
    /// Which of `ids` name no commit in the repository's object store, in the order given: one
    /// `git cat-file --batch-check` reading the ids on stdin (a missing id and one that is not a commit both count).
    pub fn missing_commits(&self, ids: &[Oid]) -> Result<Vec<Oid>> {
        let mut input = Vec::new();
        for id in ids {
            input.extend_from_slice(id.as_str().as_bytes());
            input.push(b'\n');
        }
        let command = self.command(Access::Read, &[CAT_FILE, BATCH_CHECK]);
        let output = run(command, Some(input), GIT_TIMEOUT)?;
        missing_commits_in(ids, &output)
    }
}

/// git-cat-file(1) `--batch-check`: one line per id in input order, `<id> <type>` for an object that exists and
/// `<id> missing` for one that does not.
fn missing_commits_in(ids: &[Oid], output: &[u8]) -> Result<Vec<Oid>> {
    let text = String::from_utf8_lossy(output);
    let lines: Vec<&str> = text.lines().collect();
    if lines.len() != ids.len() {
        return Err(unexpected(&text));
    }
    let mut missing = Vec::new();
    for (id, line) in ids.iter().zip(lines) {
        let kind = line
            .strip_prefix(id.as_str())
            .and_then(|rest| rest.strip_prefix(' '))
            .ok_or_else(|| unexpected(&text))?;
        if kind != COMMIT {
            missing.push(id.clone());
        }
    }
    Ok(missing)
}

fn unexpected(text: &str) -> Error {
    Error::UnexpectedOutput {
        command: CAT_FILE,
        output: text.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn oid(digit: char) -> Oid {
        Oid::parse(&digit.to_string().repeat(40)).unwrap()
    }

    #[test]
    fn missing_ids_and_non_commits_are_named_in_the_order_given() {
        let ids = [oid('1'), oid('2'), oid('3'), oid('4')];
        let output = format!(
            "{} commit\n{} missing\n{} tree\n{} commit\n",
            ids[0].as_str(),
            ids[1].as_str(),
            ids[2].as_str(),
            ids[3].as_str()
        );

        let missing = missing_commits_in(&ids, output.as_bytes()).unwrap();

        assert_eq!(missing, vec![oid('2'), oid('3')]);
    }

    #[test]
    fn no_ids_give_no_missing_commit() {
        assert_eq!(missing_commits_in(&[], b"").unwrap(), Vec::<Oid>::new());
    }

    #[test]
    fn a_line_for_another_id_or_a_line_too_few_is_unexpected() {
        let ids = [oid('1'), oid('2')];
        let swapped = format!("{} commit\n{} commit\n", ids[1].as_str(), ids[0].as_str());
        let short = format!("{} commit\n", ids[0].as_str());
        let glued = format!("{}commit\n{} commit\n", ids[0].as_str(), ids[1].as_str());

        for output in [swapped, short, glued] {
            assert!(matches!(
                missing_commits_in(&ids, output.as_bytes()),
                Err(Error::UnexpectedOutput {
                    command: CAT_FILE,
                    ..
                })
            ));
        }
    }
}
