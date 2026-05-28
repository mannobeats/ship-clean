import type { EngineName, Severity } from "../core/result.js";

export interface RuleBase {
  message: string;
  name: string;
  severity?: Exclude<Severity, "info"> | "off";
}

export interface FileScopedRuleBase extends RuleBase {
  exclude?: string[];
  files: string[];
}

export interface ExportCheckRule extends FileScopedRuleBase {
  expect: "default" | "named" | "none";
  names?: string[];
  type: "export-check";
}

export interface ImportCheckRule extends FileScopedRuleBase {
  expect: "present" | "absent";
  pattern: string;
  specifiers?: string[];
  type: "import-check";
}

export interface NamingRule extends FileScopedRuleBase {
  pattern: string;
  target?: "basename" | "relative";
  type: "naming";
}

export interface GrepRule extends FileScopedRuleBase {
  expect: "present" | "absent";
  multiline?: boolean;
  pattern: string;
  type: "grep";
}

export interface FilePatternRule extends RuleBase {
  exclude?: string[];
  expect: "present" | "absent";
  files: string[];
  type: "file-pattern";
}

export interface PairedFileRule extends FileScopedRuleBase {
  require: string;
  type: "paired-file";
}

export interface StructureRule extends RuleBase {
  directories: string[];
  exclude?: string[];
  required: string[];
  type: "structure";
}

export interface BoundaryRule extends RuleBase {
  allowTypeOnly?: boolean;
  from: string[];
  to: string[];
  type: "boundary";
}

export interface MaxLinesRule extends FileScopedRuleBase {
  max: number;
  type: "max-lines";
}

export interface MaxDependenciesRule extends FileScopedRuleBase {
  max: number;
  type: "max-dependencies";
}

export interface PackageDependencyRule extends RuleBase {
  dependencyType?: "dependencies" | "devDependencies" | "peerDependencies";
  expect: "present" | "absent";
  package: string;
  type: "dependency";
}

export type ShipCleanRule =
  | ExportCheckRule
  | ImportCheckRule
  | NamingRule
  | GrepRule
  | FilePatternRule
  | PairedFileRule
  | StructureRule
  | BoundaryRule
  | MaxLinesRule
  | MaxDependenciesRule
  | PackageDependencyRule;

export interface EngineToggles {
  agent?: boolean;
  biome?: boolean;
  graph?: boolean;
  oxfmt?: boolean;
  oxlint?: boolean;
  package?: boolean;
  policy?: boolean;
  typescript?: boolean;
}

export interface ShipCleanConfig {
  engines?: EngineToggles;
  exclude?: string[];
  extends?: Array<PresetInput | string> | PresetInput | string;
  include?: string[];
  rules?: ShipCleanRule[];
}

export interface ResolvedConfig {
  engines: Required<EngineToggles>;
  exclude: string[];
  include: string[];
  presets: string[];
  rules: ShipCleanRule[];
}

export interface ShipCleanPreset {
  engines?: EngineToggles;
  exclude?: string[];
  include?: string[];
  name: string;
  rules?: ShipCleanRule[];
}

export type PresetInput = ShipCleanPreset | ShipCleanConfig;

export interface RuleEvaluationContext {
  cwd: string;
  files: string[];
}

export interface RuleModule {
  engine: EngineName;
  evaluate: (rule: ShipCleanRule, context: RuleEvaluationContext) => Promise<unknown>;
  type: ShipCleanRule["type"];
}
