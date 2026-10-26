//! A framed test server for this crate's tests: writes `lsp-echo pid <pid>` on stderr, then answers
//! each message with the same text and writes one stderr line per message. With `--ignore-stop` it
//! keeps running after its stdin closes.
use std::io::{self, BufRead, Read, Write};
use std::time::Duration;
use std::{env, process, thread};

const IGNORE_STOP: &str = "--ignore-stop";
const IDLE: Duration = Duration::from_secs(60);

fn main() -> io::Result<()> {
    let ignores_stop = env::args().nth(1).as_deref() == Some(IGNORE_STOP);
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
    out.write_all(format!("Content-Length: {}\r\n\r\n", message.len()).as_bytes())?;
    out.write_all(message.as_bytes())?;
    out.flush()
}
