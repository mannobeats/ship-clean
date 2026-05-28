import chokidar from "chokidar";
import pc from "picocolors";

import { loadShipCleanConfig } from "../config/loader.js";
import { resolveCwd } from "../utils/paths.js";
import { syncIntelligenceIndex } from "./sync.js";

export interface WatchIntelligenceOptions {
  configPath?: string | undefined;
  cwd?: string | undefined;
  quiet?: boolean | undefined;
}

export interface WatchIntelligenceController {
  close(): Promise<void>;
  ready: Promise<void>;
}

interface DebouncedSync {
  flush(): Promise<void>;
  hasPending(): boolean;
  schedule(reason: string): void;
}

const createDebouncedSync = (
  sync: (reason: string) => Promise<void>,
  delayMs: number,
): DebouncedSync => {
  let timer: NodeJS.Timeout | null = null;
  let lastReason = "manual";

  const flush = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    await sync(lastReason);
  };

  return {
    flush,
    hasPending() {
      return timer !== null;
    },
    schedule(reason) {
      lastReason = reason;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        void sync(lastReason);
      }, delayMs);
    },
  };
};

export const watchIntelligenceIndex = async (
  options: WatchIntelligenceOptions,
): Promise<WatchIntelligenceController> => {
  const cwd = resolveCwd(options.cwd);
  const config = await loadShipCleanConfig({
    ...(options.configPath ? { configPath: options.configPath } : {}),
    cwd,
  });

  const runSync = async (reason: string): Promise<void> => {
    const result = await syncIntelligenceIndex({
      ...(options.configPath ? { configPath: options.configPath } : {}),
      cwd,
    });
    if (!options.quiet) {
      process.stdout.write(
        `  ${pc.green("synced")} ${result.index.stats.fileCount} files, ${result.index.stats.symbolCount} symbols in ${result.durationMs}ms ${pc.dim(`(${reason}, ${result.storage.backend})`)}\n`,
      );
    }
  };

  await runSync("initial");
  const debounced = createDebouncedSync(runSync, 350);
  const watcher = chokidar.watch(config.include, {
    cwd,
    ignored: [...config.exclude, ".ship-clean/**", "node_modules/**", ".git/**"],
    ignoreInitial: true,
  });

  watcher.on("add", (path) => debounced.schedule(`add ${path}`));
  watcher.on("change", (path) => debounced.schedule(`change ${path}`));
  watcher.on("unlink", (path) => debounced.schedule(`unlink ${path}`));

  const ready = new Promise<void>((resolve, reject) => {
    watcher.once("ready", resolve);
    watcher.once("error", reject);
  });

  return {
    async close() {
      if (debounced.hasPending()) {
        await debounced.flush();
      }
      await watcher.close();
    },
    ready,
  };
};
