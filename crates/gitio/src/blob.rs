use std::io::{self, BufRead, BufReader, Read, Write};
use std::process::{Child, ChildStdout, Command, Stdio};

use crate::repo::Repo;
use crate::run::{Access, GIT_TIMEOUT, argv, run};
use crate::{Error, Oid, Result};

pub(crate) const CAT_FILE: &str = "cat-file";
const BLOB: &str = "blob";

impl Repo {
    /// one `git cat-file --batch-check` run over all ids; answers in input order; None = missing; a gitlink id is never asked
    pub fn blob_sizes(&self, oids: &[Oid]) -> Result<Vec<Option<u64>>> {
        if oids.is_empty() {
            return Ok(Vec::new());
        }
        let mut input = String::new();
        for oid in oids {
            input.push_str(oid.as_str());
            input.push('\n');
        }
        let command = self.command(Access::Read, &[CAT_FILE, "--batch-check", "--buffer"]);
        let output = run(command, Some(input.into_bytes()), GIT_TIMEOUT)?;
        let text = String::from_utf8_lossy(&output);
        let answers: Vec<&str> = text.lines().collect();
        if answers.len() != oids.len() {
            return Err(unexpected(&text));
        }
        oids.iter()
            .zip(answers)
            .map(|(oid, answer)| blob_size(oid, answer))
            .collect()
    }
}

// git-cat-file(1) BATCH OUTPUT: `<oid> SP <type> SP <size> LF`, or `<object> SP missing LF`.
fn blob_size(oid: &Oid, answer: &str) -> Result<Option<u64>> {
    let fields: Vec<&str> = answer.split(' ').collect();
    match fields.as_slice() {
        [named, "missing"] if *named == oid.as_str() => Ok(None),
        [named, BLOB, size] if *named == oid.as_str() => {
            size.parse().map(Some).map_err(|_| unexpected(answer))
        }
        _ => Err(unexpected(answer)),
    }
}

pub struct BlobReader {
    child: Child,
    stdout: BufReader<ChildStdout>,
}

impl BlobReader {
    pub(crate) fn spawn(mut command: Command) -> Result<BlobReader> {
        tracing::debug!(args = ?argv(&command), "spawning git");
        let mut child = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()?;
        let stdout = child.stdout.take().ok_or_else(closed_pipe)?;
        Ok(BlobReader {
            child,
            stdout: BufReader::new(stdout),
        })
    }

    pub fn read(&mut self, oid: &Oid) -> Result<Vec<u8>> {
        let stdin = self.child.stdin.as_mut().ok_or_else(closed_pipe)?;
        stdin.write_all(format!("{}\n", oid.as_str()).as_bytes())?;
        stdin.flush()?;
        let header = self.read_header()?;
        let fields: Vec<&str> = header.split(' ').collect();
        match fields.as_slice() {
            [_, "missing"] => Err(Error::BlobMissing { oid: oid.clone() }),
            [_, kind, size] => {
                let size = size.parse().map_err(|_| unexpected(&header))?;
                let content = self.read_content_and_newline(size)?;
                if *kind == BLOB {
                    Ok(content)
                } else {
                    Err(unexpected(&header))
                }
            }
            _ => Err(unexpected(&header)),
        }
    }

    fn read_header(&mut self) -> Result<String> {
        let mut line = Vec::new();
        self.stdout.read_until(b'\n', &mut line)?;
        if line.pop() != Some(b'\n') {
            return Err(unexpected(&String::from_utf8_lossy(&line)));
        }
        Ok(String::from_utf8_lossy(&line).into_owned())
    }

    fn read_content_and_newline(&mut self, size: usize) -> Result<Vec<u8>> {
        let mut content = vec![0; size + 1];
        self.stdout.read_exact(&mut content)?;
        if content.pop() != Some(b'\n') {
            return Err(unexpected("blob content not followed by a newline"));
        }
        Ok(content)
    }
}

impl Drop for BlobReader {
    fn drop(&mut self) {
        drop(self.child.stdin.take());
        if let Err(error) = self.child.wait() {
            tracing::warn!(%error, "git cat-file did not exit cleanly");
        }
    }
}

fn closed_pipe() -> io::Error {
    io::Error::from(io::ErrorKind::BrokenPipe)
}

fn unexpected(output: &str) -> Error {
    Error::UnexpectedOutput {
        command: CAT_FILE,
        output: output.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(digit: char) -> String {
        digit.to_string().repeat(40)
    }

    #[test]
    fn an_answer_naming_another_id_is_unexpected_output() {
        let asked = Oid::parse(&hex('a')).unwrap();
        let other = hex('b');

        for answer in [format!("{other} blob 3"), format!("{other} missing")] {
            let error = blob_size(&asked, &answer).unwrap_err();

            assert!(
                matches!(error, Error::UnexpectedOutput { .. }),
                "{answer}: {error:?}"
            );
        }
    }
}
