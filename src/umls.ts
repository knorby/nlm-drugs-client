import type { RequestOptions, Transport } from "./operations.js";
import { entries, optionalText, record, responseUrl, text } from "./parse.js";

export interface UmlsResult {
  ui: string;
  name: string;
  rootSource?: string;
  uri?: string;
}
export interface UmlsSearchOptions extends RequestOptions {
  searchType?:
    | "exact"
    | "words"
    | "normalizedString"
    | "normalizedWords"
    | "leftTruncation"
    | "rightTruncation";
  sources?: readonly string[];
  returnIdType?:
    | "concept"
    | "code"
    | "sourceUi"
    | "sourceConcept"
    | "sourceDescriptor"
    | "aui";
  inputType?:
    | "atom"
    | "code"
    | "sourceUi"
    | "sourceConcept"
    | "sourceDescriptor"
    | "tty";
}

function parseResults(value: unknown, field: string): UmlsResult[] {
  return entries(value, "UMLS", field).map((item) => {
    const result = record(item, "UMLS", field);
    return {
      ui: text(result.ui, "UMLS", "ui"),
      name: text(result.name, "UMLS", "name"),
      rootSource: optionalText(result.rootSource, "UMLS", "rootSource"),
      uri: optionalText(result.uri, "UMLS", "uri"),
    };
  });
}

export function createUmlsClient(transport: Transport, apiKey?: string) {
  const request = async (
    path: string,
    params: Record<string, string | undefined>,
    options?: RequestOptions,
  ) => {
    if (!apiKey)
      throw new TypeError("UMLS requires an API key in client options");
    const url = responseUrl("https://uts-ws.nlm.nih.gov", `/rest/${path}`, {
      ...params,
      apiKey,
    });
    return record(
      await transport.request("UMLS", url, options),
      "UMLS",
      "response",
    );
  };
  return {
    /** Searches UMLS CUIs or source codes (up to 200 results; UMLS search has no pagination). */
    async search(
      query: string,
      options: UmlsSearchOptions = {},
    ): Promise<UmlsResult[]> {
      const value = await request(
        "search/current",
        {
          string: query,
          searchType: options.searchType,
          sabs: options.sources?.join(","),
          returnIdType: options.returnIdType,
          inputType: options.inputType,
        },
        options,
      );
      const result = record(value.result, "UMLS", "result");
      return parseResults(result.results, "result.results");
    },
    /** Finds identifiers in another vocabulary that share a UMLS CUI. */
    async crosswalk(
      input: { source: string; sourceId: string; targetSource?: string },
      options?: RequestOptions,
    ): Promise<UmlsResult[]> {
      const value = await request(
        `crosswalk/current/source/${encodeURIComponent(input.source)}/${encodeURIComponent(input.sourceId)}`,
        { targetSource: input.targetSource },
        options,
      );
      return parseResults(value.result, "result");
    },
    /** Retrieves a UMLS CUI concept; returns the native record for source-specific fields. */
    async getConcept(
      cui: string,
      options?: RequestOptions,
    ): Promise<Record<string, unknown>> {
      const response = await request(
        `content/current/CUI/${encodeURIComponent(cui)}`,
        {},
        options,
      );
      return record(response.result, "UMLS", "result");
    },
    async getAtoms(
      cui: string,
      options?: RequestOptions & { source?: string },
    ): Promise<Record<string, unknown>[]> {
      const response = await request(
        `content/current/CUI/${encodeURIComponent(cui)}/atoms`,
        { sabs: options?.source },
        options,
      );
      return entries(response.result, "UMLS", "result").map((item) =>
        record(item, "UMLS", "atom"),
      );
    },
  };
}
