import pc from "picocolors";

import { buildAgentContext } from "../intelligence/context.js";
import { buildIntelligenceIndex } from "../intelligence/indexer.js";
import { affectedFiles, impactForFile, searchIntelligence } from "../intelligence/query.js";
import { getIntelligenceStorageStatus, readIntelligenceIndex } from "../intelligence/store.js";
import { syncIntelligenceIndex } from "../intelligence/sync.js";
import { watchIntelligenceIndex } from "../intelligence/watcher.js";
import { startStudioServer } from "../studio/server.js";
import { resolveCwd } from "../utils/paths.js";

export interface IntelligenceCommandOptions {
  configPath?: string | undefined;
  cwd?: string | undefined;
  json?: boolean;
  port?: number | undefined;
}

const loadOrBuildIndex = async (options: IntelligenceCommandOptions) => {
  const cwd = resolveCwd(options.cwd);
  return (await readIntelligenceIndex(cwd)) ?? buildIntelligenceIndex(options);
};

export const runIndexCommand = async (options: IntelligenceCommandOptions): Promise<number> => {
  const index = await buildIntelligenceIndex(options);
  const storage = await getIntelligenceStorageStatus(resolveCwd(options.cwd));
  process.stdout.write(
    [
      "",
      `  ${pc.bold("ship-clean intelligence index")}`,
      "",
      `  Indexed ${pc.bold(String(index.stats.fileCount))} files, ${pc.bold(String(index.stats.symbolCount))} symbols, ${pc.bold(String(index.stats.edgeCount))} imports`,
      `  ${pc.dim(storage.backend === "sqlite" ? ".ship-clean/intelligence.sqlite" : ".ship-clean/intelligence.json")}`,
      "",
    ].join("\n"),
  );
  return 0;
};

export const runSyncCommand = async (options: IntelligenceCommandOptions): Promise<number> => {
  const result = await syncIntelligenceIndex(options);
  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          durationMs: result.durationMs,
          stats: result.index.stats,
          storage: result.storage,
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  }

  process.stdout.write(
    [
      "",
      `  ${pc.bold("ship-clean sync")}`,
      "",
      `  Synced ${pc.bold(String(result.index.stats.fileCount))} files, ${pc.bold(String(result.index.stats.symbolCount))} symbols, ${pc.bold(String(result.index.stats.edgeCount))} imports in ${pc.bold(`${result.durationMs}ms`)}`,
      `  storage: ${result.storage.backend}${result.storage.sqliteAvailable ? "" : pc.dim(" (SQLite native binding unavailable, using JSON fallback)")}`,
      "",
    ].join("\n"),
  );
  return 0;
};

export const runWatchCommand = async (options: IntelligenceCommandOptions): Promise<number> => {
  process.stdout.write(`\n  ${pc.bold("ship-clean watch")} ${pc.dim("press Ctrl-C to stop")}\n\n`);
  const controller = await watchIntelligenceIndex(options);
  await controller.ready;

  await new Promise<void>((resolve) => {
    const stop = (): void => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });

  await controller.close();
  return 0;
};

export const runStudioCommand = async (options: IntelligenceCommandOptions): Promise<number> => {
  const server = await startStudioServer(options);
  await new Promise<void>((resolve) => {
    const stop = (): void => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  await server.close();
  return 0;
};

export const runSearchCommand = async (
  query: string,
  options: IntelligenceCommandOptions,
): Promise<number> => {
  if (!query) {
    throw new Error("Search query is required.");
  }

  const index = await loadOrBuildIndex(options);
  const results = searchIntelligence(index, query, 12);
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ query, results }, null, 2)}\n`);
    return 0;
  }

  process.stdout.write(`\n  ${pc.bold("ship-clean search")} ${pc.dim(query)}\n\n`);
  for (const result of results) {
    const symbol = result.symbol;
    process.stdout.write(
      `  ${pc.cyan(symbol.kind.padEnd(9))} ${pc.bold(symbol.name)} ${pc.dim(`${symbol.file}:${symbol.startLine}`)} ${pc.dim(`score=${result.score}`)}\n`,
    );
    process.stdout.write(`            ${symbol.signature}\n`);
  }
  process.stdout.write(results.length === 0 ? "  No symbols found.\n\n" : "\n");
  return results.length === 0 ? 1 : 0;
};

export const runContextCommand = async (
  query: string,
  options: IntelligenceCommandOptions,
): Promise<number> => {
  if (!query) {
    throw new Error("Context query is required.");
  }

  const cwd = resolveCwd(options.cwd);
  const index = await loadOrBuildIndex(options);
  const context = await buildAgentContext(cwd, index, query);
  process.stdout.write(`${context}\n`);
  return 0;
};

export const runImpactCommand = async (
  filePath: string,
  options: IntelligenceCommandOptions,
): Promise<number> => {
  if (!filePath) {
    throw new Error("Impact file path is required.");
  }

  const index = await loadOrBuildIndex(options);
  const result = impactForFile(index, filePath);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }

  process.stdout.write(`\n  ${pc.bold("ship-clean impact")} ${pc.dim(filePath)}\n\n`);
  process.stdout.write(
    `  symbols: ${result.symbols.map((symbol) => symbol.name).join(", ") || "none"}\n`,
  );
  process.stdout.write(`  imports: ${result.dependencies.join(", ") || "none"}\n`);
  process.stdout.write(`  imported by: ${result.dependents.join(", ") || "none"}\n\n`);
  return 0;
};

export const runAffectedCommand = async (
  filePaths: string[],
  options: IntelligenceCommandOptions,
): Promise<number> => {
  if (filePaths.length === 0) {
    throw new Error("At least one changed file is required.");
  }

  const index = await loadOrBuildIndex(options);
  const affected = affectedFiles(index, filePaths);
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ affected, files: filePaths }, null, 2)}\n`);
    return 0;
  }

  process.stdout.write(`\n  ${pc.bold("ship-clean affected")}\n\n`);
  for (const file of affected) {
    process.stdout.write(`  ${file}\n`);
  }
  process.stdout.write("\n");
  return 0;
};
