export { defineConfig, definePreset } from "./config/define-config.js";
export type {
  CheckResult,
  EngineName,
  EngineResult,
  Finding,
  FindingSource,
  FixAction,
  Severity,
} from "./core/result.js";
export { checkProject } from "./core/runner.js";
export type {
  BoundaryRule,
  ExportCheckRule,
  GrepRule,
  ImportCheckRule,
  NamingRule,
  ResolvedConfig,
  ShipCleanConfig,
  ShipCleanPreset,
  ShipCleanRule,
} from "./rules/types.js";
