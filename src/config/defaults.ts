import type { ResolvedConfig } from "../rules/types.js";

export const defaultConfig: ResolvedConfig = {
  engines: {
    agent: true,
    biome: false,
    graph: true,
    oxfmt: false,
    oxlint: false,
    package: true,
    policy: true,
    typescript: true,
  },
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/coverage/**",
    "**/*.d.ts",
  ],
  include: [
    "src/**/*.{ts,tsx,js,jsx}",
    "apps/*/src/**/*.{ts,tsx,js,jsx}",
    "packages/*/src/**/*.{ts,tsx,js,jsx}",
  ],
  presets: [],
  rules: [],
};
