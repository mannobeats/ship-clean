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

const duplicateFinding = (input: {
  duplicateOf: string;
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
  actual: `duplicate block also appears in ${input.duplicateOf}`,
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
  const seen = new Map<string, { file: string; line: number }>();
  const findings: Finding[] = [];

  for (const file of files) {
    const lines = (await readTextFile(join(context.cwd, file))).split("\n").map(normalizeLine);
    for (let index = 0; index <= lines.length - context.config.duplicates.minLines; index += 1) {
      const window = lines.slice(index, index + context.config.duplicates.minLines);
      if (window.filter(Boolean).length < context.config.duplicates.minLines) {
        continue;
      }
      const key = window.join("\n");
      const first = seen.get(key);
      if (first && first.file !== file) {
        findings.push(
          duplicateFinding({
            duplicateOf: `${first.file}:${first.line}`,
            file,
            line: index + 1,
            severity,
          }),
        );
        continue;
      }
      seen.set(key, { file, line: index + 1 });
    }
  }

  return findings;
};
