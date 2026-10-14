//! A framed test server for this crate's tests: answers each message with the same text and writes
//! one stderr line per message. `exit <code>` exits with that code; `twice <text>` answers two
//! frames in one write; `split <text>` answers one frame in two writes. With `--ignore-stop` it
//! keeps running after its stdin closes.
//!
//! Commands that outlive or change the process: `burst <n>` exits 0 while a copy of it writes
//! `n` stderr lines a moment later; `orphan` exits 3 while a sleeping copy holds its stdout and
//! stderr; `close-stderr` (unix) replaces itself with a copy whose stderr is closed, which first
//! answers `stderr closed`.
use std::io::{self, BufRead, Read, Write};
use std::process::{Command, Stdio};
use std::time::Duration;
use std::{env, process, thread};

const IGNORE_STOP: &str = "--ignore-stop";
const LATE_BURST: &str = "--late-burst";
const HOLD: &str = "--hold";
const STDERR_CLOSED: &str = "--stderr-closed";
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
            let mut out = io::stdout().lock();
            out.write_all(&framed("stderr closed"))?;
            out.flush()?;
            drop(out);
            serve(false)
        }
        Some(IGNORE_STOP) => serve(true),
        Some(_) | None => serve(false),
    }
}

fn serve(ignores_stop: bool) -> io::Result<()> {
    eprintln!("lsp-echo pid {}", process::id());
    let mut input = io::stdin().lock();
    while let Some(message) = read_message(&mut input)? {
        eprintln!("lsp-echo got {message}");
        answer(&message)?;
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
        eprintln!("lsp-echo burst {line} {padding}");
    }
}

fn read_message(input: &mut impl BufRead) -> io::Result<Option<String>> {
    let mut length = None;
    loop {
        let mut line = String::new();
        if input.read_line(&mut line)? == 0 {
            return Ok(None);
        }
        let line = line.trim_end();
        if line.is_empty() {
            break;
        }
        if let Some((name, value)) = line.split_once(':')
            && name.eq_ignore_ascii_case("content-length")
        {
            length = value.trim().parse::<u64>().ok();
        }
    }
    let mut body = Vec::new();
    input.take(length.unwrap_or(0)).read_to_end(&mut body)?;
    String::from_utf8(body).map(Some).map_err(io::Error::other)
}

fn answer(message: &str) -> io::Result<()> {
    let mut out = io::stdout().lock();
    if let Some(code) = message.strip_prefix("exit ") {
        process::exit(code.trim().parse().unwrap_or(1));
    } else if let Some(lines) = message.strip_prefix("burst ") {
        spawn_copy(&[LATE_BURST, lines.trim()], Stdio::null())?;
        process::exit(0);
    } else if message == "orphan" {
        spawn_copy(&[HOLD], Stdio::inherit())?;
        process::exit(ORPHAN_EXIT_CODE);
    } else if message == "close-stderr" {
        return close_stderr();
    } else if let Some(text) = message.strip_prefix("twice ") {
        out.write_all(&[framed(text), framed(text)].concat())?;
    } else if let Some(text) = message.strip_prefix("split ") {
        let frame = framed(text);
        let (first, second) = frame.split_at(frame.len() / 2);
        out.write_all(first)?;
        out.flush()?;
        thread::sleep(SPLIT_PAUSE);
        out.write_all(second)?;
    } else {
        out.write_all(&framed(message))?;
    }
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
fn close_stderr() -> io::Result<()> {
    use std::os::unix::process::CommandExt;
    let mut command = Command::new(env::current_exe()?);
    Err(command.arg(STDERR_CLOSED).stderr(Stdio::null()).exec())
}

#[cfg(not(unix))]
fn close_stderr() -> io::Result<()> {
    Err(io::Error::other("close-stderr needs unix"))
}

fn framed(text: &str) -> Vec<u8> {
    [
        format!("Content-Length: {}\r\n\r\n", text.len()).as_bytes(),
        text.as_bytes(),
    ]
    .concat()
}
