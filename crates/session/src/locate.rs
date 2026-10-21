use std::ops::Range;

use yamt_merge_core::{BaseLine, LineMap, LineRange, LocalLine, RemoteLine, line_map};

use crate::markers::{Block, Piece};
use crate::merge_data::Texts;
use crate::orientation::{GitSide, Orientation};

/// One side's reading of the disk text with raw regions left out (`\r\n` read as `\n`, every line
/// ended), and the line where each piece starts in it.
pub(crate) struct SideView {
    pub(crate) text: String,
    pub(crate) piece_starts: Vec<u32>,
}

/// Where an open block or raw region sits in local and remote; `exact` when every line of both
/// sections was found unchanged.
pub(crate) struct Located {
    pub(crate) local: LineRange<LocalLine>,
    pub(crate) remote: LineRange<RemoteLine>,
    pub(crate) exact: bool,
}

/// Line maps from the ours and theirs views of the disk to the panes showing ours and theirs
/// (untyped git-order lines until `located` orients them), and from local and remote to base.
pub(crate) struct Maps {
    orientation: Orientation,
    ours_to_pane: LineMap,
    theirs_to_pane: LineMap,
    local_to_base: LineMap,
    remote_to_base: LineMap,
}

pub(crate) fn side_view(
    lines: &[&str],
    pieces: &[Piece],
    section: fn(&Block) -> &Range<usize>,
) -> SideView {
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
    end_last_line(&mut view.text);
    view
}

impl Maps {
    pub(crate) fn new(
        ours: &SideView,
        theirs: &SideView,
        texts: &Texts,
        orientation: Orientation,
    ) -> Maps {
        let pane_of = |side| side_text(texts.pane(orientation.pane(side)));
        Maps {
            orientation,
            ours_to_pane: line_map(&ours.text, &pane_of(GitSide::Ours)),
            theirs_to_pane: line_map(&theirs.text, &pane_of(GitSide::Theirs)),
            local_to_base: line_map(&texts.local, &texts.base),
            remote_to_base: line_map(&texts.remote, &texts.base),
        }
    }

    pub(crate) fn block(&self, block: &Block, ours_start: u32, theirs_start: u32) -> Located {
        let ours = ours_start..ours_start + line_number(block.ours.len());
        let theirs = theirs_start..theirs_start + line_number(block.theirs.len());
        match (
            self.ours_to_pane.exact(ours.clone()),
            self.theirs_to_pane.exact(theirs.clone()),
        ) {
            (Some(ours), Some(theirs)) => self.located(ours, theirs, true),
            (None, _) | (_, None) => self.located(
                self.ours_to_pane.covering(ours),
                self.theirs_to_pane.covering(theirs),
                false,
            ),
        }
    }

    pub(crate) fn raw(&self, ours_start: u32, theirs_start: u32) -> Located {
        self.located(
            self.ours_to_pane.covering(ours_start..ours_start),
            self.theirs_to_pane.covering(theirs_start..theirs_start),
            false,
        )
    }

    fn located(&self, ours: Range<u32>, theirs: Range<u32>, exact: bool) -> Located {
        let (left, right) = self.orientation.panes(ours, theirs);
        Located {
            local: local_lines(left),
            remote: remote_lines(right),
            exact,
        }
    }

    /// The base lines that the located local and remote lines cover.
    pub(crate) fn base(&self, located: &Located) -> LineRange<BaseLine> {
        let local = located.local.start.0..located.local.end().0;
        let remote = located.remote.start.0..located.remote.end().0;
        let from_local = self.local_to_base.covering(local);
        let from_remote = self.remote_to_base.covering(remote);
        let start = from_local.start.min(from_remote.start);
        LineRange {
            start: BaseLine(start),
            len: from_local.end.max(from_remote.end) - start,
        }
    }
}

/// A side's text read as its view is: `\r\n` as `\n`, every line ended.
// git ends a section's last line before the marker after it, also the last line of a side
// without a line break (xdiff/xmerge.c `fill_conflict_hunk`, observed on git 2.56).
fn side_text(text: &str) -> String {
    let mut side = text.replace("\r\n", "\n");
    end_last_line(&mut side);
    side
}

fn end_last_line(text: &mut String) {
    if !text.is_empty() && !text.ends_with('\n') {
        text.push('\n');
    }
}

fn local_lines(lines: Range<u32>) -> LineRange<LocalLine> {
    LineRange {
        start: LocalLine(lines.start),
        len: lines.end - lines.start,
    }
}

fn remote_lines(lines: Range<u32>) -> LineRange<RemoteLine> {
    LineRange {
        start: RemoteLine(lines.start),
        len: lines.end - lines.start,
    }
}

