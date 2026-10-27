use std::io::{self, BufRead, Read, Write};

/// The largest message either framing passes on: 64 MiB.
pub const MAX_MESSAGE_BYTES: usize = 64 * 1024 * 1024;
const MAX_LOG_LINE_BYTES: usize = 8 * 1024;
const MAX_HEADER_LINE_BYTES: usize = 8 * 1024;
const CONTENT_LENGTH: &str = "content-length";

/// How messages are cut on the program's stdin and stdout.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Framing {
    /// A `Content-Length` header, a blank line, then the body (the Language Server Protocol's base protocol).
    ContentLength,
    /// One message per line, ended by `\n`.
    Lines,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Frame {
    Message(String),
    End,
    TooLarge { bytes: u64 },
    Broken { reason: String },
    Dropped(DropReason),
}

/// Why a `Lines` message was dropped while reading went on.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum DropReason {
    TooLong,
    NotUtf8,
}

pub(crate) fn write_message(
    out: &mut impl Write,
    framing: Framing,
    message: &str,
) -> io::Result<()> {
    let framed = match framing {
        Framing::ContentLength => format!("Content-Length: {}\r\n\r\n{message}", message.len()),
        Framing::Lines => format!("{message}\n"),
    };
    out.write_all(framed.as_bytes())?;
    out.flush()
}

pub(crate) fn read_message(reader: &mut impl BufRead, framing: Framing) -> Frame {
    match framing {
        Framing::ContentLength => read_frame(reader),
        Framing::Lines => read_line_message(reader),
    }
}

fn read_frame(reader: &mut impl BufRead) -> Frame {
    let length = match content_length(reader) {
        Ok(Some(length)) => length,
        Ok(None) => return Frame::End,
        Err(reason) => return Frame::Broken { reason },
    };
    if !usize::try_from(length).is_ok_and(|length| length <= MAX_MESSAGE_BYTES) {
        return Frame::TooLarge { bytes: length };
    }
    let mut body = Vec::new();
    match reader.take(length).read_to_end(&mut body) {
        Ok(read) if u64::try_from(read) == Ok(length) => {}
        Ok(_) => return broken("the output ended inside a message"),
        Err(error) => return broken(&error.to_string()),
    }
    match String::from_utf8(body) {
        Ok(text) => Frame::Message(text),
        Err(_) => broken("a message is not UTF-8"),
    }
}

/// `Ok(None)`: the output ended before a frame began.
fn content_length(reader: &mut impl BufRead) -> Result<Option<u64>, String> {
    let mut length = None;
    let mut started = false;
    loop {
        let line = match bounded_line(reader, MAX_HEADER_LINE_BYTES) {
            Ok(Some(line)) if line.cut => return Err("a header line is too long".to_owned()),
            Ok(Some(line)) => line.into_text(),
            Ok(None) if started => return Err("the output ended inside a header".to_owned()),
            Ok(None) => return Ok(None),
            Err(error) => return Err(error.to_string()),
        };
        started = true;
        if line.is_empty() {
            return length
                .map(Some)
                .ok_or_else(|| "a header has no Content-Length".to_owned());
        }
        if let Some((name, value)) = line.split_once(':')
            && name.trim().eq_ignore_ascii_case(CONTENT_LENGTH)
        {
            let parsed = value.trim().parse::<u64>();
            length = Some(parsed.map_err(|_| format!("Content-Length `{}`", value.trim()))?);
        }
    }
}

/// The next non-empty line; a line over `MAX_MESSAGE_BYTES` or not UTF-8 is `Dropped`, and the
/// following read starts at the next line.
fn read_line_message(reader: &mut impl BufRead) -> Frame {
    loop {
        let line = match bounded_line(reader, MAX_MESSAGE_BYTES + 1) {
            Ok(Some(line)) => line,
            Ok(None) => return Frame::End,
            Err(error) => return broken(&error.to_string()),
        };
        let cut = line.cut;
        let bytes = line.into_message();
        if cut || bytes.len() > MAX_MESSAGE_BYTES {
            return Frame::Dropped(DropReason::TooLong);
        }
        if bytes.is_empty() {
            continue;
        }
        return match String::from_utf8(bytes) {
            Ok(text) => Frame::Message(text),
            Err(_) => Frame::Dropped(DropReason::NotUtf8),
        };
    }
}

fn broken(reason: &str) -> Frame {
    Frame::Broken {
        reason: reason.to_owned(),
    }
}

