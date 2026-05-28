import { join } from "node:path";

import { readTextFile } from "../utils/fs.js";
import { impactForFile, searchIntelligence } from "./query.js";
import type { IntelligenceIndex, IntelligenceSymbol } from "./types.js";

const snippetForSymbol = async (
  cwd: string,
  symbol: IntelligenceSymbol,
  maxLines = 80,
): Promise<string> => {
  const content = await readTextFile(join(cwd, symbol.file));
  const lines = content.split("\n");
  const start = Math.max(1, symbol.startLine);
  const end = Math.min(symbol.endLine, start + maxLines - 1, lines.length);
  const selected: string[] = [];

  for (let line = start; line <= end; line += 1) {
    selected.push(`${line}\t${lines[line - 1] ?? ""}`);
  }

  return selected.join("\n");
};

export const buildAgentContext = async (
  cwd: string,
  index: IntelligenceIndex,
  query: string,
): Promise<string> => {
  const results = searchIntelligence(index, query, 8);
  const files = [...new Set(results.map((result) => result.symbol.file))];
  const lines = [
    "## Ship Clean Code Context",
    "",
    `Query: ${query}`,
    "",
    `Index: ${index.stats.fileCount} files, ${index.stats.symbolCount} symbols, ${index.stats.edgeCount} imports`,
    "",
  ];

  if (results.length === 0) {
    lines.push("No matching symbols found. Try a more specific symbol, file, or subsystem name.");
    return lines.join("\n");
  }

  lines.push("### Entry Points", "");
  for (const result of results.slice(0, 6)) {
    const symbol = result.symbol;
    lines.push(
      `- ${symbol.name} (${symbol.kind}) ${symbol.file}:${symbol.startLine} score=${result.score}`,
    );
    lines.push(`  ${symbol.signature}`);
  }

  lines.push("", "### Related Files", "");
  for (const file of files.slice(0, 6)) {
    const impact = impactForFile(index, file);
    lines.push(`- ${file}`);
    if (impact.dependencies.length > 0) {
      lines.push(`  imports: ${impact.dependencies.slice(0, 5).join(", ")}`);
    }
    if (impact.dependents.length > 0) {
      lines.push(`  imported by: ${impact.dependents.slice(0, 5).join(", ")}`);
    }
  }

  lines.push("", "### Source", "");
  for (const result of results.slice(0, 4)) {
    const symbol = result.symbol;
    lines.push(`#### ${symbol.name} (${symbol.file}:${symbol.startLine})`, "");
    lines.push("```ts");
    lines.push(await snippetForSymbol(cwd, symbol));
    lines.push("```", "");
  }

  lines.push(
    "> Source snippets are line-numbered. Treat shown snippets as already read; use targeted file reads only for details outside this context.",
  );

  return lines.join("\n");
};
