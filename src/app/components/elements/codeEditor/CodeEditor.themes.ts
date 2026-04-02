import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

const nordTheme = EditorView.theme({
  "&": {
    color: "#2E3440",
    backgroundColor: "#ECEFF4",
    fontSize: "calc(var(--text-size) * 1px)",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  ".cm-content": { caretColor: "#4C566A" },
  ".cm-cursor": { borderLeftColor: "#4C566A" },
  ".cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "#D8DEE9",
  },
  ".cm-activeLine": { backgroundColor: "#E5E9F0" },
  ".cm-gutters": {
    backgroundColor: "#E5E9F0",
    color: "#9099AA",
    border: "none",
    borderRight: "1px solid #D8DEE9",
  },
  ".cm-activeLineGutter": { backgroundColor: "#D8DEE9", color: "#4C566A" },
  ".cm-foldPlaceholder": {
    backgroundColor: "#D8DEE9",
    border: "none",
    color: "#616E88",
  },
  ".cm-tooltip": {
    backgroundColor: "#E5E9F0",
    border: "1px solid #D8DEE9",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "#D8DEE9",
    color: "#2E3440",
  },
  ".cm-matchingBracket": {
    backgroundColor: "#D8DEE9",
    outline: "1px solid #81A1C1",
  },
}, { dark: false });

const nordHighlight = HighlightStyle.define([
  { tag: t.keyword,                color: "#81A1C1", fontWeight: "500" },
  { tag: [t.name, t.deleted, t.character, t.macroName], color: "#4C566A" },
  { tag: [t.propertyName, t.labelName], color: "#5E81AC" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#B48EAD" },
  { tag: [t.definition(t.name), t.separator], color: "#4C566A" },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: "#8FBCBB" },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: "#81A1C1" },
  { tag: [t.meta, t.comment], color: "#9099AA", fontStyle: "italic" },
  { tag: t.strong,                 fontWeight: "bold" },
  { tag: t.emphasis,               fontStyle: "italic" },
  { tag: t.strikethrough,          textDecoration: "line-through" },
  { tag: t.link,                   color: "#88C0D0", textDecoration: "underline" },
  { tag: t.heading,                fontWeight: "bold", color: "#5E81AC" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#B48EAD" },
  { tag: [t.processingInstruction, t.string, t.inserted], color: "#A3BE8C" },
  { tag: t.invalid,                color: "#BF616A" },
  { tag: t.function(t.variableName), color: "#88C0D0" },
  { tag: t.definition(t.function(t.variableName)), color: "#88C0D0" },
]);

export const nordExtension: Extension = [
  nordTheme,
  syntaxHighlighting(nordHighlight),
];

// ── Forest (dark) ─────────────────────────────────────────────
// base-100 #1a1a17  base-200 #171714  base-300 #141411
// base-content #d4d4d0  primary #4ade80  secondary #34d399
// accent #2dd4bf

const forestTheme = EditorView.theme({
  "&": {
    color: "#d4d4d0",
    backgroundColor: "#1a1a17",
    fontSize: "calc(var(--text-size) / 16 * 1rem)",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  ".cm-content": { caretColor: "#d4d4d0" },
  ".cm-cursor": { borderLeftColor: "#d4d4d0" },
  ".cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "#2a2e24",
  },
  ".cm-gutters": {
    backgroundColor: "#171714",
    color: "#4a5040",
    border: "none",
    borderRight: "1px solid #222220",
  },
  ".cm-activeLineGutter": { backgroundColor: "#1e2019", color: "#6b7060" },
  ".cm-foldPlaceholder": {
    backgroundColor: "#2a2e24",
    border: "none",
    color: "#6b7060",
  },
  ".cm-tooltip": {
    backgroundColor: "#171714",
    border: "1px solid #2a2e24",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "#2a2e24",
    color: "#d4d4d0",
  },
  ".cm-matchingBracket": {
    backgroundColor: "#2a3828",
    outline: "1px solid #34d399",
  },
}, { dark: true });

const forestHighlight = HighlightStyle.define([
  { tag: t.keyword,                color: "#4ade80", fontWeight: "500" },
  { tag: [t.name, t.deleted, t.character, t.macroName], color: "#d4d4d0" },
  { tag: [t.propertyName, t.labelName], color: "#86efac" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#2dd4bf" },
  { tag: [t.definition(t.name), t.separator], color: "#d4d4d0" },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: "#6ee7b7" },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: "#34d399" },
  { tag: [t.meta, t.comment], color: "#4a5a48", fontStyle: "italic" },
  { tag: t.strong,                 fontWeight: "bold" },
  { tag: t.emphasis,               fontStyle: "italic" },
  { tag: t.strikethrough,          textDecoration: "line-through" },
  { tag: t.link,                   color: "#2dd4bf", textDecoration: "underline" },
  { tag: t.heading,                fontWeight: "bold", color: "#4ade80" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#2dd4bf" },
  { tag: [t.processingInstruction, t.string, t.inserted], color: "#34d399" },
  { tag: t.invalid,                color: "#f87171" },
  { tag: t.function(t.variableName), color: "#86efac" },
  { tag: t.definition(t.function(t.variableName)), color: "#86efac" },
]);

export const forestExtension: Extension = [
  forestTheme,
  syntaxHighlighting(forestHighlight),
];