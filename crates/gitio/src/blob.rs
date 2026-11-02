use std::io::{self, BufRead, BufReader, Read, Write};
use std::process::{Child, ChildStdout, Command, Stdio};

use crate::objects::LazyFetch;
use crate::repo::Repo;
use crate::run::argv;
use crate::{Error, Oid, Result};

pub(crate) const CAT_FILE: &str = "cat-file";
const BLOB: &str = "blob";
const TYPE_AND_SIZE: &str = "%(objecttype) %(objectsize)";

impl Repo {
    /// one `git cat-file --batch-check` run over all ids; answers in input order; None = missing; a gitlink id is never asked
    pub fn blob_sizes(&self, oids: &[Oid]) -> Result<Vec<Option<u64>>> {
        let answers = self.batch_check(oids, TYPE_AND_SIZE, LazyFetch::Allowed)?;
        answers.iter().map(|answer| blob_size(answer)).collect()
    }
}

// git-cat-file(1) BATCH OUTPUT after the id: `<type> SP <size>`, or `missing`.
fn blob_size(answer: &str) -> Result<Option<u64>> {
    let fields: Vec<&str> = answer.split(' ').collect();
    match fields.as_slice() {
        ["missing"] => Ok(None),
        [BLOB, size] => size.parse().map(Some).map_err(|_| unexpected(answer)),
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

pub(crate) fn unexpected(output: &str) -> Error {
    Error::UnexpectedOutput {
        command: CAT_FILE,
        output: output.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_size_that_is_no_number_or_an_object_that_is_no_blob_is_unexpected_output() {
        for answer in ["blob three", "tree 3", "blob", "blob 3 extra"] {
            let error = blob_size(answer).unwrap_err();

            assert!(
                matches!(error, Error::UnexpectedOutput { .. }),
                "{answer}: {error:?}"
            );
        }
    }
}
