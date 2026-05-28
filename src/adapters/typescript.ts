import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ProjectContext } from "../core/project-context.js";
import type { EngineResult, Finding } from "../core/result.js";
import { createFindingId } from "../core/result.js";
import { runCommand } from "./run-command.js";

const parseDiagnosticLine = (diagnosticLine: string): Finding | null => {
  const match =
    /^(?<file>.+?)\((?<line>\d+),(?<column>\d+)\):\s+error\s+(?<code>TS\d+):\s+(?<message>.+)$/u.exec(
      diagnosticLine,
    );
  if (!match?.groups) {
    return null;
  }
  const file = match.groups.file ?? null;
  const lineNumber = Number(match.groups.line ?? 0);
  const column = Number(match.groups.column ?? 0);
  const rule = match.groups.code ?? "typescript";

  return {
    actions: [
      {
        confidence: "medium",
        description: "Fix the TypeScript diagnostic and rerun Ship Clean.",
        kind: "manual",
        title: "Fix TypeScript error",
      },
    ],
    column,
    engine: "typescript",
    file,
    id: createFindingId({
      file,
      line: lineNumber,
      rule,
      source: "typescript",
    }),
    line: lineNumber,
    message: match.groups.message ?? diagnosticLine,
    rule,
    severity: "error",
    source: "typescript",
  };
};

export const runTypeScriptCheck = async (context: ProjectContext): Promise<EngineResult> => {
  const started = performance.now();
  if (!existsSync(join(context.cwd, "tsconfig.json"))) {
    return {
      durationMs: performance.now() - started,
      engine: "typescript",
      findings: [],
      status: "skipped",
    };
  }

  const result = runCommand("tsc", ["--noEmit", "--pretty", "false"], { cwd: context.cwd });
  const findings = result.stdout
    .split("\n")
    .map((line) => parseDiagnosticLine(line.trim()))
    .filter((finding): finding is Finding => Boolean(finding));

  if (result.exitCode !== 0 && findings.length === 0) {
    findings.push({
      actions: [
        {
          confidence: "medium",
          description: "Run tsc locally and fix the reported project errors.",
          kind: "manual",
          title: "Fix TypeScript errors",
        },
      ],
      engine: "typescript",
      file: null,
      id: createFindingId({ file: null, rule: "typescript", source: "typescript" }),
      message: (result.stdout || result.stderr).trim() || "TypeScript check failed.",
      rule: "typescript",
      severity: "error",
      source: "typescript",
    });
  }

  return {
    durationMs: performance.now() - started,
    engine: "typescript",
    findings,
    status: findings.length > 0 ? "fail" : "pass",
  };
};
