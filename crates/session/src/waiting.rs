use serde::Serialize;
use specta::Type;
use yamt_gitio::{OURS_LABEL, THEIRS_LABEL};
use yamt_merge_core::{Chunk, ChunkKind};

use crate::markers::{Block, Piece, parse, split_lines};
use crate::sides::Side;

/// What Save writes for this change while a side of it still waits (plan §2 #69).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind")]
pub enum Waiting {
    /// One side changed these lines, or both the same way: written applied, as git wrote it.
    SideLines,
    /// A conflict as git writes it: `open`, the section of the pane `first` (git's ours: HEAD),
    /// `between` (base section if any, then the separator), the other pane's section, `close`.
    /// Lines without line breaks.
    Markers {
        open: String,
        first: Side,
        between: Vec<String>,
        close: String,
    },
    /// A region yamt could not place: written as the Result shows it.
    AsShown,
}

/// The marker lines git writes around a conflict in one file, without line breaks, and the pane
/// showing git's ours, whose section git writes first.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MarkerStyle {
    open: String,
    /// The diff3/zdiff3 base marker line; `None` in merge style.
    base: Option<String>,
    separator: String,
    close: String,
    ours_pane: Side,
}

impl MarkerStyle {
    /// The marker lines of the first block in `disk`, else the `fallback`.
    #[must_use]
    pub fn found_in(disk: &[u8], marker_size: usize, ours_pane: Side) -> MarkerStyle {
        let Ok(text) = std::str::from_utf8(disk) else {
            return MarkerStyle::fallback(marker_size, ours_pane);
        };
        let lines: Vec<&str> = text.split_inclusive('\n').collect();
        let pieces = parse(&split_lines(disk), marker_size);
        let first_block = pieces.iter().find_map(|piece| match piece {
            Piece::Block(block) => Some(block),
            Piece::Settled(_) | Piece::Raw(_) => None,
        });
        match first_block {
            Some(block) => style_of(&lines, block, ours_pane),
            None => MarkerStyle::fallback(marker_size, ours_pane),
        }
    }

    /// Merge style with the labels `Repo::merge_file` passes to `git merge-file` (gitio
    /// `merge_file.rs`).
    #[must_use]
    pub fn fallback(marker_size: usize, ours_pane: Side) -> MarkerStyle {
        MarkerStyle {
            open: format!("{} {OURS_LABEL}", "<".repeat(marker_size)),
            base: None,
            separator: "=".repeat(marker_size),
            close: format!("{} {THEIRS_LABEL}", ">".repeat(marker_size)),
            ours_pane,
        }
    }

    /// What Save writes for a stages-view `chunk`; a conflict's base section holds its lines of
    /// `base_lines` (the whole base text), and only where this style has a base section.
    pub(crate) fn waiting(&self, chunk: &Chunk, base_lines: &[&str]) -> Waiting {
        match chunk.kind {
            ChunkKind::LocalOnly | ChunkKind::RemoteOnly | ChunkKind::BothSame => {
                return Waiting::SideLines;
            }
            ChunkKind::Conflict => {}
        }
        let mut between = Vec::new();
        if let Some(base) = &self.base {
            between.push(base.clone());
            let lines = chunk.base.start.0 as usize..chunk.base.end().0 as usize;
            for line in base_lines.get(lines).unwrap_or_default() {
                between.push(without_line_break(line).to_owned());
            }
        }
        between.push(self.separator.clone());
        Waiting::Markers {
            open: self.open.clone(),
            first: self.ours_pane,
            between,
            close: self.close.clone(),
        }
    }
}

/// The marker lines of `block`, copied as they are from the file's `lines`.
pub(crate) fn block_markers(lines: &[&str], block: &Block, ours_pane: Side) -> Waiting {
    let between = (block.ours.end..block.theirs.start).map(|at| line_text(lines, at));
    Waiting::Markers {
        open: line_text(lines, block.whole.start),
        first: ours_pane,
        between: between.collect(),
        close: line_text(lines, block.whole.end - 1),
    }
}

fn style_of(lines: &[&str], block: &Block, ours_pane: Side) -> MarkerStyle {
    let has_base = block.ours.end + 1 < block.theirs.start;
    MarkerStyle {
        open: line_text(lines, block.whole.start),
        base: has_base.then(|| line_text(lines, block.ours.end)),
        separator: line_text(lines, block.theirs.start - 1),
        close: line_text(lines, block.whole.end - 1),
        ours_pane,
    }
}

