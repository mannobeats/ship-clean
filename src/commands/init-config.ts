import type {
  AgentConfig,
  DuplicateConfig,
  GraphConfig,
  LintConfig,
  PackageHealthConfig,
  TypeScriptConfig,
} from "../rules/types.js";

export interface InitSelection {
  agent: Required<AgentConfig>;
  duplicates: Required<Pick<DuplicateConfig, "enabled" | "minLines" | "severity">>;
  graph: Required<Pick<GraphConfig, "cycles" | "enabled" | "unusedExports" | "unusedFiles">> & {
    entrypoints: string[];
  };
  lint: Required<LintConfig>;
  package: Required<
    Pick<
      PackageHealthConfig,
      "allowedUnusedDependencies" | "enabled" | "missingDependencies" | "unusedDependencies"
    >
  > & {
    forbidden: string[];
  };
  presets: string[];
  projectType: "library" | "monorepo" | "node-api" | "react" | "next";
  strictness: "agent-safe" | "recommended" | "strict";
  typescript: Required<TypeScriptConfig>;
}

export const projectTypes = ["library", "monorepo", "node-api", "react", "next"] as const;

export const strictnessLevels = ["agent-safe", "recommended", "strict"] as const;

export const defaultInitSelection = (): InitSelection => ({
  agent: {
    enabled: true,
    sync: true,
  },
  duplicates: {
    enabled: true,
    minLines: 8,
    severity: "warn",
  },
  graph: {
    cycles: "error",
    enabled: true,
    entrypoints: [],
    unusedExports: "warn",
    unusedFiles: "warn",
  },
  lint: {
    biome: {},
    enabled: true,
    engine: "biome",
    format: true,
    organizeImports: true,
    preset: "strict",
  },
  package: {
    allowedUnusedDependencies: ["ship-clean"],
    enabled: true,
    forbidden: ["moment"],
    missingDependencies: "error",
    unusedDependencies: "warn",
  },
  presets: ["ship-clean/recommended"],
  projectType: "react",
  strictness: "strict",
  typescript: {
    enabled: true,
    mode: "project",
  },
});

const presetsForProjectType = (projectType: InitSelection["projectType"]): string[] => {
  const presets = ["ship-clean/recommended"];
  if (projectType === "react" || projectType === "next") {
    presets.push("ship-clean/react");
  }
  if (projectType === "monorepo") {
    presets.push("ship-clean/monorepo");
  }
  return presets;
};

export const selectionFromFlags = (input: {
  duplicates?: boolean | undefined;
  graph?: boolean | undefined;
  lint?: boolean | undefined;
  package?: boolean | undefined;
  projectType?: InitSelection["projectType"] | undefined;
  strictness?: InitSelection["strictness"] | undefined;
  typescript?: boolean | undefined;
}): InitSelection => {
  const selection = defaultInitSelection();
  const projectType = input.projectType ?? selection.projectType;
  const strictness = input.strictness ?? selection.strictness;

  selection.projectType = projectType;
  selection.strictness = strictness;
  selection.presets = presetsForProjectType(projectType);
  selection.lint.enabled = input.lint ?? selection.lint.enabled;
  selection.lint.preset = strictness;
  selection.graph.enabled = input.graph ?? selection.graph.enabled;
  selection.package.enabled = input.package ?? selection.package.enabled;
  selection.duplicates.enabled = input.duplicates ?? selection.duplicates.enabled;
  selection.typescript.enabled = input.typescript ?? selection.typescript.enabled;

  if (strictness === "agent-safe") {
    selection.graph.unusedExports = "error";
    selection.graph.unusedFiles = "error";
    selection.package.unusedDependencies = "error";
    selection.duplicates.severity = "error";
  }

  if (projectType === "next") {
    selection.graph.entrypoints = ["src/app/**/page.tsx", "src/pages/**/*.{ts,tsx}"];
  }

  if (projectType === "node-api") {
    selection.graph.entrypoints = ["src/server.ts", "src/index.ts", "src/main.ts"];
  }

  return selection;
};

const renderStringArray = (items: string[]): string =>
  `[${items.map((item) => JSON.stringify(item)).join(", ")}]`;

export const renderConfig = (selection: InitSelection): string => `export default {
  extends: ${renderStringArray(selection.presets)},
  lint: {
    enabled: ${selection.lint.enabled},
    engine: "${selection.lint.engine}",
    preset: "${selection.lint.preset}",
    format: ${selection.lint.format},
    organizeImports: ${selection.lint.organizeImports},
  },
  typescript: {
    enabled: ${selection.typescript.enabled},
    mode: "${selection.typescript.mode}",
  },
  graph: {
    enabled: ${selection.graph.enabled},
    entrypoints: ${renderStringArray(selection.graph.entrypoints)},
    cycles: "${selection.graph.cycles}",
    unusedFiles: "${selection.graph.unusedFiles}",
    unusedExports: "${selection.graph.unusedExports}",
  },
  package: {
    enabled: ${selection.package.enabled},
    missingDependencies: "${selection.package.missingDependencies}",
    unusedDependencies: "${selection.package.unusedDependencies}",
    allowedUnusedDependencies: ${renderStringArray(selection.package.allowedUnusedDependencies)},
    forbidden: ${renderStringArray(selection.package.forbidden)},
  },
  duplicates: {
    enabled: ${selection.duplicates.enabled},
    minLines: ${selection.duplicates.minLines},
    severity: "${selection.duplicates.severity}",
  },
  agent: {
    enabled: ${selection.agent.enabled},
    sync: ${selection.agent.sync},
  },
  rules: [
    {
      type: "file-pattern",
      name: "no-barrels",
      files: ["src/**/index.ts"],
      exclude: ["src/index.ts"],
      expect: "absent",
      severity: "warn",
      message: "Avoid barrel files; import directly from source modules.",
    },
  ],
} satisfies import("ship-clean").ShipCleanConfig;
`;
