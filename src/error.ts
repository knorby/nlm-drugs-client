/**
 * Error thrown when an NLM API request fails.
 *
 * `status` is the HTTP status code, or `0` when the request failed before a
 * response was received (network error, timeout, DNS failure).
 */
export class NlmApiError extends Error {
  /** HTTP status code, or 0 for transport-level failures. */
  readonly status: number;

  /** The URL that was requested. */
  readonly url: string;

  /** Raw response body (usually text), if one was received. */
  readonly body: unknown;

  constructor(
    status: number,
    url: string,
    body?: unknown,
    message?: string,
    cause?: unknown,
  ) {
    super(
      message ??
        (status === 0
          ? `NLM API request to ${url} failed before receiving a response`
          : `NLM API request to ${url} failed with status ${status}`),
      cause === undefined ? undefined : { cause },
    );
    this.name = "NlmApiError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}
