import type { CheckResult } from "../core/result.js";
import { formatJson } from "./json.js";
import { formatTerminal } from "./terminal.js";

export type OutputFormat = "json" | "terminal";

export const formatResult = (result: CheckResult, format: OutputFormat): string => {
  if (format === "json") {
    return formatJson(result);
  }
  return formatTerminal(result);
};
