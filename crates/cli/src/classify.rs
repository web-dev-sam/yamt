use std::path::PathBuf;

use yamt_merge_core::{Chunk, ChunkKind, Options, compute_chunks};

use crate::case::read_text;
use crate::{Result, print, print_lines};

pub(crate) fn classify(sides: &[PathBuf; 3], options: Options, json: bool) -> Result<()> {
    let [base, local, remote] = sides;
    let base = read_text(base)?;
    let local = read_text(local)?;
    let remote = read_text(remote)?;
    let chunks = compute_chunks(&base, &local, &remote, &options);
    if json {
        print(&chunks_json(&chunks)?)
    } else {
        print_lines(&chunk_table(&chunks))
    }
}

pub(crate) fn chunks_json(chunks: &[Chunk]) -> Result<String> {
    Ok(serde_json::to_string_pretty(chunks)? + "\n")
}

fn chunk_table(chunks: &[Chunk]) -> Vec<String> {
    let mut table = Vec::with_capacity(chunks.len() + 1);
    for chunk in chunks {
        table.push(format!(
            "{} {} base[{}+{}] local[{}+{}] remote[{}+{}]",
            chunk.id.0,
            kind_name(chunk.kind),
            chunk.base.start.0,
            chunk.base.len,
            chunk.local.start.0,
            chunk.local.len,
            chunk.remote.start.0,
            chunk.remote.len,
        ));
    }
    table.push(kind_summary(chunks));
    table
}

pub(crate) fn kind_summary(chunks: &[Chunk]) -> String {
    let mut local_only = 0;
    let mut remote_only = 0;
    let mut both_same = 0;
    let mut conflict = 0;
    for chunk in chunks {
        match chunk.kind {
            ChunkKind::LocalOnly => local_only += 1,
            ChunkKind::RemoteOnly => remote_only += 1,
            ChunkKind::BothSame => both_same += 1,
            ChunkKind::Conflict => conflict += 1,
        }
    }
    format!(
        "total {}: LocalOnly {local_only}, RemoteOnly {remote_only}, BothSame {both_same}, Conflict {conflict}",
        chunks.len()
    )
}

fn kind_name(kind: ChunkKind) -> &'static str {
    match kind {
        ChunkKind::LocalOnly => "LocalOnly",
        ChunkKind::RemoteOnly => "RemoteOnly",
        ChunkKind::BothSame => "BothSame",
        ChunkKind::Conflict => "Conflict",
    }
}
