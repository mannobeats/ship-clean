import { performance } from "node:perf_hooks";

import { resolveCwd } from "../utils/paths.js";
import { type BuildIntelligenceIndexOptions, buildIntelligenceIndex } from "./indexer.js";
import { getIntelligenceStorageStatus, type IntelligenceStorageStatus } from "./store.js";
import type { IntelligenceIndex } from "./types.js";

export interface IntelligenceSyncResult {
  durationMs: number;
  index: IntelligenceIndex;
  storage: IntelligenceStorageStatus;
}

export const syncIntelligenceIndex = async (
  options: BuildIntelligenceIndexOptions,
): Promise<IntelligenceSyncResult> => {
  const startedAt = performance.now();
  const index = await buildIntelligenceIndex(options);
  const storage = await getIntelligenceStorageStatus(resolveCwd(options.cwd));

  return {
    durationMs: Math.round(performance.now() - startedAt),
    index,
    storage,
  };
};
