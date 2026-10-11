use std::ops::Range;

use yamt_merge_core::{BaseLine, Chunk, ChunkId, ChunkKind, LineRange, word_changes};

use crate::decode::{Eol, detect_eol};
use crate::locate::{Located, Maps, line_number, side_view};
use crate::markers::{Piece, parse, split_lines};
use crate::merge_data::{MergeChunk, MiddleLine, Texts};

/// The middle pane's starting text built from a worktree file, and its open conflicts.
pub(crate) struct Seeded {
    pub(crate) middle: String,
    pub(crate) eol: Eol,
    pub(crate) chunks: Vec<MergeChunk>,
}

/// The middle text as it is built, with each conflict's chunk and its lines in the middle.
struct MiddleText<'a> {
    disk_lines: &'a [&'a str],
    base_lines: Vec<&'a str>,
    eol: Eol,
    text: String,
    line_count: u32,
    /// Where the previous chunk's base lines end; the next chunk's start no earlier.
    base_end: u32,
    chunks: Vec<Chunk>,
    ranges: Vec<LineRange<MiddleLine>>,
}

pub(crate) fn seed(disk: &str, marker_size: usize, texts: &Texts) -> Seeded {
    let disk_lines: Vec<&str> = disk.split_inclusive('\n').collect();
    let pieces = parse(&split_lines(disk.as_bytes()), marker_size);
    let ours = side_view(&disk_lines, &pieces, |block| &block.ours);
    let theirs = side_view(&disk_lines, &pieces, |block| &block.theirs);
    let maps = Maps::new(&ours, &theirs, texts);
    let mut middle = MiddleText {
        disk_lines: &disk_lines,
        base_lines: texts.base.split_inclusive('\n').collect(),
        eol: detect_eol(disk),
        text: String::with_capacity(disk.len()),
        line_count: 0,
        base_end: 0,
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

impl MiddleText<'_> {
    fn push_disk_lines(&mut self, lines: &Range<usize>) {
        for line in self.disk_lines.get(lines.clone()).unwrap_or_default() {
            end_open_line(&mut self.text, self.eol);
            self.text.push_str(line);
            self.line_count += 1;
        }
    }

    fn push_base_lines(&mut self, lines: LineRange<BaseLine>) {
        let range = lines.start.0 as usize..lines.end().0 as usize;
        for line in self.base_lines.get(range).unwrap_or_default() {
            end_open_line(&mut self.text, self.eol);
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

    fn push_conflict(
        &mut self,
        located: &Located,
        base: LineRange<BaseLine>,
        disk_lines: &Range<usize>,
    ) {
        let base = self.after_previous_base(base);
        let start = self.line_count;
        if located.exact {
            self.push_base_lines(base);
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
            base,
            local: located.local,
            remote: located.remote,
        });
    }

    /// `base` without the lines an earlier chunk already holds, so chunks stay disjoint in base.
    fn after_previous_base(&mut self, base: LineRange<BaseLine>) -> LineRange<BaseLine> {
        let start = base.start.0.max(self.base_end);
        let after = LineRange {
            start: BaseLine(start),
            len: base.end().0.saturating_sub(start),
        };
        self.base_end = after.end().0;
        after
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

/// Ends a last line that has no line break (base's last line) before another line follows it.
fn end_open_line(text: &mut String, eol: Eol) {
    if text.is_empty() || text.ends_with('\n') {
        return;
    }
    match eol {
        Eol::CrLf => text.push_str("\r\n"),
        Eol::Lf | Eol::Mixed => text.push('\n'),
    }
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

    /// The middle with every chunk replaced by its lines of `side`, as the window applies them.
    fn with_applied(seeded: &Seeded, side: &str, lines_of: fn(&Chunk) -> (u32, u32)) -> String {
        let mut middle: Vec<&str> = seeded.middle.split_inclusive('\n').collect();
        let side: Vec<&str> = side.split_inclusive('\n').collect();
        for chunk in seeded.chunks.iter().rev() {
            let start = chunk.middle.start.0 as usize;
            let replaced = start..start + chunk.middle.len as usize;
            let (side_start, side_len) = lines_of(&chunk.chunk);
            let side_lines = side_start as usize..(side_start + side_len) as usize;
            middle.splice(replaced, side[side_lines].iter().copied());
        }
        middle.concat()
    }

    fn with_local_applied(seeded: &Seeded, local: &str) -> String {
        with_applied(seeded, local, |chunk| {
            (chunk.local.start.0, chunk.local.len)
        })
    }

    fn with_remote_applied(seeded: &Seeded, remote: &str) -> String {
        with_applied(seeded, remote, |chunk| {
            (chunk.remote.start.0, chunk.remote.len)
        })
    }

    fn base_ranges(seeded: &Seeded) -> Vec<(u32, u32)> {
        let ranges = seeded.chunks.iter().map(|chunk| chunk.chunk.base);
        ranges.map(|base| (base.start.0, base.len)).collect()
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
            "DUP\nmid\nother\nend\n",
        );
        let disk = "DUP\nmid\n<<<<<<< ours\ndup\n=======\nother\n>>>>>>> theirs\nend\n";

        let seeded = seed(disk, DEFAULT_MARKER_SIZE, &texts);

        assert_eq!(seeded.middle, "DUP\nmid\nbase\nend\n");
        assert_eq!(ranges(&seeded), [[(2, 1), (2, 1), (2, 1)]]);
        assert_eq!(base_ranges(&seeded), [(2, 1)]);
        assert_eq!(
            with_local_applied(&seeded, &texts.local),
            "DUP\nmid\ndup\nend\n"
        );
        assert_eq!(with_remote_applied(&seeded, &texts.remote), texts.remote);
    }

    #[test]
    fn a_base_without_a_final_line_break_ends_its_last_line_before_the_settled_lines() {
        let texts = texts(
            "{\n  \"a\": 1\n}",
            "{\n  \"a\": 1,\n  \"x\": 2\n}\n",
            "{\n  \"a\": 1,\n  \"y\": 3\n}\n",
        );
        let disk =
            "{\n  \"a\": 1,\n<<<<<<< ours\n  \"x\": 2\n=======\n  \"y\": 3\n>>>>>>> theirs\n}\n";

        let seeded = seed(disk, DEFAULT_MARKER_SIZE, &texts);

        assert_eq!(seeded.middle, "{\n  \"a\": 1,\n  \"a\": 1\n}\n}\n");
        assert_eq!(ranges(&seeded), [[(2, 2), (2, 1), (2, 1)]]);
        assert_eq!(with_local_applied(&seeded, &texts.local), texts.local);
        assert_eq!(with_remote_applied(&seeded, &texts.remote), texts.remote);
    }

    #[test]
    fn two_blocks_git_split_around_shared_lines_get_disjoint_base_lines() {
        let texts = texts(
            "a\nX\nz\n",
            "a\nL1\ns1\ns2\ns3\ns4\nL2\nz\n",
            "a\nR1\ns1\ns2\ns3\ns4\nR2\nz\n",
        );
        let block = |ours: &str, theirs: &str| {
            format!("<<<<<<< ours\n{ours}\n=======\n{theirs}\n>>>>>>> theirs\n")
        };
        let disk = format!(
            "a\n{}s1\ns2\ns3\ns4\n{}z\n",
            block("L1", "R1"),
            block("L2", "R2")
        );

        let seeded = seed(&disk, DEFAULT_MARKER_SIZE, &texts);

        assert_eq!(seeded.middle, "a\nX\ns1\ns2\ns3\ns4\nz\n");
        assert_eq!(base_ranges(&seeded), [(1, 1), (2, 0)]);
        assert_eq!(
            ranges(&seeded),
            [[(1, 1), (1, 1), (1, 1)], [(6, 0), (6, 1), (6, 1)]]
        );
        assert_eq!(with_local_applied(&seeded, &texts.local), texts.local);
        assert_eq!(with_remote_applied(&seeded, &texts.remote), texts.remote);
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