fn line_text(lines: &[&str], at: usize) -> String {
    lines
        .get(at)
        .copied()
        .map_or("", without_line_break)
        .to_owned()
}

fn without_line_break(line: &str) -> &str {
    match line.strip_suffix('\n') {
        Some(content) => content.strip_suffix('\r').unwrap_or(content),
        None => line,
    }
}

#[cfg(test)]
mod tests {
    use yamt_merge_core::{BaseLine, ChunkId, LineRange, LocalLine, RemoteLine};

    use super::*;
    use crate::markers::DEFAULT_MARKER_SIZE;
    use crate::merge_data::Texts;
    use crate::orientation::{OURS_LEFT, THEIRS_LEFT};
    use crate::seed::seed;

    const MERGE: &[u8] = include_bytes!("../tests/markers/style-merge.txt");
    const DIFF3: &[u8] = include_bytes!("../tests/markers/style-diff3.txt");
    const ZDIFF3: &str = include_str!("../tests/markers/style-zdiff3.txt");
    const SIZE_12: &[u8] = include_bytes!("../tests/markers/marker-size-12.txt");
    const CRLF: &[u8] = include_bytes!("../tests/markers/crlf.txt");
    const BASE: &str = include_str!("../tests/markers/base.txt");
    const OURS: &str = include_str!("../tests/markers/ours.txt");
    const THEIRS: &str = include_str!("../tests/markers/theirs.txt");
    const SIZE_12_MARKERS: usize = 12;

    fn style(open: &str, base: Option<&str>, separator: &str, close: &str) -> MarkerStyle {
        MarkerStyle {
            open: open.to_owned(),
            base: base.map(str::to_owned),
            separator: separator.to_owned(),
            close: close.to_owned(),
            ours_pane: Side::Local,
        }
    }

    fn found_in(disk: &[u8], marker_size: usize) -> MarkerStyle {
        MarkerStyle::found_in(disk, marker_size, Side::Local)
    }

    #[test]
    fn the_style_is_copied_from_the_first_block_in_every_style_size_and_line_ending() {
        let merge = style("<<<<<<< HEAD", None, "=======", ">>>>>>> theirs");
        let diff3 = style(
            "<<<<<<< HEAD",
            Some("||||||| 8409db1"),
            "=======",
            ">>>>>>> theirs",
        );
        assert_eq!(found_in(MERGE, DEFAULT_MARKER_SIZE), merge);
        assert_eq!(found_in(DIFF3, DEFAULT_MARKER_SIZE), diff3);
        assert_eq!(found_in(ZDIFF3.as_bytes(), DEFAULT_MARKER_SIZE), diff3);
        let crlf = style(
            "<<<<<<< HEAD",
            Some("||||||| 8956f4f"),
            "=======",
            ">>>>>>> theirs",
        );
        assert_eq!(found_in(CRLF, DEFAULT_MARKER_SIZE), crlf);
        let size_12 = style(
            "<<<<<<<<<<<< HEAD",
            Some("|||||||||||| e87a625"),
            "============",
            ">>>>>>>>>>>> theirs",
        );
        assert_eq!(found_in(SIZE_12, SIZE_12_MARKERS), size_12);
    }

    #[test]
    fn a_file_without_a_block_or_not_utf8_gets_the_fallback_of_its_marker_size() {
        let fallback = style(
            "<<<<<<<<<<<< ours",
            None,
            "============",
            ">>>>>>>>>>>> theirs",
        );
        assert_eq!(
            MarkerStyle::fallback(SIZE_12_MARKERS, Side::Local),
            fallback
        );
        assert_eq!(found_in(SIZE_12, DEFAULT_MARKER_SIZE).open, "<<<<<<< ours");
        assert_eq!(found_in(b"no markers\n", SIZE_12_MARKERS), fallback);
        let latin1 = b"<<<<<<< \xe9\nx\n=======\ny\n>>>>>>> theirs\n";
        assert_eq!(found_in(latin1, DEFAULT_MARKER_SIZE).open, "<<<<<<< ours");
    }

    fn chunk(kind: ChunkKind, base: LineRange<BaseLine>) -> Chunk {
        Chunk {
            id: ChunkId(0),
            kind,
            base,
            local: LineRange {
                start: LocalLine(0),
                len: 0,
            },
            remote: LineRange {
                start: RemoteLine(0),
                len: 0,
            },
        }
    }

