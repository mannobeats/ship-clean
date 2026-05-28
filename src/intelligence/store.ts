import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { IntelligenceIndex } from "./types.js";

export const intelligenceIndexPath = (cwd: string): string =>
  join(cwd, ".ship-clean", "intelligence.json");

export const writeIntelligenceIndex = async (
  cwd: string,
  index: IntelligenceIndex,
): Promise<void> => {
  const path = intelligenceIndexPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(index, null, 2)}\n`);
};

export const readIntelligenceIndex = async (cwd: string): Promise<IntelligenceIndex | null> => {
  try {
    return JSON.parse(await readFile(intelligenceIndexPath(cwd), "utf8")) as IntelligenceIndex;
  } catch {
    return null;
  }
};
