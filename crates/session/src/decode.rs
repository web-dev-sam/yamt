use std::path::Path;

use serde::Serialize;
use specta::Type;

// git's binary heuristic: a NUL within the first 8000 bytes (xdiff-interface.c FIRST_FEW_BYTES).
const BINARY_PROBE_LEN: usize = 8000;
const MAX_TEXT_BYTES: usize = 8 * 1024 * 1024;
const TYPESCRIPT_EXTENSIONS: [&str; 4] = ["ts", "tsx", "mts", "cts"];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub enum Eol {
    Lf,
    CrLf,
    Mixed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub enum UnsupportedReason {
    Binary,
    NonUtf8,
    TooLarge,
    LocalDeleted,
    RemoteDeleted,
}

pub(crate) fn decode_side(bytes: Vec<u8>) -> Result<String, UnsupportedReason> {
    let probe = bytes.get(..BINARY_PROBE_LEN).unwrap_or(&bytes);
    if probe.contains(&b'\0') {
        return Err(UnsupportedReason::Binary);
    }
    if bytes.len() > MAX_TEXT_BYTES {
        return Err(UnsupportedReason::TooLarge);
    }
    String::from_utf8(bytes).map_err(|_| UnsupportedReason::NonUtf8)
}

pub(crate) fn detect_eol(text: &str) -> Eol {
    let line_breaks = text.matches('\n').count();
    let crlf_breaks = text.matches("\r\n").count();
    if crlf_breaks == 0 {
        Eol::Lf
    } else if crlf_breaks == line_breaks {
        Eol::CrLf
    } else {
        Eol::Mixed
    }
}

pub(crate) fn language_of(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_str()?;
    if TYPESCRIPT_EXTENSIONS.contains(&extension) {
        Some("typescript".to_owned())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn eol_is_crlf_only_when_every_line_break_is_crlf() {
        assert_eq!(detect_eol(""), Eol::Lf);
        assert_eq!(detect_eol("a\nb"), Eol::Lf);
        assert_eq!(detect_eol("a\r\nb\r\n"), Eol::CrLf);
        assert_eq!(detect_eol("a\r\nb\n"), Eol::Mixed);
        assert_eq!(detect_eol("a\rb\n"), Eol::Lf);
    }

    #[test]
    fn nul_after_the_probe_window_is_still_text() {
        let mut bytes = vec![b'a'; BINARY_PROBE_LEN];
        bytes.push(b'\0');
        assert!(decode_side(bytes).is_ok());
        let mut bytes = vec![b'a'; BINARY_PROBE_LEN - 1];
        bytes.push(b'\0');
        assert_eq!(decode_side(bytes), Err(UnsupportedReason::Binary));
    }
}
