import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runInitCommand } from "../../src/commands/init.js";
import { renderConfig, selectionFromFlags } from "../../src/commands/init-config.js";
import { loadShipCleanConfig } from "../../src/config/loader.js";

const tempDirs: string[] = [];

const makeTempProject = async (): Promise<string> => {
  const cwd = await mkdtemp(join(tmpdir(), "ship-clean-init-"));
  tempDirs.push(cwd);
  await writeFile(join(cwd, "package.json"), '{"name":"fixture","version":"1.0.0"}\n');
  return cwd;
};

describe("init command", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
  });

  it("renders a strict next config with all quality systems", () => {
    const config = renderConfig(
      selectionFromFlags({
        projectType: "next",
        strictness: "agent-safe",
      }),
    );

    expect(config).toContain('preset: "agent-safe"');
    expect(config).toContain('unusedFiles: "error"');
    expect(config).toContain("ship-clean/react");
  });

  it("writes config in non-interactive mode", async () => {
    const cwd = await makeTempProject();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await expect(
      runInitCommand({
        cwd,
        force: true,
        nonInteractive: true,
        projectType: "node-api",
        strictness: "strict",
      }),
    ).resolves.toBe(0);

    const config = await readFile(join(cwd, "shipclean.config.ts"), "utf8");
    expect(config).toContain('preset: "strict"');
    expect(config).toContain('"src/server.ts"');

    const biomeConfig = await readFile(join(cwd, "biome.jsonc"), "utf8");
    expect(biomeConfig).toContain('"noUnusedImports"');
    expect(biomeConfig).toContain('"lineWidth": 80');

    const agentRules = await readFile(join(cwd, "AGENTS.md"), "utf8");
    expect(agentRules).toContain("Ship Clean Quality Loop");
    expect(agentRules).toContain("ship-clean check --json");

    const vscodeSettings = await readFile(join(cwd, ".vscode/settings.json"), "utf8");
    expect(vscodeSettings).toContain("biomejs.biome");

    const packageJson = await readFile(join(cwd, "package.json"), "utf8");
    expect(packageJson).toContain('"ship-clean:check": "ship-clean check"');

    const loaded = await loadShipCleanConfig({ cwd });
    expect(loaded.lint.preset).toBe("strict");
    expect(loaded.graph.entrypoints).toContain("src/server.ts");
    expect(loaded.duplicates.enabled).toBe(true);
  });
});
