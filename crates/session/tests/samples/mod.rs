//! git's own sample merge (`.omp/run/markers/make.sh`): two conflicts around a settled `=======`.

pub const BASE: &str = include_str!("../markers/base.txt");
pub const OURS: &str = include_str!("../markers/ours.txt");
pub const THEIRS: &str = include_str!("../markers/theirs.txt");
/// The middle seeded from the sample with its second block resolved to `eight-theirs` by hand.
pub const WORKED_MIDDLE: &str =
    "title\n=======\none\ntwo\nthree\nshared-b\nfour\nfive\nsix\nseven\neight-theirs\nnine\nten\n";

/// `text` with its `index`-th open block (from `<<<<<<<` to `>>>>>>>`) replaced by `resolution`.
pub fn with_block_resolved(text: &str, index: usize, resolution: &str) -> String {
    let mut resolved = String::new();
    let mut blocks_seen = 0;
    let mut inside = false;
    for line in text.split_inclusive('\n') {
        if line.starts_with("<<<<<<<") {
            inside = blocks_seen == index;
            blocks_seen += 1;
            if inside {
                resolved.push_str(resolution);
                continue;
            }
        }
        if !inside {
            resolved.push_str(line);
        } else if line.starts_with(">>>>>>>") {
            inside = false;
        }
    }
    resolved
}
