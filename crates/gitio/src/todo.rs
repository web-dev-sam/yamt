// git-rebase(1) "INTERACTIVE MODE": `#` starts a comment line, blank lines are skipped.
pub(crate) fn commands(todo: &[u8]) -> impl Iterator<Item = &[u8]> {
    todo.split(|&byte| byte == b'\n')
        .map(<[u8]>::trim_ascii)
        .filter(|line| !line.is_empty() && !line.starts_with(b"#"))
}

fn words(command: &[u8]) -> impl Iterator<Item = &[u8]> {
    command
        .split(u8::is_ascii_whitespace)
        .filter(|word| !word.is_empty())
}

pub(crate) fn first_command(todo: &[u8]) -> Option<&[u8]> {
    words(commands(todo).next()?).next()
}

// git appends a step to `rebase-merge/done` before it runs it, so the last one is where it stopped (observed on git
// 2.56: a conflicted `reword`, `tests/edit_stop.rs`).
pub(crate) fn last_step(done: &[u8]) -> Option<&[u8]> {
    commands(done).last()
}

pub(crate) fn is_edit_step(step: &[u8]) -> bool {
    matches!(words(step).next(), Some(b"edit" | b"e"))
}

pub(crate) fn has_editor_steps(todo: &[u8]) -> bool {
    commands(todo).any(is_editor_step)
}

// `fixup -C` takes the commit's message as it is; only `-c` opens the editor (git-rebase(1)).
pub(crate) fn is_editor_step(step: &[u8]) -> bool {
    let mut words = words(step);
    match (words.next(), words.next()) {
        (Some(b"reword" | b"r" | b"squash" | b"s"), _) | (Some(b"fixup" | b"f"), Some(b"-c")) => {
            true
        }
        (Some(_) | None, _) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn editor_steps_are_reword_squash_and_fixup_with_lower_case_c_in_any_spelling() {
        for todo in [
            "pick 1 a\nreword 2 b\n",
            "r 2 b",
            "squash 2 b",
            "s 2 b",
            "fixup -c 2 b",
            "  f\t-c 2 b",
        ] {
            assert!(has_editor_steps(todo.as_bytes()), "{todo}");
        }
        for todo in [
            "pick 1 a\nfixup 2 b\nfixup -C 3 c\nedit 4 d\n",
            "# reword 2 b\n\n",
            "rewording 2 b",
            "drop 2 b",
            "",
        ] {
            assert!(!has_editor_steps(todo.as_bytes()), "{todo}");
        }
    }

    #[test]
    fn a_sequence_command_is_the_first_word_of_the_first_line_that_is_not_a_comment() {
        assert_eq!(
            first_command(b"# note\n\n  revert 1 a\npick 2 b\n"),
            Some(&b"revert"[..])
        );
        assert_eq!(first_command(b"# only a comment\n"), None);
        assert_eq!(commands(b"pick 1\n# c\n\npick 2\n").count(), 2);
    }

    #[test]
    fn the_stopped_step_is_the_last_done_line_and_an_edit_in_either_spelling_is_an_edit() {
        let done = b"pick 1 a\nedit 2 b\n# a comment\n\n";
        assert_eq!(last_step(done), Some(&b"edit 2 b"[..]));
        assert_eq!(last_step(b""), None);
        assert!(is_edit_step(b"edit 2 b") && is_edit_step(b"e 2 b"));
        assert!(!is_edit_step(b"exec make") && !is_edit_step(b"squash 2 b"));
    }
}
