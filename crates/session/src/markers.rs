use std::ops::Range;

/// git's `conflict-marker-size` when the attribute is not set (gitattributes(5)).
pub const DEFAULT_MARKER_SIZE: usize = 7;

/// A stretch of a worktree file, as line indexes into `split_lines` of its bytes.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Piece {
    Settled(Range<usize>),
    Block(Block),
    Raw(Range<usize>),
}

/// An open conflict: its lines from `<<<<<<<` to `>>>>>>>`, and the lines of each side's section.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Block {
    pub(crate) whole: Range<usize>,
    pub(crate) ours: Range<usize>,
    pub(crate) theirs: Range<usize>,
}

/// The file as each side would read it: settled lines, raw regions as they are, and each block's
/// section of that side; marker lines, labels and base sections dropped, `\r\n` read as `\n`.
#[derive(Debug, PartialEq, Eq)]
pub(crate) struct Views {
    pub(crate) ours: Vec<u8>,
    pub(crate) theirs: Vec<u8>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Marker {
    Open,
    Base,
    Separator,
    Close,
}

enum InBlock {
    Ours { from: usize },
    Base { ours: Range<usize> },
    Theirs { ours: Range<usize>, from: usize },
}

pub(crate) fn split_lines(text: &[u8]) -> Vec<&[u8]> {
    text.split_inclusive(|&byte| byte == b'\n').collect()
}

pub(crate) fn open_regions(pieces: &[Piece]) -> u32 {
    let open = pieces.iter().filter(|piece| match piece {
        Piece::Settled(_) => false,
        Piece::Block(_) | Piece::Raw(_) => true,
    });
    u32::try_from(open.count()).unwrap_or(u32::MAX)
}

pub(crate) fn parse(lines: &[&[u8]], marker_size: usize) -> Vec<Piece> {
    let mut pieces = Vec::new();
    let mut settled_from = 0;
    let mut at = 0;
    while let Some(line) = lines.get(at) {
        let found = match marker(line, marker_size) {
            Some(Marker::Open) => Some(read_block(lines, at, marker_size)),
            Some(Marker::Close) => Some(Piece::Raw(at..at + 1)),
            Some(Marker::Base | Marker::Separator) | None => None,
        };
        let Some(piece) = found else {
            at += 1;
            continue;
        };
        if settled_from < at {
            pieces.push(Piece::Settled(settled_from..at));
        }
        at = piece_end(&piece);
        settled_from = at;
        pieces.push(piece);
    }
    if settled_from < lines.len() {
        pieces.push(Piece::Settled(settled_from..lines.len()));
    }
    pieces
}

fn piece_end(piece: &Piece) -> usize {
    match piece {
        Piece::Settled(lines) | Piece::Raw(lines) => lines.end,
        Piece::Block(block) => block.whole.end,
    }
}

fn read_block(lines: &[&[u8]], start: usize, marker_size: usize) -> Piece {
    let mut state = InBlock::Ours { from: start + 1 };
    for (at, line) in lines.iter().enumerate().skip(start + 1) {
        let Some(found) = marker(line, marker_size) else {
            continue;
        };
        state = match (state, found) {
            (InBlock::Ours { from }, Marker::Base) => InBlock::Base { ours: from..at },
            (InBlock::Ours { from }, Marker::Separator) => InBlock::Theirs {
                ours: from..at,
                from: at + 1,
            },
            (InBlock::Base { ours }, Marker::Separator) => InBlock::Theirs { ours, from: at + 1 },
            (InBlock::Theirs { ours, from }, Marker::Close) => {
                return Piece::Block(Block {
                    whole: start..at + 1,
                    ours,
                    theirs: from..at,
                });
            }
            (InBlock::Ours { .. } | InBlock::Base { .. }, Marker::Close) => {
                return Piece::Raw(start..at + 1);
            }
            (_, Marker::Open | Marker::Base | Marker::Separator) => {
                return Piece::Raw(start..raw_end(lines, at + 1, marker_size));
            }
        };
    }
    Piece::Raw(start..lines.len())
}

fn raw_end(lines: &[&[u8]], from: usize, marker_size: usize) -> usize {
    for (at, line) in lines.iter().enumerate().skip(from) {
        match marker(line, marker_size) {
            Some(Marker::Close) => return at + 1,
            Some(Marker::Open) => return at,
            Some(Marker::Base | Marker::Separator) | None => {}
        }
    }
    lines.len()
}

// git rerere.c `is_cmarker`: exactly `marker_size` copies of the marker character, then a space,
// or the end of the line.
fn marker(line: &[u8], marker_size: usize) -> Option<Marker> {
    let first = *line.first()?;
    let kind = match first {
        b'<' => Marker::Open,
        b'|' => Marker::Base,
        b'=' => Marker::Separator,
        b'>' => Marker::Close,
        _ => return None,
    };
    let run = line.get(..marker_size)?;
    if run.iter().any(|&byte| byte != first) {
        return None;
    }
    match line.get(marker_size) {
        None | Some(b' ' | b'\r' | b'\n') => Some(kind),
        Some(_) => None,
    }
}

pub(crate) fn views(text: &[u8], marker_size: usize) -> Views {
    let lines = split_lines(text);
    let mut views = Views {
        ours: Vec::with_capacity(text.len()),
        theirs: Vec::with_capacity(text.len()),
    };
    for piece in parse(&lines, marker_size) {
        let (ours, theirs) = match &piece {
            Piece::Settled(both) | Piece::Raw(both) => (both, both),
            Piece::Block(block) => (&block.ours, &block.theirs),
        };
        push_without_cr(&mut views.ours, &lines, ours);
        push_without_cr(&mut views.theirs, &lines, theirs);
    }
    views
}

fn push_without_cr(view: &mut Vec<u8>, lines: &[&[u8]], range: &Range<usize>) {
    for line in lines.get(range.clone()).unwrap_or_default() {
        match line.strip_suffix(b"\r\n") {
            Some(content) => {
                view.extend_from_slice(content);
                view.push(b'\n');
            }
            None => view.extend_from_slice(line),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MERGE: &[u8] = include_bytes!("../tests/markers/style-merge.txt");
    const DIFF3: &[u8] = include_bytes!("../tests/markers/style-diff3.txt");
    const ZDIFF3: &[u8] = include_bytes!("../tests/markers/style-zdiff3.txt");
    const SIZE_12: &[u8] = include_bytes!("../tests/markers/marker-size-12.txt");
    const CRLF: &[u8] = include_bytes!("../tests/markers/crlf.txt");
    const SIZE_12_MARKERS: usize = 12;

    fn parsed(text: &[u8]) -> Vec<Piece> {
        parse(&split_lines(text), DEFAULT_MARKER_SIZE)
    }

    fn section_texts(text: &[u8], marker_size: usize) -> Vec<(String, String)> {
        let lines = split_lines(text);
        let joined =
            |range: &Range<usize>| String::from_utf8(lines[range.clone()].concat()).unwrap();
        let blocks = parse(&lines, marker_size)
            .into_iter()
            .filter_map(|piece| match piece {
                Piece::Block(block) => Some((joined(&block.ours), joined(&block.theirs))),
                Piece::Settled(_) | Piece::Raw(_) => None,
            });
        blocks.collect()
    }

    #[test]
    fn the_three_styles_parse_to_two_blocks_with_the_same_sections_around_the_settled_separator() {
        let first = (
            "one\nTWO\nshared-a\nthree-ours\n".to_owned(),
            "ONE\ntwo\nshared-a\nthree-theirs\n".to_owned(),
        );
        let second = ("eight-ours\n".to_owned(), "eight-theirs\n".to_owned());
        assert_eq!(
            section_texts(MERGE, DEFAULT_MARKER_SIZE),
            [first.clone(), second.clone()]
        );
        assert_eq!(
            section_texts(ZDIFF3, DEFAULT_MARKER_SIZE),
            [first, second.clone()]
        );
        let diff3_first = (
            "one\nTWO\nshared-a\nthree-ours\nshared-b\n".to_owned(),
            "ONE\ntwo\nshared-a\nthree-theirs\nshared-b\n".to_owned(),
        );
        assert_eq!(
            section_texts(DIFF3, DEFAULT_MARKER_SIZE),
            [diff3_first, second]
        );
        let zdiff3 = parsed(ZDIFF3);
        assert_eq!(zdiff3[0], Piece::Settled(0..2));
        assert_eq!(
            zdiff3[1],
            Piece::Block(Block {
                whole: 2..17,
                ours: 3..7,
                theirs: 12..16
            })
        );
        assert_eq!(open_regions(&zdiff3), 2);
    }

    #[test]
    fn marker_size_twelve_parses_with_twelve_and_is_all_text_with_seven() {
        assert_eq!(
            section_texts(SIZE_12, SIZE_12_MARKERS),
            section_texts(ZDIFF3, DEFAULT_MARKER_SIZE)
        );
        let lines = split_lines(SIZE_12).len();
        assert_eq!(
            parse(&split_lines(SIZE_12), DEFAULT_MARKER_SIZE),
            [Piece::Settled(0..lines)]
        );
    }

    #[test]
    fn crlf_markers_parse_like_lf_ones() {
        let crlf = parse(&split_lines(CRLF), DEFAULT_MARKER_SIZE);
        assert_eq!(crlf, parsed(ZDIFF3));
    }

    #[test]
    fn a_deleted_separator_or_a_close_before_it_makes_the_block_raw_to_its_close() {
        let text = b"a\n<<<<<<< ours\nx\n||||||| base\nb\n>>>>>>> theirs\nz\n";
        assert_eq!(
            parsed(text),
            [Piece::Settled(0..1), Piece::Raw(1..6), Piece::Settled(6..7)]
        );
        let no_base = b"<<<<<<< ours\nx\ny\n>>>>>>> theirs\n";
        assert_eq!(parsed(no_base), [Piece::Raw(0..4)]);
    }

    #[test]
    fn a_nested_open_makes_the_block_raw_to_the_next_close() {
        let text = b"<<<<<<< a\nx\n<<<<<<< b\ny\n=======\nz\n>>>>>>> b\nafter\n";
        assert_eq!(parsed(text), [Piece::Raw(0..7), Piece::Settled(7..8)]);
        let open_again =
            b"<<<<<<< a\nx\n=======\n=======\ny\n<<<<<<< b\nc\n=======\nd\n>>>>>>> b\n";
        assert_eq!(
            parsed(open_again),
            [
                Piece::Raw(0..5),
                Piece::Block(Block {
                    whole: 5..10,
                    ours: 6..7,
                    theirs: 8..9
                })
            ]
        );
    }

    #[test]
    fn a_stray_close_is_one_raw_line_and_an_open_without_close_is_raw_to_the_end() {
        let stray = b"a\n>>>>>>> x\nb\n";
        assert_eq!(
            parsed(stray),
            [Piece::Settled(0..1), Piece::Raw(1..2), Piece::Settled(2..3)]
        );
        let unclosed = b"a\n<<<<<<< ours\nx\n=======\ny\n";
        assert_eq!(parsed(unclosed), [Piece::Settled(0..1), Piece::Raw(1..5)]);
        assert_eq!(open_regions(&parsed(unclosed)), 1);
    }

    #[test]
    fn separators_and_base_markers_outside_a_block_are_text() {
        let text = b"=======\n||||||| x\ntext\n";
        assert_eq!(parsed(text), [Piece::Settled(0..3)]);
        assert_eq!(open_regions(&parsed(text)), 0);
    }

    #[test]
    fn a_last_line_without_a_newline_closes_a_block_and_needs_no_label() {
        let text = b"<<<<<<<\nx\n=======\ny\n>>>>>>>";
        assert_eq!(
            parsed(text),
            [Piece::Block(Block {
                whole: 0..5,
                ours: 1..2,
                theirs: 3..4
            })]
        );
    }

    #[test]
    fn markers_two_longer_than_the_size_and_markers_followed_by_text_stay_text() {
        let text = b"<<<<<<<<< inner\n=========\n>>>>>>>>> inner\n<<<<<<<x\n";
        assert_eq!(parsed(text), [Piece::Settled(0..4)]);
    }

    #[test]
    fn views_are_the_same_in_every_style_and_line_ending() {
        let expected = views(MERGE, DEFAULT_MARKER_SIZE);
        assert_eq!(views(ZDIFF3, DEFAULT_MARKER_SIZE), expected);
        assert_eq!(views(DIFF3, DEFAULT_MARKER_SIZE), expected);
        assert_eq!(views(CRLF, DEFAULT_MARKER_SIZE), expected);
        assert_eq!(views(SIZE_12, SIZE_12_MARKERS), expected);
        let ours = include_bytes!("../tests/markers/ours.txt");
        assert_eq!(expected.ours, ours);
    }

    #[test]
    fn views_keep_raw_regions_whole_in_both_sides() {
        let text = b"a\r\n<<<<<<< ours\nx\n>>>>>>> theirs\n";
        let expected = b"a\n<<<<<<< ours\nx\n>>>>>>> theirs\n".to_vec();
        assert_eq!(
            views(text, DEFAULT_MARKER_SIZE),
            Views {
                ours: expected.clone(),
                theirs: expected
            }
        );
    }
}
