import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";

const OPENING_CHARS = 4096;
const HTML = /^<(?:!doctype\s+html|html)(?![\w:.-])/i;
const TAG = /^<(?:!--|[A-Za-z])/;
const JSON_OBJECT = /^\{\s*["}]/;
const JSON_ARRAY = /^\[\s*(?:[{["\]\d-]|true|false|null)/;
const VERSION = /[\d.]+$/;

export function detectLanguage(left: string, right: string): string | null {
  return languageOf(left) ?? languageOf(right);
}

function languageOf(text: string): string | null {
  const start = text.search(/\S/);
  if (start === -1) {
    return null;
  }
  const opening = text.slice(start, start + OPENING_CHARS);
  if (opening.startsWith("#!")) {
    return interpreterLanguage(opening);
  }
  if (opening.startsWith("<?php")) {
    return "PHP";
  }
  if (opening.startsWith("<?xml")) {
    return "XML";
  }
  if (HTML.test(opening)) {
    return "HTML";
  }
  if (TAG.test(opening)) {
    return "XML";
  }
  if (JSON_OBJECT.test(opening) || JSON_ARRAY.test(opening)) {
    return "JSON";
  }
  return null;
}

function interpreterLanguage(opening: string): string | null {
  const firstLine = opening.slice("#!".length).split("\n", 1).join("");
  const [program = "", ...rest] = firstLine.trim().split(/\s+/);
  const command = program.slice(program.lastIndexOf("/") + 1);
  const interpreter =
    command === "env" ? (rest.find((word) => !word.startsWith("-")) ?? "") : command;
  const name = interpreter.replace(VERSION, "");
  return name === ""
    ? null
    : (LanguageDescription.matchLanguageName(languages, name, true)?.name ?? null);
}
