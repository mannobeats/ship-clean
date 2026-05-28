import type { ProjectContext } from "../core/project-context.js";
import type { EngineResult, Finding } from "../core/result.js";
import { createFindingId } from "../core/result.js";
import { runCommand } from "./run-command.js";

export const runOxlintCheck = async (context: ProjectContext): Promise<EngineResult> => {
  const started = performance.now();
  const result = runCommand("oxlint", [".", "--format", "json"], { cwd: context.cwd });

  if (result.exitCode === 0) {
    return {
      durationMs: performance.now() - started,
      engine: "oxlint",
      findings: [],
      status: "pass",
    };
  }

  const finding: Finding = {
    actions: [
      {
        command: "ship-clean fix",
        confidence: "medium",
        description: "Run Ship Clean fix or inspect Oxlint output.",
        kind: "run-command",
        title: "Run safe fixes",
      },
    ],
    engine: "oxlint",
    file: null,
    id: createFindingId({ file: null, rule: "oxlint", source: "oxlint" }),
    message: (result.stdout || result.stderr).trim() || "Oxlint check failed.",
    rule: "oxlint",
    severity: "error",
    source: "oxlint",
  };

  return {
    durationMs: performance.now() - started,
    engine: "oxlint",
    findings: [finding],
    status: "fail",
  };
};

export const runOxlintFix = (cwd: string, unsafe = false): number =>
  runCommand("oxlint", [unsafe ? "--fix-dangerously" : "--fix", "."], { cwd }).exitCode;
