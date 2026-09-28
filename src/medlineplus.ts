import { XMLParser } from "fast-xml-parser";
import type {
  ConnectInput,
  RequestOptions,
  SourceOperationsClient,
  Transport,
} from "./operations.js";
import {
  entries,
  finiteNumber,
  integer,
  NlmResponseError,
  optionalText,
  record,
  responseUrl,
  text,
} from "./parse.js";

export interface MedlinePage {
  title: string;
  url: string;
}
export interface TopicSearchPage {
  results: MedlinePage[];
  total: number;
  file?: string;
  server?: string;
}
/** Genetics search returns URLs, ranks and scores, not health-topic titles. */
export interface GeneticsSearchResult {
  url: string;
  order?: number;
  score?: number;
}
export interface GeneticsSearchPage {
  results: GeneticsSearchResult[];
  total: number;
  file?: string;
  server?: string;
}
export interface TopicSearchOptions extends RequestOptions {
  start?: number;
  pageSize?: number;
  file?: string;
  server?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  attributeNamePrefix: "@_",
  isArray: (tagName) => tagName === "document" || tagName === "content",
});

function parseSearch(value: unknown, source: string): TopicSearchPage {
  const xml = text(value, source, "search XML");
  const root = record(
    record(parser.parse(xml, true), source, "XML").nlmSearchResult,
    source,
    "nlmSearchResult",
  );
  const documentList = record(root.list ?? {}, source, "list");
  const results = entries(documentList.document, source, "document").map(
    (value) => {
      const document = record(value, source, "document");
      const contents = entries(document.content, source, "content");
      const title = contents
        .map((item) => record(item, source, "content"))
        .find((item) => item["@_name"] === "title");
      if (!title) throw new NlmResponseError(source, "document.title");
      return {
        url: text(document["@_url"], source, "document.url"),
        title: text(title["#text"], source, "document.title"),
      };
    },
  );
  return {
    results,
    total: integer(root.count, source, "count"),
    file: optionalText(root.file, source, "file"),
    server: optionalText(root.server, source, "server"),
  };
}

function parseGeneticsSearch(
  value: unknown,
  source: string,
): GeneticsSearchPage {
  const xml = text(value, source, "search XML");
  const root = record(
    record(parser.parse(xml, true), source, "XML").search_results,
    source,
    "search_results",
  );
  return {
    results: entries(root.result, source, "result").map((value) => {
      const result = record(value, source, "result");
      return {
        url: text(result.url, source, "result.url"),
        order:
          result.order === undefined
            ? undefined
            : integer(result.order, source, "result.order"),
        score:
          result.score === undefined
            ? undefined
            : finiteNumber(result.score, source, "result.score"),
      };
    }),
    total: integer(root["@_count"], source, "search_results.count"),
    file: optionalText(root.file, source, "file"),
    server: optionalText(root.server, source, "server"),
  };
}

function createSearch<Result>(
  transport: Transport,
  db: "healthTopics" | "healthTopicsSpanish" | "ghr",
  source: string,
  parse: (
    value: unknown,
    source: string,
  ) => { results: Result[]; total: number; file?: string; server?: string },
) {
  const search = async (term: string, options: TopicSearchOptions = {}) => {
    if ((options.file === undefined) !== (options.server === undefined))
      throw new TypeError("file and server must be supplied together");
    if (options.start !== undefined && options.start > 0 && !options.file)
      throw new TypeError(
        "Pagination requires the file and server from the first page",
      );
    const url = responseUrl("https://wsearch.nlm.nih.gov", "/ws/query", {
      db,
      term,
      retmax: options.pageSize,
      retstart: options.start,
      file: options.file,
      server: options.server,
    });
    return parse(await transport.request(source, url, options), source);
  };
  return {
    search,
    async *iterate(
      term: string,
      options: Omit<TopicSearchOptions, "start" | "file" | "server"> = {},
    ): AsyncGenerator<Result> {
      const pageSize = options.pageSize ?? 10;
      if (!Number.isSafeInteger(pageSize) || pageSize <= 0)
        throw new RangeError("pageSize must be a positive integer");
      let start = 0;
      let file: string | undefined;
      let server: string | undefined;
      while (true) {
        const page = await search(term, { ...options, start, file, server });
        yield* page.results;
        start += page.results.length;
        if (start >= page.total || !page.results.length) return;
        if (!page.file || !page.server)
          throw new Error(`${source} omitted pagination cursor`);
        file = page.file;
        server = page.server;
      }
    },
  };
}

export function createMedlinePlusClient(transport: Transport) {
  const topics = createSearch(
    transport,
    "healthTopics",
    "MedlinePlus Topics",
    parseSearch,
  );
  return {
    searchTopics: topics.search,
    iterateTopics: topics.iterate,
    searchSpanishTopics: createSearch(
      transport,
      "healthTopicsSpanish",
      "MedlinePlus Topics",
      parseSearch,
    ).search,
  };
}

export function createGeneticsClient(transport: Transport) {
  const genetics = createSearch(
    transport,
    "ghr",
    "MedlinePlus Genetics",
    parseGeneticsSearch,
  );
  return {
    search: genetics.search,
    iterate: genetics.iterate,
    /** Loads a condition, gene, chromosome or mtDNA page's native JSON data. */
    async getPage(
      type: "condition" | "gene" | "chromosome" | "mtdna",
      slug: string,
      options?: RequestOptions,
    ): Promise<Record<string, unknown>> {
      const url = responseUrl(
        "https://medlineplus.gov",
        `/download/genetics/${type}/${encodeURIComponent(slug)}.json`,
      );
      return record(
        await transport.request("MedlinePlus Genetics", url, options),
        "MedlinePlus Genetics",
        "page",
      );
    },
  };
}

export function createConnectMethods(
  call: SourceOperationsClient["medlinePlusConnect"],
) {
  return {
    async findDrugPages(
      input: Extract<ConnectInput, { kind: "ndc" | "rxcui" | "drugName" }>,
      options?: RequestOptions,
    ): Promise<MedlinePage[]> {
      const response = record(
        await call.connect(input, options),
        "MedlinePlus Connect",
        "response",
      );
      const feed = record(response.feed, "MedlinePlus Connect", "feed");
      return entries(feed.entry, "MedlinePlus Connect", "entry").map(
        (value) => {
          const item = record(value, "MedlinePlus Connect", "entry");
          const title = record(item.title, "MedlinePlus Connect", "title");
          const link = record(
            entries(item.link, "MedlinePlus Connect", "link")[0],
            "MedlinePlus Connect",
            "link",
          );
          return {
            title: text(title._value, "MedlinePlus Connect", "title._value"),
            url: text(link.href, "MedlinePlus Connect", "link.href"),
          };
        },
      );
    },
  };
}
