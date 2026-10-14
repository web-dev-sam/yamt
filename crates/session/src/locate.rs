use std::ops::Range;

use yamt_merge_core::{BaseLine, LineMap, LineRange, LocalLine, RemoteLine, line_map};

use crate::markers::{Block, Piece};
use crate::merge_data::Texts;

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

/// Line maps from the ours and theirs views of the disk to local and remote, and from those to base.
pub(crate) struct Maps {
    ours_to_local: LineMap,
    theirs_to_remote: LineMap,
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
    pub(crate) fn new(ours: &SideView, theirs: &SideView, texts: &Texts) -> Maps {
        Maps {
            ours_to_local: line_map(&ours.text, &side_text(&texts.local)),
            theirs_to_remote: line_map(&theirs.text, &side_text(&texts.remote)),
            local_to_base: line_map(&texts.local, &texts.base),
            remote_to_base: line_map(&texts.remote, &texts.base),
        }
    }

    pub(crate) fn block(&self, block: &Block, ours_start: u32, theirs_start: u32) -> Located {
        let ours = ours_start..ours_start + line_number(block.ours.len());
        let theirs = theirs_start..theirs_start + line_number(block.theirs.len());
        match (
            self.ours_to_local.exact(ours.clone()),
            self.theirs_to_remote.exact(theirs.clone()),
        ) {
            (Some(local), Some(remote)) => Located {
                local: local_lines(local),
                remote: remote_lines(remote),
                exact: true,
            },
            (None, _) | (_, None) => Located {
                local: local_lines(self.ours_to_local.covering(ours)),
                remote: remote_lines(self.theirs_to_remote.covering(theirs)),
                exact: false,
            },
        }
    }

    pub(crate) fn raw(&self, ours_start: u32, theirs_start: u32) -> Located {
        Located {
            local: local_lines(self.ours_to_local.covering(ours_start..ours_start)),
            remote: remote_lines(self.theirs_to_remote.covering(theirs_start..theirs_start)),
            exact: false,
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
    use crate::seed::seed;
    use crate::waiting::Waiting;

    #[test]
    fn a_section_holding_a_side_s_last_line_without_a_line_break_is_located_exactly() {
        let texts = Texts {
            base: "a\nb".to_owned(),
            local: "a\nL".to_owned(),
            remote: "a\nR".to_owned(),
            deleted: None,
        };
        let disk = "a\n<<<<<<< ours\nL\n||||||| base\nb\n=======\nR\n>>>>>>> theirs\n";

        let seeded = seed(disk, DEFAULT_MARKER_SIZE, &texts);

        assert_eq!(seeded.middle, "a\nb");
        let [chunk] = &seeded.chunks[..] else {
            panic!("expected one chunk: {:?}", seeded.chunks);
        };
        assert!(
            matches!(chunk.waiting, Waiting::Markers { .. }),
            "{chunk:?}"
        );
    }
}
