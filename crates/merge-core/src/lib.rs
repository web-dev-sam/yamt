//! Pure three-way chunk model: base, local and remote text in, classified chunks out.
#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod apply;
mod chunk;
mod compute;
mod line;
mod word;

pub use apply::apply_non_conflicting;
pub use chunk::{Chunk, ChunkId, ChunkKind};
pub use compute::{DEFAULT_GAP, Options, compute_chunks};
pub use line::{BaseLine, InlineRange, LineRange, LocalLine, RemoteLine};
pub use word::{WordChanges, word_changes};
