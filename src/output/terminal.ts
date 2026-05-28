import pc from "picocolors";

import type { CheckResult, Finding } from "../core/result.js";

const plural = (count: number, singular: string, pluralValue = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : pluralValue}`;

const formatFinding = (finding: Finding): string => {
  const location = finding.file
    ? `${finding.file}${finding.line ? `:${finding.line}` : ""}${finding.column ? `:${finding.column}` : ""}`
    : "project";
  const color =
    finding.severity === "error" ? pc.red : finding.severity === "warn" ? pc.yellow : pc.cyan;
  const action = finding.actions[0];

  return [
    `  ${color(finding.severity.padEnd(5))} ${pc.bold(location)}`,
    `        ${finding.message}`,
    finding.expected ? `        ${pc.dim(`expected: ${finding.expected}`)}` : "",
    finding.actual ? `        ${pc.dim(`actual: ${finding.actual}`)}` : "",
    action ? `        ${pc.dim(`fix: ${action.title} - ${action.description}`)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

export const formatTerminal = (result: CheckResult): string => {
  const lines = [
    "",
    `  ${pc.bold("ship-clean")} ${pc.dim("v0.1.0")}`,
    "",
    `  Checked ${pc.bold(plural(result.summary.filesScanned, "file"))} with ${pc.bold(plural(result.engines.length, "engine"))} in ${pc.bold(`${Math.round(result.durationMs)}ms`)}`,
    "",
  ];

  for (const engine of result.engines) {
    const icon =
      engine.status === "pass"
        ? pc.green("✓")
        : engine.status === "skipped"
          ? pc.dim("-")
          : pc.red("✗");
    lines.push(
      `  ${icon} ${engine.engine.padEnd(12)} ${plural(engine.findings.length, "finding")} ${pc.dim(`${Math.round(engine.durationMs)}ms`)}`,
    );
  }

  if (result.findings.length > 0) {
    lines.push("");
    const grouped = new Map<string, Finding[]>();
    for (const finding of result.findings) {
      grouped.set(finding.rule, [...(grouped.get(finding.rule) ?? []), finding]);
    }
    for (const [rule, findings] of grouped.entries()) {
      lines.push(
        `  ${pc.dim("──")} ${pc.bold(rule)} ${pc.dim("─".repeat(Math.max(1, 50 - rule.length)))}`,
      );
      lines.push("");
      for (const finding of findings) {
        lines.push(formatFinding(finding));
        lines.push("");
      }
    }
  }

  const summaryColor =
    result.summary.errors > 0 ? pc.red : result.summary.warnings > 0 ? pc.yellow : pc.green;
  lines.push(
    `  ${summaryColor(plural(result.summary.errors, "error"))} · ${pc.yellow(plural(result.summary.warnings, "warning", "warnings"))} · ${plural(result.summary.findings, "finding")}`,
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
};
