use std::ops::Range;

use yamt_merge_core::{
    BaseLine, Chunk, ChunkId, ChunkKind, LineMap, LineRange, LocalLine, RemoteLine, line_map,
    word_changes,
};

use crate::decode::{Eol, detect_eol};
use crate::markers::{Block, Piece, parse, split_lines};
use crate::merge_data::{MergeChunk, MiddleLine, Texts};

/// The middle pane's starting text built from a worktree file, and its open conflicts.
pub(crate) struct Seeded {
    pub(crate) middle: String,
    pub(crate) eol: Eol,
    pub(crate) chunks: Vec<MergeChunk>,
}

/// One side's reading of the disk text with raw regions left out (`\r\n` read as `\n`), and the
/// line where each piece starts in it.
struct SideView {
    text: String,
    piece_starts: Vec<u32>,
}

/// Where an open block or raw region sits in local and remote; `exact` when every line of both
/// sections was found unchanged.
struct Located {
    local: Range<u32>,
    remote: Range<u32>,
    exact: bool,
}

struct Maps {
    ours_to_local: LineMap,
    theirs_to_remote: LineMap,
    local_to_base: LineMap,
    remote_to_base: LineMap,
}

/// The middle text as it is built, with each conflict's chunk and its lines in the middle.
struct MiddleText<'a> {
    disk_lines: &'a [&'a str],
    base_lines: Vec<&'a str>,
    eol: Eol,
    text: String,
    line_count: u32,
    chunks: Vec<Chunk>,
    ranges: Vec<LineRange<MiddleLine>>,
}

pub(crate) fn seed(disk: &str, marker_size: usize, texts: &Texts) -> Seeded {
    let disk_lines: Vec<&str> = disk.split_inclusive('\n').collect();
    let pieces = parse(&split_lines(disk.as_bytes()), marker_size);
    let ours = side_view(&disk_lines, &pieces, |block| &block.ours);
    let theirs = side_view(&disk_lines, &pieces, |block| &block.theirs);
    let maps = Maps {
        ours_to_local: line_map(&ours.text, &texts.local.replace("\r\n", "\n")),
        theirs_to_remote: line_map(&theirs.text, &texts.remote.replace("\r\n", "\n")),
        local_to_base: line_map(&texts.local, &texts.base),
        remote_to_base: line_map(&texts.remote, &texts.base),
    };
    let mut middle = MiddleText {
        disk_lines: &disk_lines,
        base_lines: texts.base.split_inclusive('\n').collect(),
        eol: detect_eol(disk),
        text: String::with_capacity(disk.len()),
        line_count: 0,
        chunks: Vec::new(),
        ranges: Vec::new(),
    };
    let starts = ours.piece_starts.into_iter().zip(theirs.piece_starts);
    for (piece, (ours_start, theirs_start)) in pieces.iter().zip(starts) {
        match piece {
            Piece::Settled(lines) => middle.push_disk_lines(lines),
            Piece::Block(block) => {
                let located = maps.block(block, ours_start, theirs_start);
                middle.push_conflict(&located, maps.base(&located), &block.whole);
            }
            Piece::Raw(lines) => {
                let located = maps.raw(ours_start, theirs_start);
                middle.push_conflict(&located, maps.base(&located), lines);
            }
        }
    }
    middle.seeded(texts)
}

fn side_view(lines: &[&str], pieces: &[Piece], section: fn(&Block) -> &Range<usize>) -> SideView {
    let mut view = SideView {
        text: String::new(),
        piece_starts: Vec::with_capacity(pieces.len()),
    };
    let mut line_count = 0;
    for piece in pieces {
        view.piece_starts.push(line_count);
        let included = match piece {
            Piece::Settled(lines) => lines,
            Piece::Block(block) => section(block),
            Piece::Raw(_) => continue,
        };
        for line in lines.get(included.clone()).unwrap_or_default() {
            match line.strip_suffix("\r\n") {
                Some(content) => {
                    view.text.push_str(content);
                    view.text.push('\n');
                }
                None => view.text.push_str(line),
            }
            line_count += 1;
        }
    }
    view
}

