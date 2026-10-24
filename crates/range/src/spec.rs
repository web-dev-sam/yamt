const DOTS: &str = "..";
const EMPTY_SIDE: &str = "HEAD";

/// A range as the user typed it: `a..b` compares the two commits, `a...b` where `b` branched off `a` with `b`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RangeSpec {
    text: String,
    pub(crate) left: String,
    pub(crate) dots: Dots,
    pub(crate) right: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Dots {
    Two,
    Three,
}

#[derive(Debug, PartialEq, Eq, thiserror::Error)]
pub enum SpecError {
    #[error("--diff= needs a range, such as main...dev")]
    Empty,
    #[error(
        "--diff={text}: a range needs two dots (a..b) or three (a...b); yamt does not compare the working tree"
    )]
    NoDots { text: String },
    #[error("--diff={text}: a range holds one \"..\" or \"...\"")]
    ExtraDots { text: String },
    #[error("--diff={text}: a side may not start with \"-\"")]
    Dash { text: String },
}

impl RangeSpec {
    pub fn parse(text: &str) -> Result<RangeSpec, SpecError> {
        if text.is_empty() {
            return Err(SpecError::Empty);
        }
        let Some((left, rest)) = text.split_once(DOTS) else {
            return Err(SpecError::NoDots {
                text: text.to_owned(),
            });
        };
        let (dots, right) = match rest.strip_prefix('.') {
            Some(right) => (Dots::Three, right),
            None => (Dots::Two, rest),
        };
        if right.starts_with('.') || right.contains(DOTS) {
            return Err(SpecError::ExtraDots {
                text: text.to_owned(),
            });
        }
        if left.starts_with('-') || right.starts_with('-') {
            return Err(SpecError::Dash {
                text: text.to_owned(),
            });
        }
        Ok(RangeSpec {
            text: text.to_owned(),
            left: side_name(left),
            dots,
            right: side_name(right),
        })
    }

    #[must_use]
    pub fn text(&self) -> &str {
        &self.text
    }
}

fn side_name(typed: &str) -> String {
    if typed.is_empty() {
        EMPTY_SIDE.to_owned()
    } else {
        typed.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sides(text: &str) -> (String, Dots, String) {
        let spec = RangeSpec::parse(text).unwrap();
        assert_eq!(spec.text(), text);
        (spec.left, spec.dots, spec.right)
    }

    fn owned(left: &str, dots: Dots, right: &str) -> (String, Dots, String) {
        (left.to_owned(), dots, right.to_owned())
    }

    #[test]
    fn two_dots_three_dots_and_empty_sides_read_as_typed_or_head() {
        assert_eq!(sides("v1.2..v1.3"), owned("v1.2", Dots::Two, "v1.3"));
        assert_eq!(sides("HEAD~3...main"), owned("HEAD~3", Dots::Three, "main"));
        assert_eq!(sides("@{u}.."), owned("@{u}", Dots::Two, "HEAD"));
        assert_eq!(sides(".."), owned("HEAD", Dots::Two, "HEAD"));
        assert_eq!(sides("...dev"), owned("HEAD", Dots::Three, "dev"));
        assert_eq!(sides("a.b..c-d"), owned("a.b", Dots::Two, "c-d"));
    }

    #[test]
    fn every_malformed_range_is_its_error() {
        let refused = |text: &str| RangeSpec::parse(text).unwrap_err();
        let text = |text: &str| text.to_owned();
        assert_eq!(refused(""), SpecError::Empty);
        assert_eq!(refused("main"), SpecError::NoDots { text: text("main") });
        assert_eq!(refused("a.b"), SpecError::NoDots { text: text("a.b") });
        assert_eq!(
            refused("a....b"),
            SpecError::ExtraDots {
                text: text("a....b")
            }
        );
        assert_eq!(
            refused("a..b..c"),
            SpecError::ExtraDots {
                text: text("a..b..c")
            }
        );
        assert_eq!(
            refused("a...b...c"),
            SpecError::ExtraDots {
                text: text("a...b...c")
            }
        );
        assert_eq!(
            refused("-x..b"),
            SpecError::Dash {
                text: text("-x..b")
            }
        );
        assert_eq!(
            refused("a...-x"),
            SpecError::Dash {
                text: text("a...-x")
            }
        );
    }

    #[test]
    fn each_error_is_its_usage_line() {
        let line = |text: &str| RangeSpec::parse(text).unwrap_err().to_string();
        assert_eq!(line(""), "--diff= needs a range, such as main...dev");
        assert_eq!(
            line("main"),
            "--diff=main: a range needs two dots (a..b) or three (a...b); yamt does not compare the working tree"
        );
        assert_eq!(
            line("a....b"),
            "--diff=a....b: a range holds one \"..\" or \"...\""
        );
        assert_eq!(
            line("-x..b"),
            "--diff=-x..b: a side may not start with \"-\""
        );
    }
}
