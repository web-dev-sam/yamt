mod marks;

use marks::one_sided;

fn one_line(base: &str, side: &str) -> String {
    let mut lines = one_sided(&format!("{base}\n"), &format!("{side}\n"));
    assert_eq!(lines.len(), 1, "{lines:?}");
    lines.remove(0)
}

#[test]
fn c1_renamed_property() {
    assert_eq!(
        one_line("if (obj.a) {", "if (obj.renamed) {"),
        "if (obj.[renamed]) {"
    );
}

#[test]
fn c2_condition_grows() {
    assert_eq!(
        one_line("if(obj.a)", "if (obj.renamed && obj.new)"),
        "if[ ](obj.[renamed && obj.new])"
    );
}

#[test]
fn c3_argument_added() {
    assert_eq!(one_line("foo(a, b)", "foo(a, b, c)"), "foo(a, b[, c])");
}

#[test]
fn c4_argument_removed() {
    assert_eq!(one_line("foo(a, b, c)", "foo(a, c)"), "foo(a, ⟨b, ⟩c)");
}

#[test]
fn c5_string_grows() {
    assert_eq!(
        one_line("const label = 'Save';", "const label = 'Save changes';"),
        "const label = 'Save[ changes]';"
    );
}

#[test]
fn c6_number_changed() {
    assert_eq!(
        one_line("timeout: 300,", "timeout: 3000,"),
        "timeout: [3000],"
    );
}

#[test]
fn c7_optional_chaining() {
    assert_eq!(
        one_line("return user.profile.name;", "return user.profile?.name;"),
        "return user.profile[?].name;"
    );
}

#[test]
fn c8_await_added() {
    assert_eq!(
        one_line(
            "const data = fetchUser(id);",
            "const data = await fetchUser(id);"
        ),
        "const data = [await ]fetchUser(id);"
    );
}

#[test]
fn c9_types_added() {
    assert_eq!(
        one_line(
            "function load(id) {",
            "function load(id: string): Promise<User> {"
        ),
        "function load(id[: string])[: Promise<User>] {"
    );
}

#[test]
fn c10_value_wrapped() {
    assert_eq!(
        one_line("return value;", "return ref(value);"),
        "return [ref(]value[)];"
    );
}

#[test]
fn c11_condition_negated() {
    assert_eq!(
        one_line("if (isReady) {", "if (!isReady) {"),
        "if ([!]isReady) {"
    );
}

#[test]
fn c12_operator_changed() {
    assert_eq!(
        one_line("if (a === b) {", "if (a !== b) {"),
        "if (a [!]== b) {"
    );
}

#[test]
fn c13_variable_renamed() {
    assert_eq!(
        one_line("const count = list.length;", "const size = list.length;"),
        "const [size] = list.length;"
    );
}

#[test]
fn c14_import_added() {
    assert_eq!(
        one_line(
            "import { ref, computed } from 'vue';",
            "import { ref, computed, watch } from 'vue';"
        ),
        "import { ref, computed[, watch] } from 'vue';"
    );
}

#[test]
fn c15_import_removed() {
    assert_eq!(
        one_line(
            "import { ref, computed, watch } from 'vue';",
            "import { ref, watch } from 'vue';"
        ),
        "import { ref, ⟨computed, ⟩watch } from 'vue';"
    );
}

#[test]
fn c16_attribute_added() {
    assert_eq!(
        one_line(
            "<button @click=\"save\">",
            "<button :disabled=\"busy\" @click=\"save\">"
        ),
        "<button [:disabled=\"busy\" ]@click=\"save\">"
    );
}

#[test]
fn c17_jsx_expression_changed() {
    assert_eq!(
        one_line(
            "<Item key={id} label={name} />",
            "<Item key={item.id} label={name} />"
        ),
        "<Item key={[item.]id} label={name} />"
    );
}

#[test]
fn c18_php_method_renamed() {
    assert_eq!(
        one_line("$name = $user->getName();", "$name = $user->getFullName();"),
        "$name = $user->[getFullName]();"
    );
}

#[test]
fn c19_php_parameter_added() {
    assert_eq!(
        one_line(
            "public function save(array $data)",
            "public function save(array $data, bool $force = false)"
        ),
        "public function save(array $data[, bool $force = false])"
    );
}

#[test]
fn c20_trailing_comma_added() {
    assert_eq!(one_line("  b: 2", "  b: 2,"), "  b: 2[,]");
}

#[test]
fn c21_semicolon_removed() {
    assert_eq!(one_line("return x;", "return x"), "return x⟨;⟩");
}

#[test]
fn c22_comment_grows() {
    assert_eq!(
        one_line("// TODO: fix this", "// TODO: fix this before release"),
        "// TODO: fix this[ before release]"
    );
}

#[test]
fn c23_dedented() {
    assert_eq!(one_line("\t\tlet x = 1;", "\tlet x = 1;"), "[\t]let x = 1;");
}

#[test]
fn c24_indented() {
    assert_eq!(
        one_line("\tlet x = 1;", "\t\tlet x = 1;"),
        "[\t\t]let x = 1;"
    );
}

#[test]
fn c25_spaces_to_tab() {
    assert_eq!(one_line("    foo();", "\tfoo();"), "[\t]foo();");
}

#[test]
fn c26_dedented_and_changed() {
    assert_eq!(
        one_line("\t\tlet x = 1;", "\tlet x = 2;"),
        "[\t]let x = [2];"
    );
}

#[test]
fn c27_indentation_removed() {
    assert_eq!(one_line("\tfoo();", "foo();"), "⟨\t⟩foo();");
}

#[test]
fn c28_inner_spaces_removed() {
    assert_eq!(one_line("foo( a )", "foo(a)"), "foo(⟨ ⟩a⟨ ⟩)");
}

#[test]
fn c29_single_word_replaced() {
    assert_eq!(one_line("return a;", "return b;"), "return [b];");
}

#[test]
fn c30_symbol_added_to_a_wordless_line() {
    assert_eq!(one_line("}", "};"), "}[;]");
}

#[test]
fn c31_else_added_after_a_closing_brace() {
    assert_eq!(one_line("}", "} else {"), "}[ else {]");
}

#[test]
fn c32_options_added_before_a_closing_call() {
    assert_eq!(one_line("});", "}, { passive });"), "}[, { passive }]);");
}

#[test]
fn n1_unrelated_statement_is_new() {
    assert_eq!(
        one_line(
            "let emitted = false;",
            "const scriptSetup = options.scriptSetup;"
        ),
        "[const scriptSetup = options.scriptSetup;]"
    );
}

#[test]
fn n2_condition_sharing_only_if_is_new() {
    assert_eq!(
        one_line(
            "if (!options.setupBindings.has(macro)) {",
            "if (scriptSetupRanges.defineModel.length) {"
        ),
        "[if (scriptSetupRanges.defineModel.length) {]"
    );
}

#[test]
fn n3_unrelated_call_is_new() {
    assert_eq!(
        one_line(
            "yield `${macro}, `;",
            "usedMacros.push({ canonical, alias });"
        ),
        "[usedMacros.push({ canonical, alias });]"
    );
}

#[test]
fn n4_call_sharing_only_closing_symbols_is_new() {
    assert_eq!(one_line("});", "foo(a, b);"), "[foo(a, b);]");
}

#[test]
fn n5_short_call_sharing_only_closing_symbols_is_new() {
    assert_eq!(one_line("});", "bar();"), "[bar();]");
}

#[test]
fn n6_entry_sharing_only_a_comma_is_new() {
    assert_eq!(one_line("},", "foo,"), "[foo,]");
}
