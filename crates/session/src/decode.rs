use serde::Serialize;
use specta::Type;

// git's binary heuristic: a NUL within the first 8000 bytes (xdiff-interface.c FIRST_FEW_BYTES).
const BINARY_PROBE_LEN: usize = 8000;
const MAX_TEXT_BYTES: usize = 8 * 1024 * 1024;

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
    Symlink,
    Submodule,
}

pub(crate) fn decode_sides(sides: [Vec<u8>; 3]) -> Result<[String; 3], UnsupportedReason> {
    if sides.iter().any(|side| is_binary(side)) {
        return Err(UnsupportedReason::Binary);
    }
    if sides.iter().any(|side| side.len() > MAX_TEXT_BYTES) {
        return Err(UnsupportedReason::TooLarge);
    }
    let [base, local, remote] = sides;
    Ok([to_text(base)?, to_text(local)?, to_text(remote)?])
}

fn is_binary(bytes: &[u8]) -> bool {
    let probe = bytes.get(..BINARY_PROBE_LEN).unwrap_or(bytes);
    probe.contains(&b'\0')
}

fn to_text(bytes: Vec<u8>) -> Result<String, UnsupportedReason> {
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

    fn decode_one(side: Vec<u8>) -> Result<[String; 3], UnsupportedReason> {
        decode_sides([Vec::new(), side, Vec::new()])
    }

    #[test]
    fn nul_after_the_probe_window_is_still_text() {
        let mut bytes = vec![b'a'; BINARY_PROBE_LEN];
        bytes.push(b'\0');
        assert!(decode_one(bytes).is_ok());
        let mut bytes = vec![b'a'; BINARY_PROBE_LEN - 1];
        bytes.push(b'\0');
        assert_eq!(decode_one(bytes), Err(UnsupportedReason::Binary));
    }

    #[test]
    fn a_side_of_exactly_the_size_limit_decodes_and_one_byte_more_is_too_large() {
        assert!(decode_one(vec![b'a'; MAX_TEXT_BYTES]).is_ok());
        assert_eq!(
            decode_one(vec![b'a'; MAX_TEXT_BYTES + 1]),
            Err(UnsupportedReason::TooLarge)
        );
    }

    #[test]
    fn each_check_runs_across_all_sides_binary_then_too_large_then_non_utf8() {
        let latin1 = b"caf\xe9\n".to_vec();
        let binary = b"\0binary".to_vec();
        let too_large = vec![b'a'; MAX_TEXT_BYTES + 1];
        let binary_after_non_utf8 = [latin1.clone(), binary.clone(), Vec::new()];
        let too_large_after_non_utf8 = [latin1.clone(), Vec::new(), too_large.clone()];
        let binary_after_too_large = [too_large, Vec::new(), binary];
        assert_eq!(
            decode_sides(binary_after_non_utf8),
            Err(UnsupportedReason::Binary)
        );
        assert_eq!(
            decode_sides(too_large_after_non_utf8),
            Err(UnsupportedReason::TooLarge)
        );
        assert_eq!(
            decode_sides(binary_after_too_large),
            Err(UnsupportedReason::Binary)
        );
        assert_eq!(
            decode_sides([Vec::new(), Vec::new(), latin1]),
            Err(UnsupportedReason::NonUtf8)
        );
    }
}
