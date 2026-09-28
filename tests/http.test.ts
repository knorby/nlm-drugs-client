import { describe, expect, it } from "vitest";
import { NlmApiError } from "../src/error.ts";
import { Http } from "../src/http.ts";
import { jsonResponse, stubFetch, textResponse } from "./helpers.ts";

describe("Http", () => {
  it("builds URLs with query parameters", () => {
    const http = new Http({ baseUrl: "https://example.com/api/" });
    expect(
      http.buildUrl("drugs.json", {
        name: "lipitor",
        maxEntries: 5,
        ttys: ["IN", "SBD"],
        skip: undefined,
        also: null,
      }),
    ).toBe(
      "https://example.com/api/drugs.json?name=lipitor&maxEntries=5&ttys=IN+SBD",
    );
  });

  it("parses JSON responses", async () => {
    const { fetch, urls } = stubFetch(() => jsonResponse({ ok: true }));
    const http = new Http({ baseUrl: "https://example.com", fetch });
    await expect(http.getJson<{ ok: boolean }>("thing.json")).resolves.toEqual({
      ok: true,
    });
    expect(urls[0]).toBe("https://example.com/thing.json");
  });

  it("throws NlmApiError with status and body for non-2xx responses", async () => {
    const { fetch } = stubFetch(() => jsonResponse({ error: "nope" }, 503));
    const http = new Http({ baseUrl: "https://example.com", fetch });
    const error = await http.getJson("thing.json").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NlmApiError);
    const apiError = error as NlmApiError;
    expect(apiError.status).toBe(503);
    expect(apiError.url).toBe("https://example.com/thing.json");
    expect(String(apiError.body)).toContain("nope");
  });

  it("throws NlmApiError for invalid JSON", async () => {
    const { fetch } = stubFetch(() => textResponse("<html>oops</html>"));
    const http = new Http({ baseUrl: "https://example.com", fetch });
    await expect(http.getJson("thing.json")).rejects.toBeInstanceOf(
      NlmApiError,
    );
  });

  it("throws NlmApiError with status 0 for network failures", async () => {
    const http = new Http({
      baseUrl: "https://example.com",
      fetch: () => Promise.reject(new Error("dns broken")),
    });
    const error = await http.getJson("thing.json").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NlmApiError);
    expect((error as NlmApiError).status).toBe(0);
  });

  it("times out long-running requests", async () => {
    const http = new Http({
      baseUrl: "https://example.com",
      timeout: 20,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    });
    const error = await http.getJson("slow.json").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NlmApiError);
    expect((error as NlmApiError).status).toBe(0);
  });

  it("returns raw text bodies", async () => {
    const { fetch } = stubFetch(() => textResponse("<spl>label</spl>"));
    const http = new Http({ baseUrl: "https://example.com", fetch });
    await expect(http.getText("doc.xml")).resolves.toBe("<spl>label</spl>");
  });
});
