import { join } from "node:path";

import { buildImportGraph } from "../analyzers/graph.js";
import { scanModule } from "../analyzers/imports.js";
import { loadShipCleanConfig } from "../config/loader.js";
import { createProjectContext } from "../core/project-context.js";
import { readTextFile } from "../utils/fs.js";
import { resolveCwd } from "../utils/paths.js";
import { writeIntelligenceIndex } from "./store.js";
import { extractSymbols } from "./symbols.js";
import type { IntelligenceFile, IntelligenceIndex } from "./types.js";

export interface BuildIntelligenceIndexOptions {
  configPath?: string | undefined;
  cwd?: string | undefined;
}

export const buildIntelligenceIndex = async (
  options: BuildIntelligenceIndexOptions,
): Promise<IntelligenceIndex> => {
  const cwd = resolveCwd(options.cwd);
  const config = await loadShipCleanConfig({
    ...(options.configPath ? { configPath: options.configPath } : {}),
    cwd,
  });
  const context = await createProjectContext(cwd, config);
  const edges = await buildImportGraph(context.cwd, context.files);
  const files: IntelligenceFile[] = [];

  for (const file of context.files) {
    const content = await readTextFile(join(context.cwd, file));
    const scan = await scanModule(context.cwd, file);
    files.push({
      imports: scan.imports.map((item) => ({
        line: item.line,
        source: item.source,
        target:
          edges.find(
            (edge) => edge.from === file && edge.source === item.source && edge.line === item.line,
          )?.to ?? null,
      })),
      lineCount: content.split("\n").length,
      path: file,
      symbols: extractSymbols(file, content),
    });
  }

  const index: IntelligenceIndex = {
    createdAt: new Date().toISOString(),
    files,
    schemaVersion: 1,
    stats: {
      edgeCount: files.reduce((count, file) => count + file.imports.length, 0),
      fileCount: files.length,
      symbolCount: files.reduce((count, file) => count + file.symbols.length, 0),
    },
  };

  await writeIntelligenceIndex(cwd, index);
  return index;
};
