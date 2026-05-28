import { definePreset } from "../../config/define-config.js";

export default definePreset({
  name: "ship-clean/monorepo",
  include: ["apps/*/src/**/*.{ts,tsx,js,jsx}", "packages/*/src/**/*.{ts,tsx,js,jsx}"],
  rules: [
    {
      type: "structure",
      name: "packages-have-package-json",
      directories: ["packages/*"],
      required: ["package.json"],
      severity: "error",
      message: "Each package directory must contain package.json.",
    },
  ],
});
