//! A line-framed test program for this crate's tests: writes `line-echo pid <pid>` on stderr, then
//! answers each line with the same line. `stderr <text>` writes `text` on stderr instead;
//! `exit <code>` exits with that code; `huge` writes one line over `MAX_MESSAGE_BYTES`, then
//! `after`; `bytes` writes a line that is not UTF-8, then `after`; `split <text>` answers in two
//! writes; `twice <text>` answers two lines in one write; `crlf <text>` answers with a `\r\n` line
//! end. With `--ignore-stop` it keeps running after its stdin closes.
//!
//! Commands that outlive or change the process: `burst <n>` exits 0 while a copy of it writes `n`
//! stderr lines a moment later; `orphan` exits 3 while a sleeping copy holds its stdout and stderr;
//! `close-stderr` / `close-stdout` (unix) replace it with a copy whose stderr / stdout is closed,
//! which keeps reading lines (the first answers `stderr closed`).
use std::io::{self, BufRead, Write};
use std::process::{Command, Stdio};
use std::time::Duration;
use std::{env, process, thread};

const IGNORE_STOP: &str = "--ignore-stop";
const LATE_BURST: &str = "--late-burst";
const HOLD: &str = "--hold";
const STDERR_CLOSED: &str = "--stderr-closed";
const STDOUT_CLOSED: &str = "--stdout-closed";
const HUGE_LINE_BYTES: usize = yamt_pipe::MAX_MESSAGE_BYTES + 1;
const NOT_UTF8: &[u8] = b"\xff\xfe";
const SPLIT_PAUSE: Duration = Duration::from_millis(50);
const BURST_PAUSE: Duration = Duration::from_millis(200);
const HOLD_PIPES: Duration = Duration::from_secs(5);
const IDLE: Duration = Duration::from_secs(60);
const ORPHAN_EXIT_CODE: i32 = 3;
const BURST_PADDING: usize = 40;

fn main() -> io::Result<()> {
    let args: Vec<String> = env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some(LATE_BURST) => {
            thread::sleep(BURST_PAUSE);
            write_burst(
                args.get(1)
                    .and_then(|count| count.parse().ok())
                    .unwrap_or(0),
            );
            Ok(())
        }
        Some(HOLD) => {
            thread::sleep(HOLD_PIPES);
            Ok(())
        }
        Some(STDERR_CLOSED) => {
            write_out(b"stderr closed\n")?;
            serve(false)
        }
        Some(IGNORE_STOP) => serve(true),
        Some(_) | None => serve(false),
    }
}

fn serve(ignores_stop: bool) -> io::Result<()> {
    eprintln!("line-echo pid {}", process::id());
    let input = io::stdin().lock();
    for line in input.lines() {
        answer(&line?)?;
    }
    if ignores_stop {
        loop {
            thread::sleep(IDLE);
        }
    }
    Ok(())
}

fn write_burst(lines: usize) {
    let padding = "-".repeat(BURST_PADDING);
    for line in 0..lines {
        eprintln!("line-echo burst {line} {padding}");
    }
}

fn answer(line: &str) -> io::Result<()> {
    if let Some(text) = line.strip_prefix("stderr ") {
        eprintln!("{text}");
        Ok(())
    } else if let Some(code) = line.strip_prefix("exit ") {
        process::exit(code.trim().parse().unwrap_or(1));
    } else if line == "huge" {
        let mut huge = vec![b'x'; HUGE_LINE_BYTES];
        huge.extend_from_slice(b"\nafter\n");
        write_out(&huge)
    } else if line == "bytes" {
        write_out(&[NOT_UTF8, b"\nafter\n"].concat())
    } else if let Some(text) = line.strip_prefix("split ") {
        let (first, second) = text.as_bytes().split_at(text.len() / 2);
        write_out(first)?;
        thread::sleep(SPLIT_PAUSE);
        write_out(&[second, b"\n"].concat())
    } else if let Some(text) = line.strip_prefix("twice ") {
        write_out(format!("{text}\n{text}\n").as_bytes())
    } else if let Some(text) = line.strip_prefix("crlf ") {
        write_out(format!("{text}\r\n").as_bytes())
    } else if let Some(lines) = line.strip_prefix("burst ") {
        spawn_copy(&[LATE_BURST, lines.trim()], Stdio::null())?;
        process::exit(0);
    } else if line == "orphan" {
        spawn_copy(&[HOLD], Stdio::inherit())?;
        process::exit(ORPHAN_EXIT_CODE);
    } else if line == "close-stderr" {
        replace_with(STDERR_CLOSED, |command| command.stderr(Stdio::null()))
    } else if line == "close-stdout" {
        replace_with(STDOUT_CLOSED, |command| command.stdout(Stdio::null()))
    } else {
        write_out(format!("{line}\n").as_bytes())
    }
}

fn write_out(bytes: &[u8]) -> io::Result<()> {
    let mut out = io::stdout().lock();
    out.write_all(bytes)?;
    out.flush()
}

/// A copy with no stdin and this process's stderr.
fn spawn_copy(args: &[&str], stdout: Stdio) -> io::Result<()> {
    Command::new(env::current_exe()?)
        .args(args)
        .stdin(Stdio::null())
        .stdout(stdout)
        .spawn()?;
    Ok(())
}

#[cfg(unix)]
fn replace_with(arg: &str, close: impl FnOnce(&mut Command) -> &mut Command) -> io::Result<()> {
    use std::os::unix::process::CommandExt;
    let mut command = Command::new(env::current_exe()?);
    Err(close(command.arg(arg)).exec())
}

#[cfg(not(unix))]
fn replace_with(_arg: &str, _close: impl FnOnce(&mut Command) -> &mut Command) -> io::Result<()> {
    Err(io::Error::other("closing a pipe needs unix"))
}
