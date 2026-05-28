const explanations = new Map<string, string>([
  ["export-check", "Requires or forbids default/named exports in matching files."],
  ["import-check", "Requires or forbids import sources matching a regular expression."],
  ["naming", "Enforces file naming with a regular expression."],
  ["grep", "Checks file content for required or forbidden text patterns."],
  ["file-pattern", "Requires or forbids files matching glob patterns."],
  ["paired-file", "Requires companion files such as tests, stories, or docs."],
  ["structure", "Requires files inside matching directories."],
  ["boundary", "Forbids imports across architecture boundaries."],
  ["max-lines", "Warns or fails when files exceed a line limit."],
  ["max-dependencies", "Warns or fails when modules import too many dependencies."],
  ["dependency", "Requires or forbids package.json dependencies."],
]);

export const runExplainCommand = async (rule: string): Promise<number> => {
  const explanation = explanations.get(rule);
  if (!explanation) {
    process.stderr.write(`Unknown rule: ${rule}\n`);
    return 1;
  }
  process.stdout.write(`${rule}\n${explanation}\n`);
  return 0;
};
