use std::collections::BTreeMap;
use std::fmt::Write;

const TARGET: &str = "frontend";

#[derive(Debug, serde::Deserialize, specta::Type)]
pub struct LogEntry {
    pub level: LogLevel,
    pub event: String,
    pub fields: BTreeMap<String, LogValue>,
}

#[derive(Debug, serde::Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Debug, serde::Deserialize, specta::Type)]
#[serde(untagged)]
pub enum LogValue {
    Text(String),
    Number(f64),
    Flag(bool),
}

impl LogEntry {
    pub(crate) fn emit(&self) {
        let event = &self.event;
        let fields = fields_text(&self.fields);
        match self.level {
            LogLevel::Debug => tracing::debug!(target: TARGET, event, fields),
            LogLevel::Info => tracing::info!(target: TARGET, event, fields),
            LogLevel::Warn => tracing::warn!(target: TARGET, event, fields),
            LogLevel::Error => tracing::error!(target: TARGET, event, fields),
        }
    }
}

fn fields_text(fields: &BTreeMap<String, LogValue>) -> String {
    let mut text = String::new();
    for (name, value) in fields {
        if !text.is_empty() {
            text.push(' ');
        }
        let _ = match value {
            LogValue::Text(value) => write!(text, "{name}={value:?}"),
            LogValue::Number(value) => write!(text, "{name}={value}"),
            LogValue::Flag(value) => write!(text, "{name}={value}"),
        };
    }
    text
}

#[cfg(test)]
mod tests {
    use std::io;
    use std::sync::{Arc, Mutex, PoisonError};

    use super::*;

    #[derive(Clone, Default)]
    struct Captured(Arc<Mutex<Vec<u8>>>);

    impl io::Write for Captured {
        fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
            let mut buffer = self.0.lock().unwrap_or_else(PoisonError::into_inner);
            buffer.extend_from_slice(bytes);
            Ok(bytes.len())
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    fn emitted(entry: &LogEntry) -> String {
        let captured = Captured::default();
        let writer = captured.clone();
        let subscriber = tracing_subscriber::fmt()
            .with_max_level(tracing::Level::DEBUG)
            .with_ansi(false)
            .without_time()
            .with_writer(move || writer.clone())
            .finish();
        tracing::subscriber::with_default(subscriber, || entry.emit());
        let bytes = captured
            .0
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone();
        String::from_utf8(bytes).unwrap()
    }

    fn entry(json: &str) -> LogEntry {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn frontend_entry_is_logged_at_its_level_with_event_and_fields() {
        let line = emitted(&entry(
            r#"{"level":"warn","event":"scroll.drift","fields":{"lines":3,"ok":true,"name":"a b"}}"#,
        ));
        assert_eq!(
            line.trim_end(),
            r#" WARN frontend: event="scroll.drift" fields="lines=3 name=\"a b\" ok=true""#
        );
    }

    #[test]
    fn each_level_reaches_its_tracing_level() {
        for (level, shown) in [
            ("debug", "DEBUG"),
            ("info", " INFO"),
            ("warn", " WARN"),
            ("error", "ERROR"),
        ] {
            let json = format!(r#"{{"level":"{level}","event":"e","fields":{{}}}}"#);
            let line = emitted(&entry(&json));
            assert!(line.starts_with(&format!("{shown} frontend:")), "{line}");
        }
    }

    #[test]
    fn fractional_number_keeps_its_fraction() {
        let text =
            fields_text(&entry(r#"{"level":"info","event":"e","fields":{"ratio":0.5}}"#).fields);
        assert_eq!(text, "ratio=0.5");
    }
}
