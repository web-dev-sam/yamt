use yamt_merge_core::{
    Chunk, ChunkKind, Options, SideWordChanges, WordChanges, compute_chunks, word_changes,
};

pub const HEAD: &str = "head();\n";
pub const TAIL: &str = "tail();\n";

/// The chunk's side lines in the brief's notation: `[…]` one changed range, `⟨…⟩` one removal
/// holding its text, each `\n` of it shown as `↵`.
pub fn marked_lines<L: Copy>(
    text: &str,
    first: u32,
    len: u32,
    changes: &SideWordChanges<L>,
    index: fn(L) -> u32,
) -> Vec<String> {
    let lines: Vec<&str> = text.split_inclusive('\n').collect();
    (first..first + len)
        .map(|line| {
            let ranges: Vec<(usize, usize)> = changes
                .changed
                .iter()
                .filter(|range| index(range.line) == line)
                .map(|range| (range.start as usize, (range.start + range.len) as usize))
                .collect();
            let removals: Vec<(usize, &str)> = changes
                .removals
                .iter()
                .filter(|removal| index(removal.at.line) == line)
                .map(|removal| (removal.at.column as usize, removal.text.as_str()))
                .collect();
            marked_line(lines[line as usize], &ranges, &removals)
        })
        .collect()
}

fn marked_line(line: &str, ranges: &[(usize, usize)], removals: &[(usize, &str)]) -> String {
    let content = line
        .strip_suffix("\r\n")
        .or_else(|| line.strip_suffix('\n'))
        .unwrap_or(line);
    let mut marked = String::new();
    let mut column = 0;
    for character in content.chars().map(Some).chain([None]) {
        for _ in ranges.iter().filter(|range| range.1 == column) {
            marked.push(']');
        }
        for (_, text) in removals.iter().filter(|removal| removal.0 == column) {
            marked.push('⟨');
            marked.push_str(&text.replace('\n', "↵"));
            marked.push('⟩');
        }
        for _ in ranges.iter().filter(|range| range.0 == column) {
            marked.push('[');
        }
        if let Some(character) = character {
            marked.push(character);
            column += character.len_utf16();
        }
    }
    marked
}

pub fn only_chunk(base: &str, local: &str, remote: &str) -> (Chunk, WordChanges) {
    let chunks = compute_chunks(base, local, remote, &Options::default());
    assert_eq!(chunks.len(), 1, "{chunks:?}");
    let mut words = word_changes(base, local, remote, &chunks);
    assert_eq!(words.len(), 1);
    (chunks[0], words.remove(0))
}

/// The side's chunk lines, marked, for an edit made on local; the same edit made on remote
/// must give the same marks, and the unchanged side none.
pub fn one_sided(base: &str, side: &str) -> Vec<String> {
    let base = format!("{HEAD}{base}{TAIL}");
    let side = format!("{HEAD}{side}{TAIL}");
    let (chunk, words) = only_chunk(&base, &side, &base);
    assert_eq!(chunk.kind, ChunkKind::LocalOnly);
    assert!(words.remote.changed.is_empty() && words.remote.removals.is_empty());
    let local = marked_lines(
        &side,
        chunk.local.start.0,
        chunk.local.len,
        &words.local,
        |line| line.0,
    );
    let (chunk, words) = only_chunk(&base, &base, &side);
    assert_eq!(chunk.kind, ChunkKind::RemoteOnly);
    assert!(words.local.changed.is_empty() && words.local.removals.is_empty());
    let remote = marked_lines(
        &side,
        chunk.remote.start.0,
        chunk.remote.len,
        &words.remote,
        |line| line.0,
    );
    assert_eq!(local, remote);
    local
}
