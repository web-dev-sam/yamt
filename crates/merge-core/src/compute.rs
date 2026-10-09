use std::ops::Range;

use imara_diff::{Algorithm, Diff, Hunk, InternedInput};

use crate::chunk::{Chunk, ChunkId, ChunkKind, Options};
use crate::line::{BaseLine, LineRange, LocalLine, RemoteLine, lines_in, split_lines};

#[derive(Clone, Copy)]
enum Side {
    Local,
    Remote,
}

#[derive(Clone, Copy)]
enum Touched {
    Local,
    Remote,
    Both,
}

impl Touched {
    fn by(side: Side) -> Touched {
        match side {
            Side::Local => Touched::Local,
            Side::Remote => Touched::Remote,
        }
    }

    fn and(self, side: Side) -> Touched {
        match (self, side) {
            (Touched::Local, Side::Local) => Touched::Local,
            (Touched::Remote, Side::Remote) => Touched::Remote,
            (Touched::Local, Side::Remote)
            | (Touched::Remote, Side::Local)
            | (Touched::Both, Side::Local | Side::Remote) => Touched::Both,
        }
    }
}

struct Region {
    base: Range<u32>,
    touched: Touched,
}

struct SideDiff<'a> {
    hunks: Vec<Hunk>,
    lines: Vec<&'a str>,
}

impl<'a> SideDiff<'a> {
    fn new(base: &str, side: &'a str) -> SideDiff<'a> {
        let input = InternedInput::new(base, side);
        let mut diff = Diff::compute(Algorithm::Histogram, &input);
        diff.postprocess_lines(&input);
        SideDiff {
            hunks: diff.hunks().collect(),
            lines: split_lines(side),
        }
    }

    fn map(&self, base: &Range<u32>) -> Range<u32> {
        let starting_before = self
            .hunks
            .partition_point(|hunk| hunk.before.start < base.start);
        let starting_within = self
            .hunks
            .partition_point(|hunk| hunk.before.start <= base.end);
        self.side_line(starting_before, base.start)..self.side_line(starting_within, base.end)
    }

    fn side_line(&self, preceding_hunks: usize, base_line: u32) -> u32 {
        let last_preceding = preceding_hunks
            .checked_sub(1)
            .and_then(|index| self.hunks.get(index));
        match last_preceding {
            Some(hunk) => hunk.after.end + (base_line - hunk.before.end),
            None => base_line,
        }
    }

    fn text(&self, range: &Range<u32>) -> &[&str] {
        lines_in(&self.lines, range)
    }
}

/// Splits three texts into the chunks where local or remote differs from base, in base order.
#[must_use]
pub fn compute_chunks(base: &str, local: &str, remote: &str, opts: &Options) -> Vec<Chunk> {
    let local = SideDiff::new(base, local);
    let remote = SideDiff::new(base, remote);
    let regions = sweep(&local.hunks, &remote.hunks, opts.gap);
    let mut chunks = Vec::with_capacity(regions.len());
    for (id, region) in (0..).zip(regions) {
        let local_range = local.map(&region.base);
        let remote_range = remote.map(&region.base);
        let kind = classify(
            region.touched,
            local.text(&local_range),
            remote.text(&remote_range),
        );
        chunks.push(Chunk {
            id: ChunkId(id),
            kind,
            base: LineRange {
                start: BaseLine(region.base.start),
                len: line_count(&region.base),
            },
            local: LineRange {
                start: LocalLine(local_range.start),
                len: line_count(&local_range),
            },
            remote: LineRange {
                start: RemoteLine(remote_range.start),
                len: line_count(&remote_range),
            },
        });
    }
    chunks
}

fn sweep(local: &[Hunk], remote: &[Hunk], gap: u32) -> Vec<Region> {
    let mut tagged = Vec::with_capacity(local.len() + remote.len());
    for hunk in local {
        tagged.push((hunk.before.clone(), Side::Local));
    }
    for hunk in remote {
        tagged.push((hunk.before.clone(), Side::Remote));
    }
    tagged.sort_by_key(|(base, _)| base.start);
    let mut regions: Vec<Region> = Vec::new();
    for (base, side) in tagged {
        match regions.last_mut() {
            Some(region) if base.start <= region.base.end.saturating_add(gap) => {
                region.base.end = region.base.end.max(base.end);
                region.touched = region.touched.and(side);
            }
            Some(_) | None => regions.push(Region {
                base,
                touched: Touched::by(side),
            }),
        }
    }
    regions
}

fn classify(touched: Touched, local_text: &[&str], remote_text: &[&str]) -> ChunkKind {
    match touched {
        Touched::Local => ChunkKind::LocalOnly,
        Touched::Remote => ChunkKind::RemoteOnly,
        Touched::Both if local_text == remote_text => ChunkKind::BothSame,
        Touched::Both => ChunkKind::Conflict,
    }
}

fn line_count(range: &Range<u32>) -> u32 {
    range.end - range.start
}
