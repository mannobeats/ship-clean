export function one(input: string) {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  const dashed = lower.replaceAll(" ", "-");
  return dashed;
}
