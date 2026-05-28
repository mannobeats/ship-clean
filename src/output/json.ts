import type { CheckResult } from "../core/result.js";

export const formatJson = (result: CheckResult): string => `${JSON.stringify(result, null, 2)}\n`;
