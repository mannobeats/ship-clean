import type { ResolvedConfig } from "../rules/types.js";

export const defaultConfig: ResolvedConfig = {
  agent: {
    enabled: true,
    sync: false,
  },
  duplicates: {
    enabled: false,
    exclude: [],
    files: [
      "src/**/*.{ts,tsx,js,jsx}",
      "apps/*/src/**/*.{ts,tsx,js,jsx}",
      "packages/*/src/**/*.{ts,tsx,js,jsx}",
    ],
    minLines: 8,
    severity: "warn",
  },
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/coverage/**",
    "**/*.d.ts",
  ],
  graph: {
    cycles: "error",
    enabled: true,
    entrypoints: [],
    unusedExports: "warn",
    unusedFiles: "warn",
  },
  include: [
    "src/**/*.{ts,tsx,js,jsx}",
    "apps/*/src/**/*.{ts,tsx,js,jsx}",
    "packages/*/src/**/*.{ts,tsx,js,jsx}",
  ],
  lint: {
    biome: {},
    enabled: true,
    engine: "biome",
    format: true,
    organizeImports: true,
    preset: "recommended",
  },
  package: {
    allowedUnusedDependencies: [
      "@biomejs/biome",
      "@types/node",
      "biome",
      "eslint",
      "jest",
      "oxlint",
      "prettier",
      "ship-clean",
      "tsx",
      "tsup",
      "typescript",
      "vite",
      "vitest",
    ],
    enabled: true,
    forbidden: [],
    missingDependencies: "error",
    unusedDependencies: "warn",
  },
  presets: [],
  rules: [],
  typescript: {
    enabled: true,
    mode: "project",
  },
};
