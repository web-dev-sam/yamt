//! What the window writes on Save (`editor/internal/fileText.ts`), for tests that compare it with git's file.

use yamt_merge_core::ChunkKind;
use yamt_session::{FileMergeData, Middle, Side, Waiting};

pub fn middle_text(data: &FileMergeData) -> &str {
    match &data.middle {
        Middle::Stages { text } | Middle::Disk { text } => text,
        Middle::DiskNotText { found } => panic!("not text: {found:?}"),
    }
}

pub fn lines<T: Copy>(lines: &[T], range: (u32, u32)) -> Vec<T> {
    lines[range.0 as usize..(range.0 + range.1) as usize].to_vec()
}

/// What the window's file builder writes with every change still waiting on both sides.
pub fn saved_with_everything_waiting(data: &FileMergeData) -> String {
    let mut middle: Vec<&str> = middle_text(data).split('\n').collect();
    let local: Vec<&str> = data.local.split('\n').collect();
    let remote: Vec<&str> = data.remote.split('\n').collect();
    for chunk in data.chunks.iter().rev() {
        let local = lines(&local, (chunk.chunk.local.start.0, chunk.chunk.local.len));
        let remote = lines(
            &remote,
            (chunk.chunk.remote.start.0, chunk.chunk.remote.len),
        );
        let written = match (&chunk.waiting, chunk.chunk.kind) {
            (Waiting::SideLines, ChunkKind::RemoteOnly) => remote,
            (Waiting::SideLines, _) => local,
            (
                Waiting::Markers {
                    open,
                    first,
                    between,
                    close,
                },
                _,
            ) => {
                let (first, second) = match first {
                    Side::Local => (local, remote),
                    Side::Remote => (remote, local),
                };
                let between = between.iter().map(String::as_str);
                let mut block = vec![open.as_str()];
                block.extend(first.into_iter().chain(between).chain(second));
                block.push(close);
                block
            }
            (Waiting::AsShown | Waiting::Remembered, _) => continue,
        };
        let start = chunk.middle.start.0 as usize;
        middle.splice(start..start + chunk.middle.len as usize, written);
    }
    middle.join("\n")
}
