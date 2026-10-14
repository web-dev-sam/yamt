use std::io::{self, BufRead, Read, Write};

pub(crate) const MAX_MESSAGE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_LOG_LINE_BYTES: usize = 8 * 1024;
const MAX_HEADER_LINE_BYTES: usize = 8 * 1024;
const CONTENT_LENGTH: &str = "content-length";

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Frame {
    Message(String),
    End,
    TooLarge { bytes: u64 },
    Broken { reason: String },
}

pub(crate) fn write_frame(out: &mut impl Write, message: &str) -> io::Result<()> {
    let mut frame = format!("Content-Length: {}\r\n\r\n", message.len()).into_bytes();
    frame.extend_from_slice(message.as_bytes());
    out.write_all(&frame)?;
    out.flush()
}

pub(crate) fn read_frame(reader: &mut impl BufRead) -> Frame {
    let length = match content_length(reader) {
        Ok(Some(length)) => length,
        Ok(None) => return Frame::End,
        Err(reason) => return Frame::Broken { reason },
    };
    if length > MAX_MESSAGE_BYTES {
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
            Ok(Some(line)) => line.text,
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

fn broken(reason: &str) -> Frame {
    Frame::Broken {
        reason: reason.to_owned(),
    }
}

/// One stderr line without its line break, cut at `MAX_LOG_LINE_BYTES`; `None` at the end.
pub(crate) fn log_line(reader: &mut impl BufRead) -> io::Result<Option<String>> {
    Ok(bounded_line(reader, MAX_LOG_LINE_BYTES)?.map(|line| line.text))
}

struct Line {
    text: String,
    cut: bool,
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
            return Ok(read_any.then(|| line_of(bytes, cut)));
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
            return Ok(Some(line_of(bytes, cut)));
        }
    }
}

fn line_of(mut bytes: Vec<u8>, cut: bool) -> Line {
    if !cut && bytes.last() == Some(&b'\r') {
        bytes.pop();
    }
    Line {
        text: String::from_utf8_lossy(&bytes).into_owned(),
        cut,
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

    fn framed(message: &str) -> Vec<u8> {
        let mut bytes = Vec::new();
        write_frame(&mut bytes, message).unwrap();
        bytes
    }

    #[test]
    fn a_written_frame_counts_bytes_not_characters() {
        assert_eq!(framed("é"), "Content-Length: 2\r\n\r\né".as_bytes());
    }

    #[test]
    fn frames_read_back_whole_also_one_byte_at_a_time() {
        let bytes = [framed("{\"a\":\"世界\"}"), framed("")].concat();
        let mut reader = BufReader::new(OneByteAtATime(&bytes));
        assert_eq!(
            read_frame(&mut reader),
            Frame::Message("{\"a\":\"世界\"}".to_owned())
        );
        assert_eq!(read_frame(&mut reader), Frame::Message(String::new()));
        assert_eq!(read_frame(&mut reader), Frame::End);
    }

    #[test]
    fn header_names_are_case_insensitive_and_other_headers_are_ignored() {
        let bytes = b"Content-Type: x\r\ncontent-LENGTH:  3 \r\n\r\nabcContent-Length: 1\n\nd";
        let mut reader = &bytes[..];
        assert_eq!(read_frame(&mut reader), Frame::Message("abc".to_owned()));
        assert_eq!(read_frame(&mut reader), Frame::Message("d".to_owned()));
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
            let expected = Frame::Broken {
                reason: reason.to_owned(),
            };
            assert_eq!(read_frame(&mut &bytes[..]), expected, "{bytes:?}");
        }
    }

    #[test]
    fn a_header_line_of_8_kib_is_read_and_a_longer_one_is_broken() {
        let header_line = |bytes: usize| format!("X: {}\r\n", "x".repeat(bytes - "X: \r".len()));
        let accepted = format!("{}Content-Length: 1\r\n\r\na", header_line(8192));
        assert_eq!(
            read_frame(&mut accepted.as_bytes()),
            Frame::Message("a".to_owned())
        );
        let refused = format!("{}Content-Length: 1\r\n\r\na", header_line(8193));
        let expected = broken("a header line is too long");
        assert_eq!(read_frame(&mut refused.as_bytes()), expected);
    }

    #[test]
    fn log_lines_lose_their_line_break_and_a_long_one_is_cut_at_8_kib() {
        let long = "y".repeat(MAX_LOG_LINE_BYTES + 5);
        let bytes = format!("first\r\n{long}\nlast");
        let mut reader = BufReader::new(OneByteAtATime(bytes.as_bytes()));
        assert_eq!(log_line(&mut reader).unwrap(), Some("first".to_owned()));
        let cut = log_line(&mut reader).unwrap().unwrap();
        assert_eq!(cut, "y".repeat(MAX_LOG_LINE_BYTES));
        assert_eq!(log_line(&mut reader).unwrap(), Some("last".to_owned()));
        assert_eq!(log_line(&mut reader).unwrap(), None);
    }
}
