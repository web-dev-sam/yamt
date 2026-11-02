use std::process::Command;

use crate::Result;
use crate::blob::{CAT_FILE, unexpected};
use crate::entry::Oid;
use crate::repo::Repo;
use crate::run::{Access, GIT_TIMEOUT, run};

const OBJECT_TYPE: &str = "%(objecttype)";
const COMMIT: &str = "commit";

/// Whether a git run may fetch an object a partial clone lacks from its promisor remote.
#[derive(Clone, Copy)]
pub(crate) enum LazyFetch {
    Allowed,
    Refused,
}

impl Repo {
    /// Which of `ids` name no commit in the repository's object store, in the order given (a missing id and one
    /// that is not a commit both count); a partial clone never fetches an id it lacks to answer.
    pub fn missing_commits(&self, ids: &[Oid]) -> Result<Vec<Oid>> {
        let kinds = self.batch_check(ids, OBJECT_TYPE, LazyFetch::Refused)?;
        Ok(ids
            .iter()
            .zip(kinds)
            .filter_map(|(id, kind)| (kind != COMMIT).then(|| id.clone()))
            .collect())
    }

    /// One `git cat-file --batch-check='%(objectname) <fields>' --buffer` run over `ids`: for each id, in the order
    /// given, what git printed after it (`<fields>`, or `missing`); no run for no ids.
    pub(crate) fn batch_check(
        &self,
        ids: &[Oid],
        fields: &str,
        lazy_fetch: LazyFetch,
    ) -> Result<Vec<String>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut input = Vec::new();
        for id in ids {
            input.extend_from_slice(id.as_str().as_bytes());
            input.push(b'\n');
        }
        let format = format!("--batch-check=%(objectname) {fields}");
        let mut command = self.command(Access::Read, &[CAT_FILE, &format, "--buffer"]);
        match lazy_fetch {
            LazyFetch::Allowed => {}
            LazyFetch::Refused => refuse_lazy_fetch(&mut command),
        }
        let output = run(command, Some(input), GIT_TIMEOUT)?;
        answers_in(ids, &output)
    }
}

/// Makes `command` fail on an object a partial clone lacks instead of fetching it from the promisor remote
/// (git(1) "ENVIRONMENT" `GIT_NO_LAZY_FETCH`, git 2.45+; an older git ignores it and fetches).
pub(crate) fn refuse_lazy_fetch(command: &mut Command) {
    command.env("GIT_NO_LAZY_FETCH", "1");
}

/// git-cat-file(1) BATCH OUTPUT: one line per id in input order, `<id> SP <fields>` for an object that exists and
/// `<id> SP missing` for one that does not.
fn answers_in(ids: &[Oid], output: &[u8]) -> Result<Vec<String>> {
    let text = String::from_utf8_lossy(output);
    let lines: Vec<&str> = text.lines().collect();
    if lines.len() != ids.len() {
        return Err(unexpected(&text));
    }
    let mut answers = Vec::new();
    for (id, line) in ids.iter().zip(lines) {
        let answer = line
            .strip_prefix(id.as_str())
            .and_then(|rest| rest.strip_prefix(' '))
            .ok_or_else(|| unexpected(&text))?;
        answers.push(answer.to_owned());
    }
    Ok(answers)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Error;

    fn oid(digit: char) -> Oid {
        Oid::parse(&digit.to_string().repeat(40)).unwrap()
    }

    #[test]
    fn each_answer_is_what_git_printed_after_its_id_in_the_order_given() {
        let ids = [oid('1'), oid('2'), oid('3')];
        let output = format!(
            "{} commit\n{} missing\n{} blob 3\n",
            ids[0].as_str(),
            ids[1].as_str(),
            ids[2].as_str()
        );

        let answers = answers_in(&ids, output.as_bytes()).unwrap();

        assert_eq!(answers, ["commit", "missing", "blob 3"]);
    }

    #[test]
    fn a_line_for_another_id_or_a_line_too_few_or_too_many_is_unexpected() {
        let ids = [oid('1'), oid('2')];
        let swapped = format!("{} commit\n{} commit\n", ids[1].as_str(), ids[0].as_str());
        let short = format!("{} commit\n", ids[0].as_str());
        let long = format!("{short}{} commit\n{short}", ids[1].as_str());
        let glued = format!("{}commit\n{} commit\n", ids[0].as_str(), ids[1].as_str());

        for output in [swapped, short, long, glued] {
            assert!(
                matches!(
                    answers_in(&ids, output.as_bytes()),
                    Err(Error::UnexpectedOutput {
                        command: CAT_FILE,
                        ..
                    })
                ),
                "{output}"
            );
        }
    }
}
