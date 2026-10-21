use std::ops::Range;
use std::path::{Path, PathBuf};

use yamt_gitio::Repo;
use yamt_merge_core::{
    BaseLine, Chunk, ChunkId, ChunkKind, LineRange, WordChanges, line_map, word_changes,
};

use crate::decode::detect_eol;
use crate::disk::DiskVersion;
use crate::locate::{Maps, line_number, side_view};
use crate::markers::{DEFAULT_MARKER_SIZE, Piece, open_regions, parse, split_lines};
use crate::merge_data::{
    FileMergeData, MergeChunk, MiddleLine, Texts, disk_text, shown_merge_data,
};
use crate::orientation::Orientation;
use crate::seed::Seeded;
use crate::session::LOG_TARGET;
use crate::waiting::Waiting;

/// The paths rerere tracks at this stop, read once, when the first file looks resolved at open.
pub(crate) enum RerereTracked {
    Unread,
    /// No `MERGE_RR`, or it could not be read.
    Off,
    Paths(Vec<PathBuf>),
}

impl RerereTracked {
    /// rerere replayed a resolution into `path`: `MERGE_RR` exists and no longer lists it.
    pub(crate) fn has_replayed(&mut self, repo: &Repo, path: &Path) -> bool {
        if let RerereTracked::Unread = self {
            *self = match repo.rerere_tracked() {
                Ok(Some(paths)) => RerereTracked::Paths(paths),
                Ok(None) => RerereTracked::Off,
                Err(error) => {
                    tracing::warn!(target: LOG_TARGET, event = "rerere_unread", %error, "no file counts as remembered");
                    RerereTracked::Off
                }
            };
        }
        match self {
            RerereTracked::Paths(paths) => !paths.iter().any(|tracked| tracked == path),
            RerereTracked::Unread | RerereTracked::Off => false,
        }
    }
}

/// git's merge output has conflict blocks and the disk file has no marker line left.
pub(crate) fn looks_resolved(git_output: &[u8], disk: &[u8], marker_size: usize) -> bool {
    let has_block = parse(&split_lines(git_output), marker_size)
        .iter()
        .any(|piece| matches!(piece, Piece::Block(_)));
    has_block && open_regions(&parse(&split_lines(disk), marker_size)) == 0
}

/// The remembered view of a showcase case (`yamt-cli fixture`, plan §2 #90), ours on the left and
/// git's default marker size: `remembered` as the Result, each block of `git_output` a conflict.
#[must_use]
pub fn remembered_data(
    path: &str,
    base: &str,
    local: &str,
    remote: &str,
    remembered: &str,
    git_output: &str,
) -> FileMergeData {
    let texts = Texts {
        base: base.to_owned(),
        local: local.to_owned(),
        remote: remote.to_owned(),
        deleted: None,
    };
    remembered_merge_data(
        path,
        &texts,
        remembered.as_bytes(),
        git_output.as_bytes(),
        DEFAULT_MARKER_SIZE,
        Orientation::NO_OPERATION,
        DiskVersion(0),
    )
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
        chunks: remembered_chunks(text, git_output, marker_size, texts, orientation),
    });
    shown_merge_data(path, texts, seeded, disk_version)
}

/// Each block git wrote, located in the stages as the disk view locates one, and its lines in
/// `shown` found by a line map from git's output.
fn remembered_chunks(
    shown: &str,
    git_output: &[u8],
    marker_size: usize,
    texts: &Texts,
    orientation: Orientation,
) -> Vec<MergeChunk> {
    let Ok(output) = std::str::from_utf8(git_output) else {
        return Vec::new();
    };
    let output_lines: Vec<&str> = output.split_inclusive('\n').collect();
    let pieces = parse(&split_lines(git_output), marker_size);
    let ours = side_view(&output_lines, &pieces, |block| &block.ours);
    let theirs = side_view(&output_lines, &pieces, |block| &block.theirs);
    let maps = Maps::new(&ours, &theirs, texts, orientation);
    let to_shown = line_map(output, shown);
    let (mut chunks, mut middles) = (Vec::new(), Vec::new());
    let (mut base_end, mut middle_end) = (0, 0);
    let starts = ours.piece_starts.into_iter().zip(theirs.piece_starts);
    for (piece, (ours_start, theirs_start)) in pieces.iter().zip(starts) {
        let Piece::Block(block) = piece else {
            continue;
        };
        let located = maps.block(block, ours_start, theirs_start);
        let base = maps.base(&located);
        let base = after_previous(base.start.0..base.end().0, &mut base_end);
        let whole = line_number(block.whole.start)..line_number(block.whole.end);
        middles.push(after_previous(to_shown.covering(whole), &mut middle_end));
        chunks.push(Chunk {
            id: ChunkId(line_number(chunks.len())),
            kind: ChunkKind::Conflict,
            base: LineRange {
                start: BaseLine(base.start),
                len: base.end - base.start,
            },
            local: located.local,
            remote: located.remote,
        });
    }
    let words = word_changes(&texts.base, &texts.local, &texts.remote, &chunks);
    waiting_chunks(chunks, middles, words)
}

/// `lines` without those before `end`, where the previous chunk's lines end; `end` moves to theirs.
fn after_previous(lines: Range<u32>, end: &mut u32) -> Range<u32> {
    let start = lines.start.max(*end);
    let after = start..lines.end.max(start);
    *end = after.end;
    after
}

fn waiting_chunks(
    chunks: Vec<Chunk>,
    middles: Vec<Range<u32>>,
    words: Vec<WordChanges>,
) -> Vec<MergeChunk> {
    let mut waiting = Vec::with_capacity(chunks.len());
    for ((chunk, middle), words) in chunks.into_iter().zip(middles).zip(words) {
        waiting.push(MergeChunk {
            chunk,
            middle: LineRange {
                start: MiddleLine(middle.start),
                len: middle.end - middle.start,
            },
            words,
            waiting: Waiting::Remembered,
        });
    }
    waiting
}
