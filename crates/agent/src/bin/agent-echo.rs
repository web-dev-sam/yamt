//! A line-framed test agent for this crate's tests: answers each line with the same line. `pwd` answers its
//! working folder; `edit <file>` appends a line to that file and answers `edited <file>`; `exit <code>` exits
//! with that code; `hold <file>` keeps that file open, answers `holding <file>`, and once stdin closes waits a
//! moment, writes `released` into it (making its folder again if it is gone) and exits.
use std::fs::{self, File, OpenOptions};
use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use std::time::Duration;
use std::{env, process, thread};

const HOLD_RELEASE: Duration = Duration::from_millis(300);
const EDITED_LINE: &[u8] = b"edited by agent-echo\n";
const RELEASED: &[u8] = b"released\n";

struct Held {
    path: PathBuf,
    _file: File,
}

fn main() -> io::Result<()> {
    let mut held = None;
    for line in io::stdin().lock().lines() {
        let line = line?;
        if let Some(file) = line.strip_prefix("hold ") {
            held = Some(hold(file)?);
        } else {
            answer(&line)?;
        }
    }
    if let Some(held) = held {
        thread::sleep(HOLD_RELEASE);
        if let Some(folder) = held.path.parent() {
            fs::create_dir_all(folder)?;
        }
        fs::write(&held.path, RELEASED)?;
    }
    Ok(())
}

fn hold(file: &str) -> io::Result<Held> {
    let path = env::current_dir()?.join(file);
    let opened = OpenOptions::new().create(true).append(true).open(&path)?;
    write_out(format!("holding {file}\n").as_bytes())?;
    Ok(Held {
        path,
        _file: opened,
    })
}

fn answer(line: &str) -> io::Result<()> {
    if line == "pwd" {
        let folder = env::current_dir()?;
        write_out(format!("{}\n", folder.display()).as_bytes())
    } else if let Some(file) = line.strip_prefix("edit ") {
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(file)?
            .write_all(EDITED_LINE)?;
        write_out(format!("edited {file}\n").as_bytes())
    } else if let Some(code) = line.strip_prefix("exit ") {
        process::exit(code.trim().parse().unwrap_or(1));
    } else {
        write_out(format!("{line}\n").as_bytes())
    }
}

fn write_out(bytes: &[u8]) -> io::Result<()> {
    let mut out = io::stdout().lock();
    out.write_all(bytes)?;
    out.flush()
}
