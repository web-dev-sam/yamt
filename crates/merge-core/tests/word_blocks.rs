mod marks;

use marks::{HEAD, TAIL, marked_lines, one_sided, only_chunk};
use yamt_merge_core::{ChunkKind, Options, compute_chunks, word_changes};

fn conflict(base: &str, local: &str, remote: &str) -> (Vec<String>, Vec<String>) {
    let base = format!("{HEAD}{base}{TAIL}");
    let local = format!("{HEAD}{local}{TAIL}");
    let remote = format!("{HEAD}{remote}{TAIL}");
    let (chunk, words) = only_chunk(&base, &local, &remote);
    assert_eq!(chunk.kind, ChunkKind::Conflict);
    (
        marked_lines(
            &local,
            chunk.local.start.0,
            chunk.local.len,
            &words.local,
            |line| line.0,
        ),
        marked_lines(
            &remote,
            chunk.remote.start.0,
            chunk.remote.len,
            &words.remote,
            |line| line.0,
        ),
    )
}

#[test]
fn m1_wrapped_in_a_condition() {
    assert_eq!(
        one_sided("a();\nb();\n", "if (ok) {\n\ta();\n\tb();\n}\n"),
        ["[if (ok) {]", "[\t]a();", "[\t]b();", "[}]"]
    );
}

#[test]
fn m2_unwrapped_from_a_condition() {
    assert_eq!(
        one_sided("if (ok) {\n\ta();\n\tb();\n}\n", "a();\nb();\n"),
        ["|a();", "|b();|"]
    );
}

#[test]
fn m3_line_inserted_between_changed_lines() {
    assert_eq!(
        one_sided("a(1);\nb(1);\n", "a(2);\nlog();\nb(2);\n"),
        ["a([2]);", "[log();]", "b([2]);"]
    );
}

#[test]
fn m4_line_removed_between_changed_lines() {
    assert_eq!(
        one_sided("a(1);\nb();\nc(1);\n", "a(2);\nc(2);\n"),
        ["a([2]);", "|c([2]);"]
    );
}

#[test]
fn m5_line_split() {
    assert_eq!(
        one_sided("foo(a, b)\n", "foo(a,\n\tb)\n"),
        ["foo(a,|", "[\tb)]"]
    );
}

#[test]
fn m6_lines_joined() {
    assert_eq!(one_sided("foo(a,\n\tb)\n", "foo(a, b)\n"), ["foo(a,[ b)]|"]);
}

#[test]
fn m7_lines_swapped() {
    assert_eq!(
        one_sided("a();\nb();\n", "b();\na();\n"),
        ["|b();", "[a();]"]
    );
}

#[test]
fn m8_block_rewritten_without_shared_words() {
    assert_eq!(
        one_sided(
            "alpha();\nbeta();\ngamma();\n",
            "one = 1;\ntwo = 2;\nthree = 3;\n"
        ),
        ["[one = 1;]", "[two = 2;]", "[three = 3;]"]
    );
}

#[test]
fn m9_nest_dedented_pairs_each_closer_with_its_own() {
    assert_eq!(
        one_sided("\t\tx();\n\t\t}\n\t}\n", "\tx();\n\t}\n}\n"),
        ["[\t]x();", "[\t]}", "|}"]
    );
}

#[test]
fn m10_blank_line_removed_after_a_change() {
    assert_eq!(one_sided("a(1);\n\n", "a(2);\n"), ["a([2]);|"]);
}

#[test]
fn m11_same_rename_on_every_line() {
    assert_eq!(
        one_sided(
            "user.name;\nuser.age;\nuser.id;\n",
            "account.name;\naccount.age;\naccount.id;\n"
        ),
        ["[account].name;", "[account].age;", "[account].id;"]
    );
}

#[test]
fn m12_crlf_and_emoji_keep_utf16_columns_and_breaks_outside() {
    assert_eq!(
        one_sided("😀 é old\r\nx;\r\n", "😀 é new\r\nx\r\nadded\r\n"),
        ["😀 é [new]", "x|", "[added]"]
    );
}

#[test]
fn m13_conflict_marks_each_side_as_its_own_case() {
    let base = "import { ref, computed } from 'vue';\nif (ok) {\n\ta(1);\n\tb(1);\n}\n";
    let local = "import { ref, computed } from 'vue';\na(1);\nb(1);\n";
    let remote =
        "import { ref, computed, watch } from 'vue';\nif (ok) {\n\ta(2);\n\tlog();\n\tb(2);\n}\n";
    let (local, remote) = conflict(base, local, remote);
    assert_eq!(
        local,
        ["import { ref, computed } from 'vue';", "|a(1);", "|b(1);|"]
    );
    assert_eq!(
        remote,
        [
            "import { ref, computed[, watch] } from 'vue';",
            "if (ok) {",
            "\ta([2]);",
            "[\tlog();]",
            "\tb([2]);",
            "}"
        ]
    );
}