/// One stderr line without its line break, cut at `MAX_LOG_LINE_BYTES`; `None` at the end.
pub(crate) fn log_line(reader: &mut impl BufRead) -> io::Result<Option<String>> {
    Ok(bounded_line(reader, MAX_LOG_LINE_BYTES)?.map(Line::into_text))
}

/// The bytes before a `\n`, at most the reader's `max`; `cut` when more were dropped.
struct Line {
    bytes: Vec<u8>,
    cut: bool,
}

impl Line {
    /// A cut line keeps its last byte: the `\r` was not its end.
    fn into_message(mut self) -> Vec<u8> {
        if !self.cut && self.bytes.last() == Some(&b'\r') {
            self.bytes.pop();
        }
        self.bytes
    }

    fn into_text(self) -> String {
        String::from_utf8_lossy(&self.into_message()).into_owned()
    }
}

/// Reads up to the next `\n` and drops what lies past `max` bytes, so a line without an end
/// never grows memory.
fn bounded_line(reader: &mut impl BufRead, max: usize) -> io::Result<Option<Line>> {
    let mut bytes = Vec::new();
    let mut read_any = false;
    let mut cut = false;
    loop {
        let available = reader.fill_buf()?;
        if available.is_empty() {
            return Ok(read_any.then_some(Line { bytes, cut }));
        }
        read_any = true;
        let newline = available.iter().position(|byte| *byte == b'\n');
        let content = &available[..newline.unwrap_or(available.len())];
        let room = max - bytes.len();
        cut |= content.len() > room;
        bytes.extend_from_slice(&content[..content.len().min(room)]);
        let consumed = newline.map_or(available.len(), |at| at + 1);
        reader.consume(consumed);
        if newline.is_some() {
            return Ok(Some(Line { bytes, cut }));
        }
    }
}

#[cfg(test)]
mod tests {
    use std::io::{BufReader, Read};

    use super::*;

