import type { InitSelection } from "../commands/init-config.js";
import type { ResolvedConfig } from "../rules/types.js";

type JsonObject = Record<string, unknown>;

const commonIgnores = [
  "**",
  "!!**/node_modules",
  "!!**/dist",
  "!!**/build",
  "!!**/.next",
  "!!**/coverage",
  "!!**/*.d.ts.map",
  "!!**/*.generated.*",
  "!!**/*.gen.*",
  "!!**/__generated__",
];

const mergeObjects = (...objects: JsonObject[]): JsonObject => {
  const merged: JsonObject = {};

  for (const object of objects) {
    for (const [key, value] of Object.entries(object)) {
      const existing = merged[key];
      if (
        existing &&
        typeof existing === "object" &&
        !Array.isArray(existing) &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        merged[key] = mergeObjects(existing as JsonObject, value as JsonObject);
        continue;
      }
      merged[key] = value;
    }
  }

  return merged;
};

const recommendedRules = {
  correctness: {
    noUndeclaredVariables: "error",
    noUnusedImports: {
      fix: "safe",
      level: "error",
    },
    noUnusedVariables: "error",
    useExhaustiveDependencies: "error",
    useHookAtTopLevel: "error",
    useJsxKeyInIterable: "error",
  },
  style: {
    noNonNullAssertion: "warn",
    useConst: "error",
  },
  suspicious: {
    noDebugger: "error",
    noDoubleEquals: "error",
  },
};

const strictRules = {
  complexity: {
    noExcessiveCognitiveComplexity: {
      level: "error",
      options: {
        maxAllowedComplexity: 20,
      },
    },
  },
  performance: {
    noBarrelFile: "error",
    noNamespaceImport: "error",
  },
  style: {
    noNonNullAssertion: "error",
    useBlockStatements: {
      fix: "safe",
      level: "error",
    },
  },
  suspicious: {
    noConsole: "warn",
    noExplicitAny: "error",
  },
};

const agentSafeRules = {
  correctness: {
    noUndeclaredDependencies: "error",
    noUnresolvedImports: "error",
  },
  suspicious: {
    noConsole: "error",
    noImportCycles: "error",
  },
};

const rulesForPreset = (preset: ResolvedConfig["lint"]["preset"]): JsonObject => {
  if (preset === "agent-safe") {
    return mergeObjects(recommendedRules, strictRules, agentSafeRules);
  }
  if (preset === "strict") {
    return mergeObjects(recommendedRules, strictRules);
  }
  return recommendedRules;
};

export const renderBiomeConfig = (config: Pick<ResolvedConfig, "lint"> | InitSelection): string => {
  const biomeConfig = {
    $schema: "https://biomejs.dev/schemas/2.4.16/schema.json",
    assist: {
      actions: {
        source: {
          organizeImports: config.lint.organizeImports ? "on" : "off",
        },
      },
    },
    files: {
      ignoreUnknown: true,
      includes: commonIgnores,
    },
    formatter: {
      attributePosition: "auto",
      bracketSpacing: true,
      enabled: config.lint.format,
      formatWithErrors: true,
      indentStyle: "space",
      indentWidth: 2,
      lineEnding: "lf",
      lineWidth: config.lint.preset === "agent-safe" ? 100 : 80,
    },
    linter: {
      enabled: config.lint.enabled,
      rules: rulesForPreset(config.lint.preset),
    },
  };

  return `${JSON.stringify(biomeConfig, null, 2)}\n`;
};
