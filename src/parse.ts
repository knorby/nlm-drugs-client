/** Raised when a service returns a successful HTTP response with an unexpected shape. */
export class NlmResponseError extends Error {
  constructor(
    readonly source: string,
    readonly field: string,
  ) {
    super(`${source} returned an invalid ${field}`);
    this.name = "NlmResponseError";
  }
}

export function record(
  value: unknown,
  source: string,
  field: string,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new NlmResponseError(source, field);
  return value as Record<string, unknown>;
}

export function optionalRecord(
  value: unknown,
  source: string,
  field: string,
): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  return record(value, source, field);
}

export function text(value: unknown, source: string, field: string): string {
  if (typeof value !== "string") throw new NlmResponseError(source, field);
  return value;
}

export function optionalText(
  value: unknown,
  source: string,
  field: string,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return text(value, source, field);
}

export function integer(value: unknown, source: string, field: string): number {
  const result =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isSafeInteger(result) || result < 0)
    throw new NlmResponseError(source, field);
  return result;
}

export function finiteNumber(
  value: unknown,
  source: string,
  field: string,
): number {
  const result =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isFinite(result)) throw new NlmResponseError(source, field);
  return result;
}

export function list(value: unknown, source: string, field: string): unknown[] {
  if (!Array.isArray(value)) throw new NlmResponseError(source, field);
  return value;
}

export function entries(
  value: unknown,
  _source: string,
  _field: string,
): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function stringList(
  value: unknown,
  source: string,
  field: string,
): string[] {
  return list(value, source, field).map((item) => text(item, source, field));
}

export function responseUrl(
  origin: string,
  path: string,
  parameters: Record<string, string | number | undefined> = {},
): URL {
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}
