import tsParser from "@typescript-eslint/parser";
import pluginVue from "eslint-plugin-vue";

// Layout rules fight oxfmt, which owns .vue formatting; keeping both makes `fmt` and `lint` disagree.
const layoutRulesOff = Object.fromEntries(
  Object.entries(pluginVue.rules)
    .filter(([, rule]) => rule.meta?.type === "layout")
    .map(([name]) => [`vue/${name}`, "off"]),
);

export default [
  ...pluginVue.configs["flat/recommended"].map((config) => ({ ...config, files: ["**/*.vue"] })),
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: { parser: tsParser },
    },
    rules: {
      ...layoutRulesOff,
      "vue/block-order": ["error", { order: ["script", "template", "style"] }],
      "vue/define-macros-order": [
        "error",
        { order: ["defineProps", "defineEmits", "defineModel"] },
      ],
      "vue/define-props-declaration": ["error", "type-based"],
      "vue/define-emits-declaration": ["error", "type-based"],
      "vue/require-typed-ref": "error",
    },
  },
];
