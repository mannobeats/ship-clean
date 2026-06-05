import { z } from "zod";

const severitySchema = z.enum(["error", "warn", "off"]);
const severitySettingSchema = z.enum(["error", "warn", "off"]);
const baseRuleSchema = z.object({
  message: z.string().min(1),
  name: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  severity: severitySchema.optional(),
});

const fileScoped = baseRuleSchema.extend({
  exclude: z.array(z.string()).optional(),
  files: z.array(z.string()).min(1),
});

const exportCheckRuleSchema = fileScoped.extend({
  expect: z.enum(["default", "named", "none"]),
  names: z.array(z.string()).optional(),
  type: z.literal("export-check"),
});

const importCheckRuleSchema = fileScoped.extend({
  expect: z.enum(["present", "absent"]),
  pattern: z.string().min(1),
  specifiers: z.array(z.string()).optional(),
  type: z.literal("import-check"),
});

const namingRuleSchema = fileScoped.extend({
  pattern: z.string().min(1),
  target: z.enum(["basename", "relative"]).optional(),
  type: z.literal("naming"),
});

const grepRuleSchema = fileScoped.extend({
  expect: z.enum(["present", "absent"]),
  multiline: z.boolean().optional(),
  pattern: z.string().min(1),
  type: z.literal("grep"),
});

const filePatternRuleSchema = baseRuleSchema.extend({
  exclude: z.array(z.string()).optional(),
  expect: z.enum(["present", "absent"]),
  files: z.array(z.string()).min(1),
  type: z.literal("file-pattern"),
});

const pairedFileRuleSchema = fileScoped.extend({
  require: z.string().min(1),
  type: z.literal("paired-file"),
});

const structureRuleSchema = baseRuleSchema.extend({
  directories: z.array(z.string()).min(1),
  exclude: z.array(z.string()).optional(),
  required: z.array(z.string()).min(1),
  type: z.literal("structure"),
});

const boundaryRuleSchema = baseRuleSchema.extend({
  allowTypeOnly: z.boolean().optional(),
  from: z.array(z.string()).min(1),
  to: z.array(z.string()).min(1),
  type: z.literal("boundary"),
});

const maxLinesRuleSchema = fileScoped.extend({
  max: z.number().int().positive(),
  type: z.literal("max-lines"),
});

const maxDependenciesRuleSchema = fileScoped.extend({
  max: z.number().int().nonnegative(),
  type: z.literal("max-dependencies"),
});

const dependencyRuleSchema = baseRuleSchema.extend({
  dependencyType: z.enum(["dependencies", "devDependencies", "peerDependencies"]).optional(),
  expect: z.enum(["present", "absent"]),
  package: z.string().min(1),
  type: z.literal("dependency"),
});

export const ruleSchema = z.discriminatedUnion("type", [
  exportCheckRuleSchema,
  importCheckRuleSchema,
  namingRuleSchema,
  grepRuleSchema,
  filePatternRuleSchema,
  pairedFileRuleSchema,
  structureRuleSchema,
  boundaryRuleSchema,
  maxLinesRuleSchema,
  maxDependenciesRuleSchema,
  dependencyRuleSchema,
]);

const lintConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    engine: z.enum(["biome", "oxlint"]).optional(),
    format: z.boolean().optional(),
    organizeImports: z.boolean().optional(),
    preset: z.enum(["recommended", "strict", "agent-safe"]).optional(),
  })
  .strict();

const typescriptConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: z.enum(["project", "off"]).optional(),
  })
  .strict();

const graphConfigSchema = z
  .object({
    cycles: severitySettingSchema.optional(),
    enabled: z.boolean().optional(),
    entrypoints: z.array(z.string()).optional(),
    unusedExports: severitySettingSchema.optional(),
    unusedFiles: severitySettingSchema.optional(),
  })
  .strict();

const duplicatesConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    exclude: z.array(z.string()).optional(),
    files: z.array(z.string()).optional(),
    minLines: z.number().int().positive().optional(),
    severity: severitySettingSchema.optional(),
  })
  .strict();

const packageHealthConfigSchema = z
  .object({
    allowedUnusedDependencies: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
    forbidden: z.array(z.string()).optional(),
    missingDependencies: severitySettingSchema.optional(),
    unusedDependencies: severitySettingSchema.optional(),
  })
  .strict();

const agentConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    sync: z.boolean().optional(),
  })
  .strict();

export const presetSchema = z.object({
  agent: agentConfigSchema.optional(),
  duplicates: duplicatesConfigSchema.optional(),
  exclude: z.array(z.string()).optional(),
  graph: graphConfigSchema.optional(),
  include: z.array(z.string()).optional(),
  lint: lintConfigSchema.optional(),
  name: z.string().min(1),
  package: packageHealthConfigSchema.optional(),
  rules: z.array(ruleSchema).optional(),
  typescript: typescriptConfigSchema.optional(),
});

const extendsInputSchema = z.union([z.string(), presetSchema, z.lazy(() => configSchema)]);

export const configSchema: z.ZodType = z.object({
  agent: agentConfigSchema.optional(),
  duplicates: duplicatesConfigSchema.optional(),
  exclude: z.array(z.string()).optional(),
  extends: z.union([extendsInputSchema, z.array(extendsInputSchema)]).optional(),
  graph: graphConfigSchema.optional(),
  include: z.array(z.string()).optional(),
  lint: lintConfigSchema.optional(),
  package: packageHealthConfigSchema.optional(),
  rules: z.array(ruleSchema).optional(),
  typescript: typescriptConfigSchema.optional(),
});
