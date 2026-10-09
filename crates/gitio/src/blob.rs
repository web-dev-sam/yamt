use std::io::{self, BufRead, BufReader, Read, Write};
use std::process::{Child, ChildStdout, Command, Stdio};

use crate::run::argv;
use crate::{Error, Oid, Result};

const CAT_FILE: &str = "cat-file";

/// One long-lived `git cat-file --batch` process that reads blobs by oid.
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
                if *kind == "blob" {
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
