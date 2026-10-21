use std::ops::Range;

use yamt_merge_core::{
    BaseLine, Chunk, ChunkId, ChunkKind, LineRange, LocalLine, RemoteLine, line_map, word_changes,
};

use crate::decode::detect_eol;
use crate::disk::DiskVersion;
use crate::locate::{Placed, line_number, mapped_text, place_pieces};
use crate::markers::{parse, split_lines};
use crate::merge_data::{
    FileMergeData, MergeChunk, MiddleLine, Texts, disk_text, shown_merge_data,
};
use crate::orientation::Orientation;
use crate::seed::Seeded;
use crate::waiting::{MarkerStyle, Waiting};

/// What git rerere left in a file: git's merge output with its conflict blocks, and the resolution
/// rerere replayed over it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Replayed {
    pub git_output: String,
    pub resolution: String,
}

/// The remembered view's conflicts, and whether every block of git's output was found unchanged in
/// the sides.
struct RememberedChunks {
    chunks: Vec<MergeChunk>,
    exact: bool,
}

/// One conflict in plain line numbers: its base, local and remote lines, and its lines in the
/// shown text.
struct Spans {
    base: Range<u32>,
    local: Range<u32>,
    remote: Range<u32>,
    middle: Range<u32>,
}

/// The remembered view (plan §2 #90) of a file from its three sides: the resolution as the Result,
/// each block of git's output a conflict; `None` when a block is not found unchanged in the sides,
/// so the output was made from other sides.
#[must_use]
pub fn remembered_data(
    path: &str,
    base: &str,
    local: &str,
    remote: &str,
    replayed: &Replayed,
    style: &MarkerStyle,
    disk_version: DiskVersion,
) -> Option<FileMergeData> {
    let texts = Texts {
        base: base.to_owned(),
        local: local.to_owned(),
        remote: remote.to_owned(),
        deleted: None,
    };
    let resolution = &replayed.resolution;
    let found = remembered_chunks(
        resolution,
        replayed.git_output.as_bytes(),
        style.marker_size,
        &texts,
        style.orientation,
    );
    if !found.exact {
        return None;
    }
    let seeded = Seeded {
        middle: resolution.clone(),
        eol: detect_eol(resolution),
        chunks: found.chunks,
    };
    Some(shown_merge_data(path, &texts, Ok(seeded), disk_version))
}

/// The remembered view (plan §2 #90): the file `shown` as the Result, and each block of
/// `git_output` as a conflict that waits as `Waiting::Remembered`.
pub(crate) fn remembered_merge_data(
    path: &str,
    texts: &Texts,
    shown: &[u8],
    git_output: &[u8],
    marker_size: usize,
    orientation: Orientation,
    disk_version: DiskVersion,
) -> FileMergeData {
    let seeded = disk_text(shown).map(|text| Seeded {
        middle: text.to_owned(),
        eol: detect_eol(text),
        chunks: remembered_chunks(text, git_output, marker_size, texts, orientation).chunks,
    });
    shown_merge_data(path, texts, seeded, disk_version)
}

/// Each block git wrote, placed in the stages as the disk view places one, and its lines in `shown`
/// found by a line map from git's output; blocks whose lines in `shown` overlap are one conflict.
fn remembered_chunks(
    shown: &str,
    git_output: &[u8],
    marker_size: usize,
    texts: &Texts,
    orientation: Orientation,
) -> RememberedChunks {
    let Ok(output) = std::str::from_utf8(git_output) else {
        return RememberedChunks {
            chunks: Vec::new(),
            exact: false,
        };
    };
    let output_lines: Vec<&str> = output.split_inclusive('\n').collect();
    let pieces = parse(&split_lines(git_output), marker_size);
    let to_shown = line_map(&mapped_text(output), &mapped_text(shown));
    let mut conflicts: Vec<Spans> = Vec::new();
    let mut exact = true;
    for piece in place_pieces(&output_lines, &pieces, texts, orientation) {
        let Placed::Block {
            block,
            located,
            base,
        } = piece
        else {
            continue;
        };
        exact &= located.exact;
        let whole = line_number(block.whole.start)..line_number(block.whole.end);
        let spans = Spans {
            base: base.start.0..base.end().0,
            local: located.local.start.0..located.local.end().0,
            remote: located.remote.start.0..located.remote.end().0,
            middle: to_shown.covering(whole),
        };
        match conflicts.last_mut() {
            Some(previous) if spans.middle.start < previous.middle.end => previous.join(&spans),
            Some(_) | None => conflicts.push(spans),
        }
    }
    RememberedChunks {
        chunks: waiting_chunks(conflicts, texts),
        exact,
    }
}

impl Spans {
    /// Grows every span to cover `next`'s too.
    fn join(&mut self, next: &Spans) {
        for (span, other) in [
            (&mut self.base, &next.base),
            (&mut self.local, &next.local),
            (&mut self.remote, &next.remote),
            (&mut self.middle, &next.middle),
        ] {
            *span = span.start.min(other.start)..span.end.max(other.end);
        }
    }
}

