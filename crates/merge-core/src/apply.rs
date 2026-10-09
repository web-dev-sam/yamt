use crate::chunk::{Chunk, ChunkKind};
use crate::line::{lines_in, split_lines};

/// The merge text when every non-`Conflict` chunk is taken and every `Conflict` keeps its base lines.
#[must_use]
pub fn apply_non_conflicting(base: &str, local: &str, remote: &str, chunks: &[Chunk]) -> String {
    let base_lines = split_lines(base);
    let local_lines = split_lines(local);
    let remote_lines = split_lines(remote);
    let mut merged = String::with_capacity(base.len());
    let mut next_base_line = 0;
    for chunk in chunks {
        let unchanged = next_base_line..chunk.base.start.0;
        let taken = match chunk.kind {
            ChunkKind::LocalOnly | ChunkKind::BothSame => {
                lines_in(&local_lines, &(chunk.local.start.0..chunk.local.end().0))
            }
            ChunkKind::RemoteOnly => {
                lines_in(&remote_lines, &(chunk.remote.start.0..chunk.remote.end().0))
            }
            ChunkKind::Conflict => lines_in(&base_lines, &(chunk.base.start.0..chunk.base.end().0)),
        };
        merged.extend(lines_in(&base_lines, &unchanged).iter().copied());
        merged.extend(taken.iter().copied());
        next_base_line = chunk.base.end().0;
    }
    let rest = base_lines
        .get(next_base_line as usize..)
        .unwrap_or_default();
    merged.extend(rest.iter().copied());
    merged
}
