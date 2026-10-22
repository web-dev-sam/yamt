# PasteCrashClipboardR1 (3.F-clipboard fix round 1)

I added three tests for `text_from` in `src-tauri/src/clipboard.rs`, and each of the three hand mutations fails at least one of them. Clippy is clean and all 97 tests in `cargo test -p yamt-app` pass.

**summary**
- The three new tests cover finding #1563's three cases: text GTK sent comes back unchanged, GTK's NULL comes back as `None`, and a request dropped before GTK runs (sender dropped) comes back as `None`.
- The tests module changed from `#[cfg(all(test, target_os = "linux"))]` to `#[cfg(test)]`, so the new tests build on every system. The existing GDK selection test now carries `#[cfg(target_os = "linux")]` on its own.

**files_changed**
- `src-tauri/src/clipboard.rs` (tests module only; `text_from` is back to its committed text, and `git diff` shows only the test hunk)

**tests_added**
- `clipboard::tests::sent_text_comes_back_as_written`: when `Some("one\ntwo\n")` is sent on the channel, `text_from` returns exactly that text.
- `clipboard::tests::no_text_from_gtk_reads_as_none`: when `None` is sent (GTK's NULL), the result is `None`.
- `clipboard::tests::a_request_dropped_before_gtk_answers_reads_as_none`: when the sender is dropped without sending, `recv` fails and the result is `None`. This is the "main thread gone" case.
- All three run `tauri::async_runtime::block_on(text_from(answer))` through a one-line helper, `text_read_from`.

**smoke_evidence**
- `cargo clippy -p yamt-app --all-targets -- -D warnings` → `Finished `dev` profile [unoptimized + debuginfo] target(s) in 27.88s`, no warnings.
- `cargo test -p yamt-app` → `cargo test: 97 passed (4 suites, 0.00s)`, including:
  ```
  test clipboard::tests::each_selection_reads_its_own_gdk_selection ... ok
  test clipboard::tests::a_request_dropped_before_gtk_answers_reads_as_none ... ok
  test clipboard::tests::sent_text_comes_back_as_written ... ok
  test clipboard::tests::no_text_from_gtk_reads_as_none ... ok
  ```
- Mutation, body → `drop(answer); None`; `cargo test -p yamt-app clipboard::tests` →
  ```
  ---- clipboard::tests::sent_text_comes_back_as_written stdout ----
  assertion `left == right` failed
    left: None
   right: Some("one\ntwo\n")
  test result: FAILED. 3 passed; 1 failed
  ```
- Mutation, body → `drop(answer); Some(String::new())` →
  ```
  ---- clipboard::tests::a_request_dropped_before_gtk_answers_reads_as_none stdout ----
    left: Some("")
   right: None
  ---- clipboard::tests::sent_text_comes_back_as_written stdout ----
    left: Some("")
   right: Some("one\ntwo\n")
  ---- clipboard::tests::no_text_from_gtk_reads_as_none stdout ----
    left: Some("")
   right: None
  test result: FAILED. 1 passed; 3 failed
  ```
- Mutation, `.ok().flatten()` → `.ok().flatten().or(Some(String::new()))` →
  ```
  ---- clipboard::tests::no_text_from_gtk_reads_as_none stdout ----
    left: Some("")
   right: None
  ---- clipboard::tests::a_request_dropped_before_gtk_answers_reads_as_none stdout ----
    left: Some("")
   right: None
  test result: FAILED. 2 passed; 2 failed
  ```
- Each mutation was reverted after its run; the final clippy and test runs above are on the restored code.

**deviations_from_brief**
- The finding asks for one test making three checks; I wrote three tests, one per case, each named for its behaviour (RS11).
- In the first two mutations the body is `drop(answer); …` rather than a bare `None` / `Some(String::new())`, so the unused `answer` parameter raises no warning. The tested behaviour is the same.
- The `Some("xyzzy")` survivor from cargo-mutants was not run by hand. `sent_text_comes_back_as_written` and both `None` tests reject any fixed `Some(_)`, the same way they reject `Some("")`.

**open_risks**
- The tests' `.unwrap()` calls on `sender.send` (`src-tauri/src/clipboard.rs:81`, `:88`) rely on clippy.toml allowing unwrap in tests; clippy passed. No other risks known.