fn language_tools_chunk_3() -> (Vec<String>, Vec<String>) {
    let base = include_str!("../../../tests/golden/language-tools-script-setup/base.ts");
    let local = include_str!("../../../tests/golden/language-tools-script-setup/local.ts");
    let remote = include_str!("../../../tests/golden/language-tools-script-setup/remote.ts");
    let chunks = compute_chunks(base, local, remote, &Options::default());
    let words = word_changes(base, local, remote, &chunks);
    let chunk = chunks[3];
    assert_eq!(chunk.kind, ChunkKind::Conflict);
    (
        marked_lines(
            local,
            chunk.local.start.0,
            chunk.local.len,
            &words[3].local,
            |line| line.0,
        ),
        marked_lines(
            remote,
            chunk.remote.start.0,
            chunk.remote.len,
            &words[3].remote,
            |line| line.0,
        ),
    )
}

#[test]
fn m14_local_dedent_marks_only_indentation_and_the_two_removed_lines() {
    assert_eq!(
        language_tools_chunk_3().0,
        [
            "|[\t]let emitted = false;",
            "[\t]for (const macro of Object.keys(options.vueCompilerOptions.macros)) {",
            "[\t\t]if (!options.setupBindings.has(macro)) {",
            "[\t\t\t]if (!emitted) {",
            "[\t\t\t\t]yield `// @ts-ignore${newLine}import { `;",
            "[\t\t\t\t]emitted = true;",
            "[\t\t\t]}",
            "[\t\t\t]yield `${macro}, `;",
            "[\t\t]}",
            "[\t]}",
            "[\t]if (emitted) {",
            "[\t\t]yield `} from '${options.vueCompilerOptions.lib}'${endOfLine}`;|",
        ]
    );
}

const M14_REMOTE: [&str; 34] = [
    "\tif (options.vueCompilerOptions.target >= 3.3) {",
    "[\t\tconst scriptSetup = options.scriptSetup;]",
    "[\t\tconst scriptSetupRanges = options.scriptSetupRanges;]",
    "[\t\tif (!scriptSetup || !scriptSetupRanges) {]",
    "[\t\t\treturn;]",
    "[\t\t]}",
    "",
    "[\t\tconst usedMacros: { canonical: string; alias: string }[] = [];]",
    "[\t\tconst add = (canonical: string, exp: TextRange | undefined) => {]",
    "[\t\t\tif (exp) {]",
    "[\t\t\t\tusedMacros.push({ canonical, alias: getRangeText(scriptSetup, exp) });]",
    "\t\t\t}",
    "[\t\t};]",
    "[\t\tadd('defineProps', scriptSetupRanges.defineProps?.exp);]",
    "[\t\tadd('defineEmits', scriptSetupRanges.defineEmits?.exp);]",
    "[\t\tadd('defineSlots', scriptSetupRanges.defineSlots?.exp);]",
    "[\t\tadd('defineExpose', scriptSetupRanges.defineExpose?.exp);]",
    "[\t\tadd('withDefaults', scriptSetupRanges.withDefaults?.exp);]",
    "[\t\tif (scriptSetupRanges.defineModel.length) {]",
    "[\t\t\tusedMacros.push({ canonical: 'defineModel', alias: 'defineModel' });]",
    "[\t\t}]",
    "[\t\tif (scriptSetupRanges.defineOptions) {]",
    "[\t\t\tusedMacros.push({ canonical: 'defineOptions', alias: 'defineOptions' });]",
    "[\t\t}]",
    "",
    "[\t\tconst toImport = usedMacros.filter(({ alias }) => !options.setupBindings.has(alias));]",
    "",
    "[\t\tif (toImport.length) {]",
    "[\t\t\tyield `import { `;]",
    "[\t\t\tfor (const { canonical, alias } of toImport) {]",
    "[\t\t\t\tyield alias === canonical ? `${canonical}, ` : `${canonical} as ${alias}, `;]",
    "[\t\t\t]}",
    "|\t\t\tyield `} from '${options.vueCompilerOptions.lib}'${endOfLine}`;",
    "\t\t}",
];

#[test]
fn m14_remote_rewrite_marks_new_lines_whole_and_leaves_base_lines_unmarked() {
    assert_eq!(language_tools_chunk_3().1, M14_REMOTE);
}
