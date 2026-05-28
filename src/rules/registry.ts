import type { ProjectContext } from "../core/project-context.js";
import type { Finding } from "../core/result.js";
import { evaluateNativeRule } from "./built-in/policy.js";

export const evaluateConfiguredRules = async (context: ProjectContext): Promise<Finding[]> => {
  const findings: Finding[] = [];

  for (const rule of context.config.rules) {
    findings.push(...(await evaluateNativeRule(rule, context)));
  }

  return findings;
};
