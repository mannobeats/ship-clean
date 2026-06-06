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

export type SeveritySetting = Exclude<Severity, "info"> | "off";

export type JsonConfigObject = Record<string, unknown>;

export interface LintConfig {
  biome?: JsonConfigObject;
  enabled?: boolean;
  engine?: "biome" | "oxlint";
  format?: boolean;
  organizeImports?: boolean;
  preset?: "recommended" | "strict" | "agent-safe";
}

export interface TypeScriptConfig {
  enabled?: boolean;
  mode?: "project" | "off";
}

export interface GraphConfig {
  cycles?: SeveritySetting;
  enabled?: boolean;
  entrypoints?: string[];
  unusedExports?: SeveritySetting;
  unusedFiles?: SeveritySetting;
}

export interface DuplicateConfig {
  enabled?: boolean;
  exclude?: string[];
  files?: string[];
  minLines?: number;
  severity?: SeveritySetting;
}

export interface PackageHealthConfig {
  allowedUnusedDependencies?: string[];
  enabled?: boolean;
  forbidden?: string[];
  missingDependencies?: SeveritySetting;
  unusedDependencies?: SeveritySetting;
}

export interface AgentConfig {
  enabled?: boolean;
  sync?: boolean;
}

export interface ShipCleanConfig {
  agent?: AgentConfig;
  duplicates?: DuplicateConfig;
  exclude?: string[];
  extends?: Array<PresetInput | string> | PresetInput | string;
  graph?: GraphConfig;
  include?: string[];
  lint?: LintConfig;
  package?: PackageHealthConfig;
  rules?: ShipCleanRule[];
  typescript?: TypeScriptConfig;
}

export interface ResolvedConfig {
  agent: Required<AgentConfig>;
  duplicates: Required<DuplicateConfig>;
  exclude: string[];
  graph: Required<GraphConfig>;
  include: string[];
  lint: Required<LintConfig>;
  package: Required<PackageHealthConfig>;
  presets: string[];
  rules: ShipCleanRule[];
  typescript: Required<TypeScriptConfig>;
}

export interface ShipCleanPreset {
  agent?: AgentConfig;
  duplicates?: DuplicateConfig;
  exclude?: string[];
  graph?: GraphConfig;
  include?: string[];
  lint?: LintConfig;
  name: string;
  package?: PackageHealthConfig;
  rules?: ShipCleanRule[];
  typescript?: TypeScriptConfig;
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
