import { createHash } from "node:crypto";

import type { IntelligenceSymbol, IntelligenceSymbolKind } from "./types.js";

interface SymbolPattern {
  kind: IntelligenceSymbolKind;
  regex: RegExp;
}

const symbolPatterns: SymbolPattern[] = [
  {
    kind: "class",
    regex: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/u,
  },
  {
    kind: "interface",
    regex: /^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/u,
  },
  {
    kind: "type",
    regex: /^\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/u,
  },
  {
    kind: "function",
    regex: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/u,
  },
  {
    kind: "constant",
    regex: /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=/u,
  },
  {
    kind: "method",
    regex:
      /^\s*(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{]+)?\s*\{/u,
  },
];

const countIndent = (line: string): number => line.length - line.trimStart().length;

const findBlockEnd = (lines: string[], startIndex: number): number => {
  const startLine = lines[startIndex] ?? "";
  const startIndent = countIndent(startLine);
  let braceBalance = 0;
  let sawBrace = false;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const char of line) {
      if (char === "{") {
        braceBalance += 1;
        sawBrace = true;
      } else if (char === "}") {
        braceBalance -= 1;
      }
    }

    if (sawBrace && braceBalance <= 0) {
      return index + 1;
    }

    if (!sawBrace && index > startIndex) {
      const trimmed = line.trim();
      if (trimmed && countIndent(line) <= startIndent) {
        return index;
      }
    }
  }

  return Math.min(lines.length, startIndex + 1);
};

const symbolId = (file: string, name: string, line: number): string =>
  createHash("sha1").update(`${file}:${name}:${line}`).digest("hex").slice(0, 16);

export const extractSymbols = (file: string, content: string): IntelligenceSymbol[] => {
  const lines = content.split("\n");
  const symbols: IntelligenceSymbol[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const pattern of symbolPatterns) {
      const match = pattern.regex.exec(line);
      const name = match?.[1];
      if (!name || (pattern.kind === "method" && ["if", "for", "switch", "while"].includes(name))) {
        continue;
      }

      symbols.push({
        endLine: findBlockEnd(lines, index),
        exported: /\bexport\b/u.test(line),
        file,
        id: symbolId(file, name, index + 1),
        kind: pattern.kind,
        name,
        signature: line.trim(),
        startLine: index + 1,
      });
      break;
    }
  }

  return symbols;
};