pub(crate) fn line_number(count: usize) -> u32 {
    u32::try_from(count).unwrap_or(u32::MAX)
}

#[cfg(test)]
mod tests {
    use crate::markers::DEFAULT_MARKER_SIZE;
    use crate::merge_data::Texts;
    use crate::orientation::{OURS_LEFT, Orientation, THEIRS_LEFT};
    use crate::seed::seed;
    use crate::waiting::Waiting;

    const OURS_THEN_THEIRS: &str = "a\n<<<<<<< HEAD\nO1\nO2\n=======\nT\n>>>>>>> theirs\nz\n";

    fn texts(local: &str, remote: &str) -> Texts {
        Texts {
            base: "a\nb\nz\n".to_owned(),
            local: local.to_owned(),
            remote: remote.to_owned(),
            deleted: None,
        }
    }

    fn located(disk: &str, texts: &Texts, orientation: Orientation) -> [(u32, u32); 2] {
        let seeded = seed(disk, DEFAULT_MARKER_SIZE, texts, orientation);
        let [chunk] = &seeded.chunks[..] else {
            panic!("expected one chunk: {:?}", seeded.chunks);
        };
        let (local, remote) = (chunk.chunk.local, chunk.chunk.remote);
        [(local.start.0, local.len), (remote.start.0, remote.len)]
    }

    #[test]
    fn a_block_s_sections_are_located_in_the_panes_showing_ours_and_theirs() {
        let ours = "a\nO1\nO2\nz\n";
        let theirs = "a\nT\nz\n";

        let ours_left = located(OURS_THEN_THEIRS, &texts(ours, theirs), OURS_LEFT);
        let theirs_left = located(OURS_THEN_THEIRS, &texts(theirs, ours), THEIRS_LEFT);

        assert_eq!(ours_left, [(1, 2), (1, 1)]);
        assert_eq!(theirs_left, [(1, 1), (1, 2)]);
        let edited = OURS_THEN_THEIRS.replace("O1\n", "O1, edited\n");
        assert_eq!(
            located(&edited, &texts(theirs, ours), THEIRS_LEFT)[0],
            (1, 1)
        );
    }

    #[test]
    fn an_empty_ours_section_is_an_insertion_point_in_local() {
        let texts = Texts {
            base: "a\nb\nc\n".to_owned(),
            local: "a\nc\n".to_owned(),
            remote: "a\nB\nc\n".to_owned(),
            deleted: None,
        };
        let disk = "a\n<<<<<<< ours\n=======\nB\n>>>>>>> theirs\nc\n";

        assert_eq!(located(disk, &texts, OURS_LEFT), [(1, 0), (1, 1)]);
        assert_eq!(
            seed(disk, DEFAULT_MARKER_SIZE, &texts, OURS_LEFT).middle,
            "a\nb\nc\n"
        );
    }

    #[test]
    fn a_section_holding_a_side_s_last_line_without_a_line_break_is_located_exactly() {
        let texts = Texts {
            base: "a\nb".to_owned(),
            local: "a\nL".to_owned(),
            remote: "a\nR".to_owned(),
            deleted: None,
        };
        let disk = "a\n<<<<<<< ours\nL\n||||||| base\nb\n=======\nR\n>>>>>>> theirs\n";

        let seeded = seed(disk, DEFAULT_MARKER_SIZE, &texts, OURS_LEFT);

        assert_eq!(seeded.middle, "a\nb");
        let [chunk] = &seeded.chunks[..] else {
            panic!("expected one chunk: {:?}", seeded.chunks);
        };
        assert!(
            matches!(chunk.waiting, Waiting::Markers { .. }),
            "{chunk:?}"
        );
    }

    #[test]
    fn a_file_that_is_one_raw_region_links_it_to_every_side_line_with_or_without_a_last_line_break()
    {
        for (local, remote) in [("L\n", "R\n"), ("L", "R")] {
            let texts = Texts {
                base: String::new(),
                local: local.to_owned(),
                remote: remote.to_owned(),
                deleted: None,
            };
            let disk = "<<<<<<< ours\nL\nR\n>>>>>>> theirs\n";

            let seeded = seed(disk, DEFAULT_MARKER_SIZE, &texts, OURS_LEFT);

            let [chunk] = &seeded.chunks[..] else {
                panic!("expected one chunk: {:?}", seeded.chunks);
            };
            assert_eq!(chunk.waiting, Waiting::AsShown);
            let local = chunk.chunk.local;
            let remote = chunk.chunk.remote;
            assert_eq!(
                [(local.start.0, local.len), (remote.start.0, remote.len)],
                [(0, 1), (0, 1)]
            );
        }
    }
}
