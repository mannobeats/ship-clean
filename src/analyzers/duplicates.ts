import { join } from "node:path";
import type { ProjectContext } from "../core/project-context.js";
import type { Finding, Severity } from "../core/result.js";
import { createFindingId } from "../core/result.js";
import { readTextFile } from "../utils/fs.js";
import { findByGlob } from "../utils/glob.js";

const severityFromSetting = (
  setting: "error" | "warn" | "off",
): Exclude<Severity, "info"> | null => (setting === "off" ? null : setting);

const normalizeLine = (line: string): string =>
  line
    .trim()
    .replace(/(["'`])(?:\\.|(?!\1).)*\1/gu, "<string>")
    .replace(/\b\d+(?:\.\d+)?\b/gu, "<number>")
    .replace(/\s+/gu, " ");

interface DuplicateLocation {
  file: string;
  line: number;
}

interface DuplicateGroup {
  duplicateOf: DuplicateLocation;
  endLine: number;
  file: string;
  line: number;
  matchedWindows: number;
}

const duplicateFinding = (input: {
  duplicateOf: string;
  lineCount: number;
  matchedWindows: number;
  file: string;
  line: number;
  severity: Exclude<Severity, "info">;
}): Finding => ({
  actions: [
    {
      confidence: "low",
      description: `Extract or consolidate this duplicated block with ${input.duplicateOf}.`,
      kind: "manual",
      title: "Consolidate duplicated code",
    },
  ],
  actual: `duplicate block also appears in ${input.duplicateOf} (${input.lineCount} lines, ${input.matchedWindows} overlapping windows)`,
  engine: "duplicates",
  expected: "unique implementation or shared abstraction",
  file: input.file,
  id: createFindingId({
    file: input.file,
    line: input.line,
    rule: "duplicates/no-duplicate-blocks",
    source: "ship-clean",
  }),
  line: input.line,
  message: "Duplicated code block detected.",
  rule: "duplicates/no-duplicate-blocks",
  severity: input.severity,
  source: "ship-clean",
});

const isLowSignalWindow = (window: string[]): boolean => {
  const meaningful = window.filter(Boolean);
  if (meaningful.length !== window.length) {
    return true;
  }

  const importOrExportLines = meaningful.filter((line) => /^(import|export)\b/u.test(line)).length;
  if (importOrExportLines / meaningful.length > 0.7) {
    return true;
  }

  return new Set(meaningful).size < Math.ceil(meaningful.length / 2);
};

const locationKey = (location: DuplicateLocation): string => `${location.file}:${location.line}`;

const groupKey = (first: DuplicateLocation, file: string): string => `${first.file}->${file}`;

export const runDuplicateDetection = async (context: ProjectContext): Promise<Finding[]> => {
  if (!context.config.duplicates.enabled) {
    return [];
  }

  const severity = severityFromSetting(context.config.duplicates.severity);
  if (!severity) {
    return [];
  }

  const files = await findByGlob(context.config.duplicates.files, {
    cwd: context.cwd,
    exclude: [...context.config.exclude, ...context.config.duplicates.exclude],
  });
  const seen = new Map<string, DuplicateLocation>();
  const groups = new Map<string, DuplicateGroup>();
  const latestGroupByPair = new Map<string, string>();

  for (const file of files) {
    const lines = (await readTextFile(join(context.cwd, file))).split("\n").map(normalizeLine);
    for (let index = 0; index <= lines.length - context.config.duplicates.minLines; index += 1) {
      const window = lines.slice(index, index + context.config.duplicates.minLines);
      if (isLowSignalWindow(window)) {
        continue;
      }
      const key = window.join("\n");
      const first = seen.get(key);
      if (first && first.file !== file) {
        const startLine = index + 1;
        const endLine = startLine + context.config.duplicates.minLines - 1;
        const pairKey = groupKey(first, file);
        const latestGroupKey = latestGroupByPair.get(pairKey);
        const existing = latestGroupKey ? groups.get(latestGroupKey) : undefined;
        if (existing && startLine <= existing.endLine + 1) {
          existing.endLine = Math.max(existing.endLine, endLine);
          existing.matchedWindows += 1;
          continue;
        }
        const newGroupKey = `${pairKey}:${startLine}`;
        groups.set(newGroupKey, {
          duplicateOf: first,
          endLine,
          file,
          line: startLine,
          matchedWindows: 1,
        });
        latestGroupByPair.set(pairKey, newGroupKey);
        continue;
      }
      seen.set(key, { file, line: index + 1 });
    }
  }

  return [...groups.values()].map((group) =>
    duplicateFinding({
      duplicateOf: locationKey(group.duplicateOf),
      file: group.file,
      line: group.line,
      lineCount: group.endLine - group.line + 1,
      matchedWindows: group.matchedWindows,
      severity,
    }),
  );
};
