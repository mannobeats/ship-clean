import { describe, expect, it } from "vitest";

import { formatJson } from "../../src/output/json.js";

describe("json output", () => {
  it("emits stable versioned JSON", () => {
    const json = formatJson({
      cwd: "/tmp/project",
      durationMs: 1,
      engines: [],
      findings: [],
      summary: {
        errors: 0,
        filesScanned: 0,
        findings: 0,
        fixed: 0,
        warnings: 0,
      },
      tool: "ship-clean",
      version: 1,
    });

    expect(JSON.parse(json)).toMatchObject({
      tool: "ship-clean",
      version: 1,
    });
  });
});