fn waiting_chunks(conflicts: Vec<Spans>, texts: &Texts) -> Vec<MergeChunk> {
    let mut chunks = Vec::with_capacity(conflicts.len());
    let mut middles = Vec::with_capacity(conflicts.len());
    for spans in conflicts {
        chunks.push(Chunk {
            id: ChunkId(line_number(chunks.len())),
            kind: ChunkKind::Conflict,
            base: LineRange {
                start: BaseLine(spans.base.start),
                len: spans.base.end - spans.base.start,
            },
            local: LineRange {
                start: LocalLine(spans.local.start),
                len: spans.local.end - spans.local.start,
            },
            remote: LineRange {
                start: RemoteLine(spans.remote.start),
                len: spans.remote.end - spans.remote.start,
            },
        });
        middles.push(LineRange {
            start: MiddleLine(spans.middle.start),
            len: spans.middle.end - spans.middle.start,
        });
    }
    let words = word_changes(&texts.base, &texts.local, &texts.remote, &chunks);
    let mut waiting = Vec::with_capacity(chunks.len());
    for ((chunk, middle), words) in chunks.into_iter().zip(middles).zip(words) {
        waiting.push(MergeChunk {
            chunk,
            middle,
            words,
            waiting: Waiting::Remembered,
        });
    }
    waiting
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::markers::DEFAULT_MARKER_SIZE;
    use crate::orientation::OURS_LEFT;

    fn texts(base: &str, local: &str, remote: &str) -> Texts {
        Texts {
            base: base.to_owned(),
            local: local.to_owned(),
            remote: remote.to_owned(),
            deleted: None,
        }
    }

    fn middles(data: &FileMergeData) -> Vec<(u32, u32)> {
        let middles = data.chunks.iter().map(|chunk| chunk.middle);
        middles.map(|middle| (middle.start.0, middle.len)).collect()
    }

    fn remembered_view(texts: &Texts, shown: &str, git_output: &str) -> FileMergeData {
        remembered_merge_data(
            "board.ts",
            texts,
            shown.as_bytes(),
            git_output.as_bytes(),
            DEFAULT_MARKER_SIZE,
            OURS_LEFT,
            DiskVersion(0),
        )
    }

    // Catches git's LF output mapped onto rerere's CRLF text (core.autocrlf): no line matches, and the
    // conflict covers the whole file (#1400).
    #[test]
    fn a_crlf_resolution_over_lf_stages_places_the_conflict_on_the_resolution_s_line() {
        let texts = texts(
            "top\none\nbottom\n",
            "top\nlocal\nbottom\n",
            "top\nremote\nbottom\n",
        );
        let git_output = "top\n<<<<<<< ours\nlocal\n=======\nremote\n>>>>>>> theirs\nbottom\n";

        let data = remembered_view(&texts, "top\r\nlocal and remote\r\nbottom\r\n", git_output);

        assert_eq!(middles(&data), [(1, 1)]);
        let chunk = &data.chunks[0].chunk;
        assert_eq!((chunk.local.start.0, chunk.local.len), (1, 1));
        assert_eq!((chunk.base.start.0, chunk.base.len), (1, 1));
    }

    // Catches git's ended last line mapped onto a resolution whose last line has no line break:
    // the line does not match, and the conflict takes it too (#1417).
    #[test]
    fn a_resolution_without_a_final_line_break_places_the_conflict_on_its_line() {
        let texts = texts(
            "top\none\nbottom\n",
            "top\nlocal\nbottom\n",
            "top\nremote\nbottom\n",
        );
        let git_output = "top\n<<<<<<< ours\nlocal\n=======\nremote\n>>>>>>> theirs\nbottom\n";

        let data = remembered_view(&texts, "top\nlocal and remote\nbottom", git_output);

        assert_eq!(middles(&data), [(1, 1)]);
    }

    // Catches two blocks whose resolutions and the line between them were edited together: the first
    // conflict took every changed line and the second became an empty point (#1401).
    #[test]
    fn blocks_whose_lines_in_the_resolution_overlap_join_into_one_conflict() {
        let texts = texts(
            "a\nb1\nm\nb2\nz\n",
            "a\nL1\nm\nL2\nz\n",
            "a\nR1\nm\nR2\nz\n",
        );
        let block = |ours: &str, theirs: &str| {
            format!("<<<<<<< ours\n{ours}\n=======\n{theirs}\n>>>>>>> theirs\n")
        };
        let git_output = format!("a\n{}m\n{}z\n", block("L1", "R1"), block("L2", "R2"));

        let data = remembered_view(&texts, "a\nfirst\nm edited\nsecond\nz\n", &git_output);

        assert_eq!(middles(&data), [(1, 3)]);
        let chunk = &data.chunks[0].chunk;
        assert_eq!((chunk.base.start.0, chunk.base.len), (1, 3));
        assert_eq!((chunk.local.start.0, chunk.local.len), (1, 3));
        assert_eq!((chunk.remote.start.0, chunk.remote.len), (1, 3));
        assert_eq!(data.chunks[0].waiting, Waiting::Remembered);
    }

    // Catches a stale `git-output` of a showcase case passing `just fixtures` (#1396).
    #[test]
    fn remembered_data_refuses_git_output_not_made_from_these_sides() {
        let marker_style = MarkerStyle::fallback(DEFAULT_MARKER_SIZE, OURS_LEFT);
        let from_output = |git_output: &str| {
            let replayed = Replayed {
                git_output: git_output.to_owned(),
                resolution: "top\nlocal and remote\nbottom\n".to_owned(),
            };
            let (base, local, remote) = (
                "top\none\nbottom\n",
                "top\nlocal\nbottom\n",
                "top\nremote\nbottom\n",
            );
            remembered_data(
                "board.ts",
                base,
                local,
                remote,
                &replayed,
                &marker_style,
                DiskVersion(0),
            )
        };
        let made = "top\n<<<<<<< ours\nlocal\n=======\nremote\n>>>>>>> theirs\nbottom\n";
        let outdated = made.replace("remote\n>", "remote, before\n>");

        let made_view = from_output(made).map(|data| middles(&data));

        assert_eq!(made_view, Some(vec![(1, 1)]));
        assert_eq!(from_output(&outdated), None);
    }
}