    struct OneByteAtATime<'a>(&'a [u8]);

    impl Read for OneByteAtATime<'_> {
        fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
            let Some((first, rest)) = self.0.split_first() else {
                return Ok(0);
            };
            buffer[0] = *first;
            self.0 = rest;
            Ok(1)
        }
    }

    fn framed(framing: Framing, message: &str) -> Vec<u8> {
        let mut bytes = Vec::new();
        write_message(&mut bytes, framing, message).unwrap();
        bytes
    }

    fn message(text: &str) -> Frame {
        Frame::Message(text.to_owned())
    }

    #[test]
    fn a_written_frame_counts_bytes_not_characters() {
        let bytes = framed(Framing::ContentLength, "é");
        assert_eq!(bytes, "Content-Length: 2\r\n\r\né".as_bytes());
    }

    #[test]
    fn a_written_line_is_the_message_and_one_line_feed() {
        assert_eq!(
            framed(Framing::Lines, "{\"a\":\"é\"}"),
            "{\"a\":\"é\"}\n".as_bytes()
        );
    }

    #[test]
    fn frames_read_back_whole_also_one_byte_at_a_time() {
        let bytes = [
            framed(Framing::ContentLength, "{\"a\":\"世界\"}"),
            framed(Framing::ContentLength, ""),
        ]
        .concat();
        let mut reader = BufReader::new(OneByteAtATime(&bytes));
        let mut next = || read_message(&mut reader, Framing::ContentLength);
        assert_eq!(next(), message("{\"a\":\"世界\"}"));
        assert_eq!(next(), message(""));
        assert_eq!(next(), Frame::End);
    }

    #[test]
    fn header_names_are_case_insensitive_and_other_headers_are_ignored() {
        let bytes = b"Content-Type: x\r\ncontent-LENGTH:  3 \r\n\r\nabcContent-Length: 1\n\nd";
        let mut reader = &bytes[..];
        assert_eq!(read_frame(&mut reader), message("abc"));
        assert_eq!(read_frame(&mut reader), message("d"));
    }

    #[test]
    fn a_length_above_64_mib_is_too_large_and_64_mib_is_read() {
        let too_large = b"Content-Length: 67108865\r\n\r\n";
        assert_eq!(
            read_frame(&mut &too_large[..]),
            Frame::TooLarge { bytes: 67_108_865 }
        );
        let at_limit = b"Content-Length: 67108864\r\n\r\n";
        let Frame::Broken { reason } = read_frame(&mut &at_limit[..]) else {
            panic!("a 64 MiB length was refused");
        };
        assert_eq!(reason, "the output ended inside a message");
    }

    #[test]
    fn broken_frames_say_why() {
        let cases: [(&[u8], &str); 5] = [
            (b"Content-Type: x\r\n\r\n", "a header has no Content-Length"),
            (b"Content-Length: many\r\n\r\n", "Content-Length `many`"),
            (b"Content-Length: 1\r\n", "the output ended inside a header"),
            (
                b"Content-Length: 2\r\n\r\na",
                "the output ended inside a message",
            ),
            (b"Content-Length: 1\r\n\r\n\xff", "a message is not UTF-8"),
        ];
        for (bytes, reason) in cases {
            assert_eq!(read_frame(&mut &bytes[..]), broken(reason), "{bytes:?}");
        }
    }

    #[test]
    fn a_header_line_of_8_kib_is_read_and_a_longer_one_is_broken() {
        let header_line = |bytes: usize| format!("X: {}\r\n", "x".repeat(bytes - "X: \r".len()));
        let accepted = format!("{}Content-Length: 1\r\n\r\na", header_line(8192));
        assert_eq!(read_frame(&mut accepted.as_bytes()), message("a"));
        let refused = format!("{}Content-Length: 1\r\n\r\na", header_line(8193));
        let expected = broken("a header line is too long");
        assert_eq!(read_frame(&mut refused.as_bytes()), expected);
    }

    #[test]
    fn log_lines_lose_their_line_break_and_a_long_one_is_cut_at_8_kib() {
        let long = "y".repeat(8 * 1024 + 5);
        let bytes = format!("first\r\n{long}\nlast");
        let mut reader = BufReader::new(OneByteAtATime(bytes.as_bytes()));
        assert_eq!(log_line(&mut reader).unwrap(), Some("first".to_owned()));
        let cut = log_line(&mut reader).unwrap().unwrap();
        assert_eq!(cut, "y".repeat(8192));
        assert_eq!(log_line(&mut reader).unwrap(), Some("last".to_owned()));
        assert_eq!(log_line(&mut reader).unwrap(), None);
    }

    #[test]
    fn a_log_line_cut_right_after_a_carriage_return_keeps_it() {
        let bytes = format!("{}\r{}\n", "y".repeat(MAX_LOG_LINE_BYTES - 1), "z");
        let line = log_line(&mut bytes.as_bytes()).unwrap().unwrap();
        assert_eq!(line, format!("{}\r", "y".repeat(MAX_LOG_LINE_BYTES - 1)));
    }

    #[test]
    fn lines_read_back_one_byte_at_a_time_without_their_line_ends() {
        let bytes = "{\"a\":\"世界\"}\r\n\n\r\nsecond\nlast without an end";
        let mut reader = BufReader::new(OneByteAtATime(bytes.as_bytes()));
        let mut next = || read_message(&mut reader, Framing::Lines);
        assert_eq!(next(), message("{\"a\":\"世界\"}"));
        assert_eq!(next(), message("second"));
        assert_eq!(next(), message("last without an end"));
        assert_eq!(next(), Frame::End);
    }

    #[test]
    fn a_carriage_return_inside_a_line_stays() {
        let mut reader = &b"a\rb\r\r\n"[..];
        assert_eq!(read_line_message(&mut reader), message("a\rb\r"));
    }

    #[test]
    fn a_line_that_is_not_utf8_is_dropped_and_the_next_one_is_read() {
        let mut reader = &b"\xff\xfe\nafter\n"[..];
        let expected = Frame::Dropped(DropReason::NotUtf8);
        assert_eq!(read_line_message(&mut reader), expected);
        assert_eq!(read_line_message(&mut reader), message("after"));
    }

    #[test]
    fn a_line_of_64_mib_is_read_also_with_a_carriage_return_and_a_longer_one_is_dropped() {
        let at_limit = "a".repeat(MAX_MESSAGE_BYTES);
        let over = "b".repeat(MAX_MESSAGE_BYTES + 1);
        let bytes = format!("{at_limit}\r\n{over}\r\n{over}\nafter\n");
        let mut reader = bytes.as_bytes();
        let too_long = Frame::Dropped(DropReason::TooLong);
        assert_eq!(read_line_message(&mut reader), Frame::Message(at_limit));
        assert_eq!(read_line_message(&mut reader), too_long);
        assert_eq!(read_line_message(&mut reader), too_long);
        assert_eq!(read_line_message(&mut reader), message("after"));
    }
}
