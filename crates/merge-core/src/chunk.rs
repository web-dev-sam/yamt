use serde::Serialize;
use specta::Type;

use crate::line::{BaseLine, LineRange, LocalLine, RemoteLine};

/// Which side changed a chunk, and whether two changes agree.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub enum ChunkKind {
    /// Only local changed these base lines.
    LocalOnly,
    /// Only remote changed these base lines.
    RemoteOnly,
    /// Local and remote made the identical change.
    BothSame,
    /// Local and remote changed these base lines differently.
    Conflict,
}

/// Index of a chunk in the `Vec` returned by `compute_chunks`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Type)]
pub struct ChunkId(pub u32);

/// One region where local or remote differs from base, located in all three texts.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub struct Chunk {
    /// Index of this chunk in its file's chunk list.
    pub id: ChunkId,
    /// Which side changed the region.
    pub kind: ChunkKind,
    /// The region in base; empty for a pure insertion.
    pub base: LineRange<BaseLine>,
    /// The region in local.
    pub local: LineRange<LocalLine>,
    /// The region in remote.
    pub remote: LineRange<RemoteLine>,
}

/// Default for `Options::gap`.
pub const DEFAULT_GAP: u32 = 1;

/// Tuning for `compute_chunks`.
#[derive(Clone, Copy, Debug)]
pub struct Options {
    /// Changes separated by at most this many unchanged base lines form one chunk.
    pub gap: u32,
}

impl Default for Options {
    fn default() -> Self {
        Options { gap: DEFAULT_GAP }
    }
}
