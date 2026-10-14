//! A framed test server for this crate's tests: answers each message with the same text and writes
//! one stderr line per message. `exit <code>` exits with that code; `twice <text>` answers two
//! frames in one write; `split <text>` answers one frame in two writes. With `--ignore-stop` it
//! keeps running after its stdin closes.
use std::io::{self, BufRead, Read, Write};
use std::time::Duration;
use std::{env, process, thread};

const IGNORE_STOP: &str = "--ignore-stop";
const SPLIT_PAUSE: Duration = Duration::from_millis(50);
const IDLE: Duration = Duration::from_secs(60);

fn main() -> io::Result<()> {
    let ignores_stop = env::args().any(|arg| arg == IGNORE_STOP);
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
    if let Some(code) = message.strip_prefix("exit ") {
        process::exit(code.trim().parse().unwrap_or(1));
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

fn framed(text: &str) -> Vec<u8> {
    [
        format!("Content-Length: {}\r\n\r\n", text.len()).as_bytes(),
        text.as_bytes(),
    ]
    .concat()
}
