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

// `fixup -C` takes the commit's message as it is; only `-c` opens the editor (git-rebase(1)).
pub(crate) fn has_editor_steps(todo: &[u8]) -> bool {
    commands(todo).any(|command| {
        let mut words = words(command);
        match (words.next(), words.next()) {
            (Some(b"reword" | b"r" | b"squash" | b"s"), _)
            | (Some(b"fixup" | b"f"), Some(b"-c")) => true,
            (Some(_) | None, _) => false,
        }
    })
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
}