impl Maps {
    fn block(&self, block: &Block, ours_start: u32, theirs_start: u32) -> Located {
        let ours = ours_start..ours_start + line_number(block.ours.len());
        let theirs = theirs_start..theirs_start + line_number(block.theirs.len());
        match (
            self.ours_to_local.exact(ours.clone()),
            self.theirs_to_remote.exact(theirs.clone()),
        ) {
            (Some(local), Some(remote)) => Located {
                local,
                remote,
                exact: true,
            },
            (None, _) | (_, None) => Located {
                local: self.ours_to_local.covering(ours),
                remote: self.theirs_to_remote.covering(theirs),
                exact: false,
            },
        }
    }

    fn raw(&self, ours_start: u32, theirs_start: u32) -> Located {
        Located {
            local: self.ours_to_local.covering(ours_start..ours_start),
            remote: self.theirs_to_remote.covering(theirs_start..theirs_start),
            exact: false,
        }
    }

    fn base(&self, located: &Located) -> Range<u32> {
        let from_local = self.local_to_base.covering(located.local.clone());
        let from_remote = self.remote_to_base.covering(located.remote.clone());
        from_local.start.min(from_remote.start)..from_local.end.max(from_remote.end)
    }
}

impl MiddleText<'_> {
    fn push_disk_lines(&mut self, lines: &Range<usize>) {
        for line in self.disk_lines.get(lines.clone()).unwrap_or_default() {
            self.text.push_str(line);
            self.line_count += 1;
        }
    }

    fn push_base_lines(&mut self, lines: &Range<u32>) {
        let range = lines.start as usize..lines.end as usize;
        for line in self.base_lines.get(range).unwrap_or_default() {
            let bare_lf = line
                .strip_suffix('\n')
                .filter(|content| !content.ends_with('\r'));
            match (self.eol, bare_lf) {
                (Eol::CrLf, Some(content)) => {
                    self.text.push_str(content);
                    self.text.push_str("\r\n");
                }
                (Eol::CrLf | Eol::Lf | Eol::Mixed, _) => self.text.push_str(line),
            }
            self.line_count += 1;
        }
    }

    fn push_conflict(&mut self, located: &Located, base: Range<u32>, disk_lines: &Range<usize>) {
        let start = self.line_count;
        if located.exact {
            self.push_base_lines(&base);
        } else {
            self.push_disk_lines(disk_lines);
        }
        self.ranges.push(LineRange {
            start: MiddleLine(start),
            len: self.line_count - start,
        });
        self.chunks.push(Chunk {
            id: ChunkId(line_number(self.chunks.len())),
            kind: ChunkKind::Conflict,
            base: LineRange {
                start: BaseLine(base.start),
                len: base.end - base.start,
            },
            local: LineRange {
                start: LocalLine(located.local.start),
                len: located.local.end - located.local.start,
            },
            remote: LineRange {
                start: RemoteLine(located.remote.start),
                len: located.remote.end - located.remote.start,
            },
        });
    }

    fn seeded(self, texts: &Texts) -> Seeded {
        let words = word_changes(&texts.base, &texts.local, &texts.remote, &self.chunks);
        let mut chunks = Vec::with_capacity(self.chunks.len());
        for ((chunk, middle), words) in self.chunks.into_iter().zip(self.ranges).zip(words) {
            chunks.push(MergeChunk {
                chunk,
                middle,
                words,
            });
        }
        Seeded {
            middle: self.text,
            eol: self.eol,
            chunks,
        }
    }
}

