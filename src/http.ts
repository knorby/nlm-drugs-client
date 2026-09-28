import { NlmApiError } from "./error.ts";

/** Minimal `fetch` implementation contract. */
export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface HttpConfig {
  /** Base URL for every request (e.g. `https://rxnav.nlm.nih.gov/REST`). */
  baseUrl: string;
  /** Custom fetch implementation. Defaults to the global `fetch`. */
  fetch?: FetchLike;
  /** Request timeout in milliseconds. Defaults to 15,000. */
  timeout?: number;
}

export type QueryValue =
  | string
  | number
  | boolean
  | readonly string[]
  | undefined
  | null;

export type QueryParams = Record<string, QueryValue>;

export const DEFAULT_TIMEOUT_MS = 15_000;

const globalFetch: FetchLike = (input, init) =>
  globalThis.fetch(input as Parameters<typeof globalThis.fetch>[0], init);

/**
 * Minimal HTTP layer shared by every sub-client: URL building, timeouts, and
 * error normalization to {@link NlmApiError}.
 */
export class Http {
  readonly baseUrl: string;
  readonly #fetch: FetchLike;
  readonly #timeout: number;

  constructor(config: HttpConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.#fetch = config.fetch ?? globalFetch;
    this.#timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
  }

  /** Build the absolute URL for `path` with query parameters. */
  buildUrl(path: string, params?: QueryParams): string {
    const suffix = path.replace(/^\/+/, "");
    const url = new URL(
      suffix === "" ? this.baseUrl : `${this.baseUrl}/${suffix}`,
    );
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(
          key,
          Array.isArray(value) ? value.join(" ") : String(value),
        );
      }
    }
    return url.toString();
  }

  /** GET and parse a JSON response. */
  async getJson<T>(path: string, params?: QueryParams): Promise<T> {
    const url = this.buildUrl(path, params);
    const response = await this.#request(url);
    const text = await response.text();
    if (!response.ok) {
      throw new NlmApiError(response.status, url, text);
    }
    try {
      return JSON.parse(text) as T;
    } catch (cause) {
      throw new NlmApiError(
        response.status,
        url,
        text,
        `NLM API returned invalid JSON from ${url}`,
        cause,
      );
    }
  }

  /** GET and return the raw response body as text (e.g. XML documents). */
  async getText(path: string, params?: QueryParams): Promise<string> {
    const url = this.buildUrl(path, params);
    const response = await this.#request(url);
    const text = await response.text();
    if (!response.ok) {
      throw new NlmApiError(response.status, url, text);
    }
    return text;
  }

  async #request(url: string): Promise<Response> {
    const { signal, cancel } = timeoutSignal(this.#timeout);
    try {
      return await this.#fetch(url, { signal });
    } catch (cause) {
      throw new NlmApiError(0, url, undefined, undefined, cause);
    } finally {
      cancel();
    }
  }
}

/** Join a base URL and a path segment, tolerating trailing slashes. */
export function joinBaseUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

/**
 * Normalize the RxNav JSON convention where a field that is usually an array
 * collapses to a single object (or is omitted) when there is exactly one or
 * zero values.
 */
export function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function timeoutSignal(ms: number): {
  signal: AbortSignal;
  cancel: () => void;
} {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return { signal: AbortSignal.timeout(ms), cancel: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}