    #[test]
    fn a_conflict_holds_its_base_lines_only_in_a_style_with_a_base_section() {
        let base_lines = ["zero\n", "one\r\n", "two\n", "three"];
        let conflict = chunk(
            ChunkKind::Conflict,
            LineRange {
                start: BaseLine(1),
                len: 3,
            },
        );
        let diff3 = found_in(DIFF3, DEFAULT_MARKER_SIZE);
        let expected = Waiting::Markers {
            open: "<<<<<<< HEAD".to_owned(),
            first: Side::Local,
            between: ["||||||| 8409db1", "one", "two", "three", "======="]
                .map(str::to_owned)
                .to_vec(),
            close: ">>>>>>> theirs".to_owned(),
        };
        assert_eq!(diff3.waiting(&conflict, &base_lines), expected);
        let merge = MarkerStyle::fallback(DEFAULT_MARKER_SIZE, Side::Remote);
        let expected = Waiting::Markers {
            open: "<<<<<<< ours".to_owned(),
            first: Side::Remote,
            between: vec!["=======".to_owned()],
            close: ">>>>>>> theirs".to_owned(),
        };
        assert_eq!(merge.waiting(&conflict, &base_lines), expected);
    }

    #[test]
    fn a_one_sided_or_same_change_is_written_as_its_side_lines() {
        let base = LineRange {
            start: BaseLine(0),
            len: 1,
        };
        let diff3 = found_in(DIFF3, DEFAULT_MARKER_SIZE);
        for kind in [
            ChunkKind::LocalOnly,
            ChunkKind::RemoteOnly,
            ChunkKind::BothSame,
        ] {
            assert_eq!(
                diff3.waiting(&chunk(kind, base), &["a\n"]),
                Waiting::SideLines
            );
        }
    }

    fn rebuilt_block(waiting: &Waiting, local: &[&str], remote: &[&str]) -> String {
        let Waiting::Markers {
            open,
            first,
            between,
            close,
        } = waiting
        else {
            panic!("expected markers, got {waiting:?}");
        };
        let (first, second) = match first {
            Side::Local => (local, remote),
            Side::Remote => (remote, local),
        };
        let mut block = vec![open.as_str()];
        block.extend(first.iter().map(|line| without_line_break(line)));
        block.extend(between.iter().map(String::as_str));
        block.extend(second.iter().map(|line| without_line_break(line)));
        block.push(close);
        block.join("\n") + "\n"
    }

    #[test]
    fn an_exact_block_s_markers_and_its_section_lines_rebuild_the_block_exactly() {
        for (orientation, local, remote) in [(OURS_LEFT, OURS, THEIRS), (THEIRS_LEFT, THEIRS, OURS)]
        {
            let texts = Texts {
                base: BASE.to_owned(),
                local: local.to_owned(),
                remote: remote.to_owned(),
                deleted: None,
            };
            let seeded = seed(ZDIFF3, DEFAULT_MARKER_SIZE, &texts, orientation);
            let local: Vec<&str> = local.split_inclusive('\n').collect();
            let remote: Vec<&str> = remote.split_inclusive('\n').collect();
            let blocks = [2..17, 22..29];
            let disk: Vec<&str> = ZDIFF3.split_inclusive('\n').collect();

            assert_eq!(seeded.chunks.len(), blocks.len());
            for (chunk, block) in seeded.chunks.iter().zip(blocks) {
                let local_lines =
                    chunk.chunk.local.start.0 as usize..chunk.chunk.local.end().0 as usize;
                let remote_lines =
                    chunk.chunk.remote.start.0 as usize..chunk.chunk.remote.end().0 as usize;
                let (local, remote) = (&local[local_lines], &remote[remote_lines]);
                let rebuilt = rebuilt_block(&chunk.waiting, local, remote);
                assert_eq!(rebuilt, disk[block].concat());
            }
        }
    }

    #[test]
    fn an_edited_block_and_a_raw_region_are_written_as_shown() {
        let texts = Texts {
            base: BASE.to_owned(),
            local: OURS.to_owned(),
            remote: THEIRS.to_owned(),
            deleted: None,
        };
        let edited = ZDIFF3.replace("three-ours\n", "three-ours, edited\n");
        let raw = ZDIFF3.replace("eight-theirs\n>>>>>>> theirs\n", "eight-theirs\n");

        for disk in [edited, raw] {
            let seeded = seed(&disk, DEFAULT_MARKER_SIZE, &texts, OURS_LEFT);
            let waiting: Vec<&Waiting> = seeded.chunks.iter().map(|chunk| &chunk.waiting).collect();
            assert!(waiting.contains(&&Waiting::AsShown), "{waiting:?}");
        }
    }
}