fn line_number(count: usize) -> u32 {
    u32::try_from(count).unwrap_or(u32::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::markers::DEFAULT_MARKER_SIZE;

    const BASE: &str = include_str!("../tests/markers/base.txt");
    const OURS: &str = include_str!("../tests/markers/ours.txt");
    const THEIRS: &str = include_str!("../tests/markers/theirs.txt");
    const ZDIFF3: &str = include_str!("../tests/markers/style-zdiff3.txt");
    const MERGE: &str = include_str!("../tests/markers/style-merge.txt");
    const SECOND_BLOCK_ZDIFF3: &str =
        "<<<<<<< HEAD\neight-ours\n||||||| 8409db1\neight\n=======\neight-theirs\n>>>>>>> theirs\n";
    const SECOND_BLOCK_MERGE: &str =
        "<<<<<<< HEAD\neight-ours\n=======\neight-theirs\n>>>>>>> theirs\n";
    const WORKED_MIDDLE: &str = "title\n=======\none\ntwo\nthree\nshared-b\nfour\nfive\nsix\nseven\neight-theirs\nnine\nten\n";

    fn texts(base: &str, local: &str, remote: &str) -> Texts {
        Texts {
            base: base.to_owned(),
            local: local.to_owned(),
            remote: remote.to_owned(),
            deleted: None,
        }
    }

    fn sample_texts() -> Texts {
        texts(BASE, OURS, THEIRS)
    }

    fn ranges(seeded: &Seeded) -> Vec<[(u32, u32); 3]> {
        let ranges = seeded.chunks.iter().map(|chunk| {
            [
                (chunk.middle.start.0, chunk.middle.len),
                (chunk.chunk.local.start.0, chunk.chunk.local.len),
                (chunk.chunk.remote.start.0, chunk.chunk.remote.len),
            ]
        });
        ranges.collect()
    }

    fn with_local_applied(seeded: &Seeded, local: &str) -> String {
        let middle: Vec<&str> = seeded.middle.split_inclusive('\n').collect();
        let local: Vec<&str> = local.split_inclusive('\n').collect();
        let [chunk] = seeded.chunks.as_slice() else {
            panic!("expected one chunk, got {}", seeded.chunks.len());
        };
        let (start, len) = (chunk.middle.start.0 as usize, chunk.middle.len as usize);
        let (local_start, local_len) = (
            chunk.chunk.local.start.0 as usize,
            chunk.chunk.local.len as usize,
        );
        let mut applied = middle[..start].concat();
        applied += &local[local_start..local_start + local_len].concat();
        applied + &middle[start + len..].concat()
    }

    #[test]
    fn one_block_resolved_by_hand_leaves_one_chunk_over_its_base_lines_in_both_styles() {
        for (style, second_block) in [(ZDIFF3, SECOND_BLOCK_ZDIFF3), (MERGE, SECOND_BLOCK_MERGE)] {
            let disk = style.replace(second_block, "eight-theirs\n");

            let seeded = seed(&disk, DEFAULT_MARKER_SIZE, &sample_texts());

            assert_eq!(seeded.middle, WORKED_MIDDLE);
            assert_eq!(ranges(&seeded), [[(2, 3), (2, 4), (2, 4)]]);
            assert_eq!(seeded.chunks[0].chunk.base.start.0, 2);
            assert_eq!(seeded.chunks[0].chunk.base.len, 3);
            let by_hand = OURS.replace("eight-ours", "eight-theirs");
            assert_eq!(with_local_applied(&seeded, OURS), by_hand);
        }
    }

    #[test]
    fn the_mirror_case_puts_the_chunk_on_the_second_block() {
        let first_block = "<<<<<<< HEAD\none\nTWO\nshared-a\nthree-ours\n||||||| 8409db1\none\ntwo\nthree\n=======\nONE\ntwo\nshared-a\nthree-theirs\n>>>>>>> theirs\n";
        let disk = ZDIFF3.replace(first_block, "one\nTWO\nshared-a\nthree-ours\n");

        let seeded = seed(&disk, DEFAULT_MARKER_SIZE, &sample_texts());

        assert_eq!(ranges(&seeded), [[(11, 1), (11, 1), (11, 1)]]);
        assert_eq!(with_local_applied(&seeded, OURS), OURS);
        assert!(
            seeded.middle.ends_with("seven\neight\nnine\nten\n"),
            "{}",
            seeded.middle
        );
    }

    #[test]
    fn an_edit_inside_the_ours_section_leaves_the_block_raw_with_covering_ranges() {
        let disk = MERGE.replace("three-ours\n", "three-ours, edited\n");

        let seeded = seed(&disk, DEFAULT_MARKER_SIZE, &sample_texts());

        let raw_block = "<<<<<<< HEAD\none\nTWO\nshared-a\nthree-ours, edited\n=======\nONE\ntwo\nshared-a\nthree-theirs\n>>>>>>> theirs\n";
        assert!(
            seeded
                .middle
                .starts_with(&format!("title\n=======\n{raw_block}shared-b\n")),
            "{}",
            seeded.middle
        );
        let [first, second] = ranges(&seeded)[..] else {
            panic!("expected two chunks");
        };
        assert_eq!(first[0], (2, 11));
        let (local_start, local_len) = first[1];
        assert!(
            local_start <= 3 && local_start + local_len >= 6,
            "{first:?}"
        );
        assert_eq!(first[2], (2, 4));
        assert_eq!(second[1], (11, 1));
    }

    #[test]
    fn an_empty_ours_section_is_an_insertion_point_in_local() {
        let texts = texts("a\nb\nc\n", "a\nc\n", "a\nB\nc\n");
        let disk = "a\n<<<<<<< ours\n=======\nB\n>>>>>>> theirs\nc\n";

        let seeded = seed(disk, DEFAULT_MARKER_SIZE, &texts);

        assert_eq!(seeded.middle, "a\nb\nc\n");
        assert_eq!(ranges(&seeded), [[(1, 1), (1, 0), (1, 1)]]);
        assert_eq!(with_local_applied(&seeded, &texts.local), "a\nc\n");
    }

    #[test]
    fn a_section_line_repeated_elsewhere_still_applies_the_exact_text() {
        let texts = texts(
            "dup\nmid\nbase\nend\n",
            "dup\nmid\ndup\nend\n",
            "dup\nmid\nother\nend\n",
        );
        let disk = "dup\nmid\n<<<<<<< ours\ndup\n=======\nother\n>>>>>>> theirs\nend\n";

        let seeded = seed(disk, DEFAULT_MARKER_SIZE, &texts);

        assert_eq!(seeded.middle, "dup\nmid\nbase\nend\n");
        assert_eq!(ranges(&seeded), [[(2, 1), (2, 1), (2, 1)]]);
        assert_eq!(with_local_applied(&seeded, &texts.local), texts.local);
    }

    #[test]
    fn a_crlf_disk_keeps_crlf_in_the_middle_and_the_eol_also_over_lf_stages() {
        let crlf = |text: &str| text.replace('\n', "\r\n");
        let disk = crlf(&ZDIFF3.replace(SECOND_BLOCK_ZDIFF3, "eight-theirs\n"));
        let crlf_stages = texts(&crlf(BASE), &crlf(OURS), &crlf(THEIRS));

        for stages in [crlf_stages, sample_texts()] {
            let seeded = seed(&disk, DEFAULT_MARKER_SIZE, &stages);

            assert_eq!(seeded.middle, crlf(WORKED_MIDDLE));
            assert_eq!(seeded.eol, Eol::CrLf);
            assert_eq!(ranges(&seeded), [[(2, 3), (2, 4), (2, 4)]]);
        }
    }

    #[test]
    fn settled_text_only_gives_no_chunk_and_the_text_as_it_is() {
        let seeded = seed(OURS, DEFAULT_MARKER_SIZE, &sample_texts());
        assert_eq!(seeded.middle, OURS);
        assert_eq!(seeded.chunks, Vec::new());
        assert_eq!(seeded.eol, Eol::Lf);
    }
}
