import type { ProjectContext } from "../core/project-context.js";
import type { EngineResult, Finding } from "../core/result.js";
import { createFindingId } from "../core/result.js";
import { runCommand } from "./run-command.js";

const commandFinding = (message: string, severity: "error" | "warn" = "error"): Finding => ({
  actions: [
    {
      command: "ship-clean fix",
      confidence: "medium",
      description: "Run Ship Clean fix to apply safe formatter/linter fixes.",
      kind: "run-command",
      title: "Run safe fixes",
    },
  ],
  engine: "biome",
  file: null,
  id: createFindingId({ file: null, rule: "biome", source: "biome" }),
  message,
  rule: "biome",
  severity,
  source: "biome",
});

export const runBiomeCheck = async (context: ProjectContext): Promise<EngineResult> => {
  const started = performance.now();
  const result = runCommand("biome", ["check", "--no-errors-on-unmatched", "."], {
    cwd: context.cwd,
  });

  if (result.exitCode === 0) {
    return {
      durationMs: performance.now() - started,
      engine: "biome",
      findings: [],
      status: "pass",
    };
  }

  return {
    durationMs: performance.now() - started,
    engine: "biome",
    findings: [commandFinding((result.stdout || result.stderr).trim() || "Biome check failed.")],
    status: "fail",
  };
};

export const runBiomeFix = (cwd: string): number =>
  runCommand("biome", ["check", "--write", "--no-errors-on-unmatched", "."], { cwd }).exitCode;
