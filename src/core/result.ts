export type EngineName =
  | "biome"
  | "oxlint"
  | "oxfmt"
  | "typescript"
  | "policy"
  | "graph"
  | "package"
  | "agent";

export type FindingSource =
  | "ship-clean"
  | "biome"
  | "oxlint"
  | "oxfmt"
  | "typescript"
  | "graph"
  | "package"
  | "agent";

export type Severity = "error" | "warn" | "info";
export type EngineStatus = "pass" | "fail" | "warn" | "skipped";
export type ActionConfidence = "high" | "medium" | "low";

export interface BaseFixAction {
  confidence: ActionConfidence;
  description: string;
  title: string;
}

export interface EditFixAction extends BaseFixAction {
  file: string;
  kind: "edit";
}

export interface CommandFixAction extends BaseFixAction {
  command: string;
  kind: "run-command";
}

export interface FileFixAction extends BaseFixAction {
  file: string;
  kind: "delete-file" | "rename-file" | "create-file";
}

export interface ManualFixAction extends BaseFixAction {
  kind: "manual";
}

export type FixAction = EditFixAction | CommandFixAction | FileFixAction | ManualFixAction;

export interface Finding {
  actions: FixAction[];
  actual?: string;
  column?: number;
  docsUrl?: string;
  engine: EngineName;
  expected?: string;
  file: string | null;
  id: string;
  line?: number;
  message: string;
  rule: string;
  severity: Severity;
  source: FindingSource;
}

export interface EngineResult {
  durationMs: number;
  engine: EngineName;
  findings: Finding[];
  status: EngineStatus;
}

export interface CheckSummary {
  errors: number;
  filesScanned: number;
  findings: number;
  fixed: number;
  warnings: number;
}

export interface CheckResult {
  cwd: string;
  durationMs: number;
  engines: EngineResult[];
  findings: Finding[];
  summary: CheckSummary;
  tool: "ship-clean";
  version: 1;
}

export const createFindingId = (parts: {
  file: string | null;
  line?: number;
  rule: string;
  source: FindingSource;
}): string => {
  const file = parts.file ?? "project";
  const line = parts.line ?? 0;
  return `${parts.source}:${parts.rule}:${file}:${line}`;
};

export const summarizeFindings = (filesScanned: number, findings: Finding[]): CheckSummary => {
  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.filter((finding) => finding.severity === "warn").length;

  return {
    errors,
    filesScanned,
    findings: findings.length,
    fixed: 0,
    warnings,
  };
};
